import type { Express } from "express";
import express, { Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import * as fsSync from "fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { storage } from "./storage";
import { insertUserSchema, insertSchoolSchema, insertMemorySchema, insertPublicUploadLinkSchema, insertSchoolGalleryImageSchema, passwordResetTokens, users, yearbooks, yearbookPages } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// Database connection for direct queries
const connectionString = process.env.DATABASE_URL!;
const queryClient = postgres(connectionString);
const db = drizzle(queryClient);
import { CURRENT_YEAR, BETA_VERSION } from "@shared/constants";
import { hashPassword, comparePassword } from "./password-utils";
import { sendEmail } from "./utils/sendEmail";
import {
  createPasswordResetEmail,
  createPasswordChangedEmail,
  createVerificationEmail,
  createSchoolVerificationEmail,
  createSchoolApprovalEmail,
  createSchoolRejectionEmail,
  createTestEmail
} from "./utils/emailTemplates";
import { uploadToCloudinary, uploadSecureYearbookPage, uploadPdfToCloudinary, deleteFromCloudinary, testCloudinaryConnection, generateFolderPath, deleteSchoolAssets, generateSignedUrl, generateSignedUrlsForPages } from "./cloudinary-config";
import { getImageUrl } from "./watermark-service";
import sharp from "sharp";

// Force reload constants to avoid caching issues
console.log(`Server startup: CURRENT_YEAR = ${CURRENT_YEAR}`);

function getAppBaseUrl(req: Request): string {
  const configuredDomain = process.env.APP_DOMAIN?.trim();
  if (configuredDomain) {
    return /^https?:\/\//i.test(configuredDomain)
      ? configuredDomain.replace(/\/$/, "")
      : `https://${configuredDomain}`;
  }

  const forwardedHost = req.headers["x-forwarded-host"];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.get("host");
  if (!host) {
    throw new Error("Unable to determine the application host for a verification link");
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || "https";
  return `${protocol.split(",")[0].trim()}://${host}`;
}

// Text formatting utility function for proper title case
const formatTitleCase = (text: string): string => {
  if (!text || typeof text !== 'string') return text;
  
  // Split by spaces and commas, preserving the separators
  return text.split(/(\s+|,\s*)/).map(part => {
    // Skip whitespace and comma separators
    if (/^\s*$/.test(part) || /^,\s*$/.test(part)) {
      return part;
    }
    
    // Convert to title case: first letter uppercase, rest lowercase
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join('');
};

// Helper function to parse user agent and track login
const trackLoginActivity = async (
  req: Request, 
  userId: string, 
  loginStatus: 'success' | 'failed', 
  failureReason?: string
) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || '';
    
    // Parse user agent for device/browser info
    let deviceType = 'desktop';
    let browser = 'Unknown';
    let os = 'Unknown';
    
    if (userAgent) {
      // Detect device type
      if (/mobile/i.test(userAgent)) deviceType = 'mobile';
      else if (/tablet|ipad/i.test(userAgent)) deviceType = 'tablet';
      
      // Detect browser
      if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) browser = 'Chrome';
      else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
      else if (/firefox/i.test(userAgent)) browser = 'Firefox';
      else if (/edg/i.test(userAgent)) browser = 'Edge';
      else if (/opera|opr/i.test(userAgent)) browser = 'Opera';
      
      // Detect OS
      if (/windows/i.test(userAgent)) os = 'Windows';
      else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
      else if (/linux/i.test(userAgent)) os = 'Linux';
      else if (/android/i.test(userAgent)) os = 'Android';
      else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
    }
    
    // Track login activity
    await storage.createLoginActivity({
      userId,
      ipAddress,
      userAgent,
      deviceType,
      browser,
      os,
      loginStatus,
      failureReason,
    });
  } catch (error) {
    console.error('Error tracking login activity:', error);
  }
};

// Ensure upload directories exist
const ensureUploadDirs = async () => {
  const dirs = [
    'public/uploads/accreditation',
    'public/uploads/yearbooks', 
    'public/uploads/profiles',
    'public/uploads/memories',
    'public/uploads/logos'
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }
};

// Extend Express Request type to include superAdmin and file
declare global {
  namespace Express {
    interface Request {
      superAdmin?: any;
      file?: Express.Multer.File;
    }
  }
}



// Super Admin Authentication Middleware
const requireSuperAdmin = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Super admin access denied' });
    }

    const userId = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = await storage.getUserById(userId);
    
    // Check both userType and role for super_admin access
    if (!user || (user.userType !== 'super_admin' && user.role !== 'super_admin')) {
      return res.status(403).json({ message: 'Super admin privileges required' });
    }

    req.superAdmin = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid authentication' });
  }
};

// Authentication Middleware - Extract user from request
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userId = authHeader.substring(7);
    const user = await storage.getUserById(userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid authentication' });
  }
};

// Yearbook Access Control Middleware
const checkYearbookAccess = async (req: any, res: any, next: any) => {
  try {
    const { schoolId, year } = req.params;
    const user = req.user;

    // Super Admin has unrestricted access
    if (user.userType === 'super_admin' || user.role === 'super_admin') {
      req.hasAccess = true;
      return next();
    }

    // School accounts can access their own yearbooks
    if (user.userType === 'school' && user.schoolId === schoolId) {
      req.hasAccess = true;
      return next();
    }

    // In beta mode all yearbooks are free — grant access unconditionally
    if (BETA_VERSION) {
      req.hasAccess = true;
      return next();
    }

    // Check if yearbook is free for all viewers (must check BEFORE purchase check)
    const yearbook = await storage.getYearbookBySchoolAndYear(schoolId, parseInt(year));
    if (yearbook?.isFree) {
      req.hasAccess = true;
      return next();
    }

    // Viewer accounts can only access yearbooks they've purchased
    if (user.userType === 'viewer') {
      const hasAccess = await storage.checkUserYearbookAccess(user.id, schoolId, parseInt(year));
      if (hasAccess) {
        req.hasAccess = true;
        return next();
      }
    }

    // Access denied
    return res.status(403).json({ message: 'You do not have access to this yearbook' });
  } catch (error) {
    console.error('Error checking yearbook access:', error);
    return res.status(500).json({ message: 'Error checking access' });
  }
};

// Configure multer for file uploads
const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    // Different destinations based on field name
    if (file.fieldname === 'accreditationDocument') {
      cb(null, 'public/uploads/accreditation');
    } else if (file.fieldname === 'memoryFile') {
      cb(null, 'public/uploads/memories');
    } else if (file.fieldname === 'galleryImage') {
      cb(null, 'public/uploads/memories'); // Use memories directory for gallery images
    } else if (file.fieldname === 'schoolLogo') {
      cb(null, 'public/uploads/logos');
    } else if (file.fieldname === 'profileImage') {
      cb(null, 'public/uploads/profiles');
    } else {
      cb(null, 'public/uploads/yearbooks');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    if (file.fieldname === 'accreditationDocument') {
      cb(null, `accreditation-${uniqueSuffix}${path.extname(file.originalname)}`);
    } else if (file.fieldname === 'memoryFile') {
      cb(null, `memory-${uniqueSuffix}${path.extname(file.originalname)}`);
    } else if (file.fieldname === 'galleryImage') {
      cb(null, `gallery-${uniqueSuffix}${path.extname(file.originalname)}`);
    } else if (file.fieldname === 'schoolLogo') {
      cb(null, `logo-${uniqueSuffix}${path.extname(file.originalname)}`);
    } else if (file.fieldname === 'profileImage') {
      cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
    } else {
      cb(null, `yearbook-page-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for images and PDFs
  },
  fileFilter: (req, file, cb) => {
    // For school logos, only allow images
    if (file.fieldname === 'schoolLogo') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('School logo must be an image file'));
      }
    } else if (file.mimetype.startsWith('image/') || 
        file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure upload directories exist
  await ensureUploadDirs();
  
  // Get pricing configuration from environment variables
  app.get("/api/config/prices", (req, res) => {
    res.json({
      schoolYearPrice: parseFloat(process.env.SCHOOL_YEAR_PRICE || '16.99'),
      viewerYearPrice: parseFloat(process.env.VIEWER_YEAR_PRICE || '6.99'),
      badgeSlotPrice: parseFloat(process.env.BADGE_SLOT_PRICE || '0.99'),
    });
  });
  
  // URGENT FIX: Simple working function for pending memories
  async function getSimplePendingMemories(schoolId: string) {
    const pkg = await import('pg');
    const { Pool } = pkg.default;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Add error handler to prevent crashes
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
    
    try {
      const result = await pool.query(
        'SELECT id, title, description, image_url, media_type, event_date, year, category, status, uploaded_by, created_at FROM memories WHERE school_id = $1 AND status = $2 ORDER BY created_at DESC',
        [schoolId, 'pending']
      );
      
      await pool.end();
      return result.rows;
    } catch (error) {
      await pool.end();
      throw error;
    }
  }
  
  // EMERGENCY BYPASS: Working test endpoint to prove data can be served
  app.get("/api/test-pending-memories/:schoolId", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const result = await getSimplePendingMemories(schoolId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Database error", details: error.message });
    }
  });
  
  // DEBUG: Test authentication step by step
  app.get("/api/debug-auth/:schoolId", async (req, res) => {
    console.log("=== DEBUG AUTH START ===");
    try {
      const { schoolId } = req.params;
      console.log("SchoolId:", schoolId);
      
      const authHeader = req.headers.authorization;
      console.log("Auth header:", authHeader);
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("AUTH FAIL: No Bearer token");
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      console.log("User ID:", userId);
      
      const user = await storage.getUser(userId);
      console.log("User found:", user);
      
      if (!user) {
        console.log("AUTH FAIL: User not found");
        return res.status(403).json({ message: "User not found" });
      }
      
      console.log("User type:", user.userType);
      console.log("AUTH SUCCESS!");
      res.json({ success: true, userId, userType: user.userType });
    } catch (error) {
      console.error("DEBUG AUTH ERROR:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // Static uploads serving removed for security - all images now go through secure endpoints
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, redirectContext } = req.body;
      
      // Try to find user by username first, then by email
      let user = await storage.getUserByUsername(username.toLowerCase());
      if (!user) {
        // Check if the input looks like an email and try to find by email
        if (username.includes('@')) {
          user = await storage.getUserByEmail(username.toLowerCase());
        }
      }
      
      // If no user account exists, check if this is a pending school registration
      if (!user) {
        const school = await storage.getSchoolByUsername(username.toLowerCase());
        
        if (school && school.tempAdminCredentials) {
          // Verify password against temporary credentials
          const tempCreds = school.tempAdminCredentials as any;
          const isPasswordValid = await comparePassword(password, tempCreds.password);
          
          if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
          }
          
          // Password is correct, now check verification status
          
          // Check if school email is verified
          if (!school.isEmailVerified) {
            return res.status(403).json({ 
              message: `A verification link was sent to ${school.email}. Please check your inbox to continue.`,
              emailNotVerified: true,
              email: school.email,
              schoolId: school.id,
              redirectTo: `/email-verification?email=${encodeURIComponent(school.email)}&schoolId=${encodeURIComponent(school.id)}`
            });
          }
          
          // Check approval status
          if (school.approvalStatus !== 'approved') {
            return res.status(403).json({ 
              message: "Your account is under review by our moderators. You will receive a response in 3-5 business days.",
              pendingApproval: true,
              approvalStatus: school.approvalStatus,
              redirectTo: "/pending-approval"
            });
          }
          
          // If we reach here, school is verified AND approved but user account hasn't been created yet
          // This shouldn't happen in normal flow, but handle it gracefully
          return res.status(500).json({ 
            message: "Account setup incomplete. Please contact support." 
          });
        }
        
        // No user and no school registration found
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Compare password using bcrypt
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        await trackLoginActivity(req, user.id, 'failed', 'Invalid password');
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Check email verification status for viewers
      if (user.userType === "viewer" && !user.isEmailVerified) {
        await trackLoginActivity(req, user.id, 'failed', 'Email not verified');
        return res.status(403).json({ 
          message: "Please verify your email before logging in.",
          emailNotVerified: true,
          email: user.email,
          userId: user.id,
          redirectTo: "/email-verification"
        });
      }
      
      // For school accounts, validate email verification and approval status
      if (user.userType === "school" && user.schoolId) {
        const school = await storage.getSchoolById(user.schoolId);
        if (!school) {
          await trackLoginActivity(req, user.id, 'failed', 'School not found');
          return res.status(401).json({ message: "School not found" });
        }
        
        // Check if school email is verified
        if (!school.isEmailVerified) {
          await trackLoginActivity(req, user.id, 'failed', 'School email not verified');
          return res.status(403).json({ 
            message: "Please verify your school email before logging in.",
            emailNotVerified: true,
            email: school.email,
            userId: user.id,
            redirectTo: "/email-verification"
          });
        }
        
        // Check approval status
        if (school.approvalStatus !== 'approved') {
          await trackLoginActivity(req, user.id, 'failed', 'School pending approval');
          return res.status(403).json({ 
            message: "Your account has been verified but is awaiting approval by our moderation team.",
            pendingApproval: true,
            approvalStatus: school.approvalStatus,
            redirectTo: "/pending-approval"
          });
        }
      }

      // Check if user is super admin and needs 2FA
      const isSuperAdmin = user.userType === "super_admin" || user.role === "super_admin";
      const shouldRequireTwoFactor =
        process.env.NODE_ENV === "production" || Boolean(process.env.RESEND_API_KEY);

      if (isSuperAdmin && shouldRequireTwoFactor) {
        // Check if there's already a valid, unused 2FA code
        const now = new Date();
        const hasValidCode = user.twoFactorCode && 
                            user.twoFactorCodeExpiresAt && 
                            now < user.twoFactorCodeExpiresAt;
        
        // Only generate and send a new code if:
        // A) No existing code, OR
        // B) Existing code has expired
        if (!hasValidCode) {
          // Generate 6-digit code
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const hashedCode = await hashPassword(code);
          
          // Set expiry (5 minutes from now)
          const expiresAt = new Date();
          expiresAt.setMinutes(expiresAt.getMinutes() + 5);
          
          // Update user with 2FA code
          await db.update(users)
            .set({
              twoFactorCode: hashedCode,
              twoFactorCodeExpiresAt: expiresAt,
              twoFactorCodeSentAt: new Date()
            })
            .where(eq(users.id, user.id));
          
          // Send 2FA code via email
          const { createTwoFactorAuthEmail } = await import("./utils/emailTemplates.js");
          const emailHtml = createTwoFactorAuthEmail(code);
          
          const emailResult = await sendEmail(
            user.email!,
            "Your Security Code - Yearbuk",
            emailHtml
          );
          
          if (!emailResult.success) {
            console.error("Failed to send 2FA email:", emailResult.error);
            return res.status(500).json({ message: "Failed to send verification code" });
          }
          
          // Track login attempt (not fully successful yet)
          await trackLoginActivity(req, user.id, 'pending_2fa', 'Awaiting 2FA verification');
        } else {
          // Valid code already exists, just track the attempt
          await trackLoginActivity(req, user.id, 'pending_2fa', 'Existing 2FA code still valid');
        }
        
        // Return response indicating 2FA required (whether new code was sent or existing code is valid)
        return res.json({ 
          requires2FA: true, 
          userId: user.id,
          email: user.email
        });
      }

      // Track successful login for non-super-admin users
      await trackLoginActivity(req, user.id, 'success');

      // Determine redirect based on user type and redirect context
      let redirectTo = "/";
      
      if (redirectContext?.intent === 'request-alumni-status' && redirectContext?.schoolId) {
        // Alumni request now handled via dialog in the app; redirect to home
        redirectTo = "/";
      }

      // Return user info (excluding password) with redirect
      const { password: _, ...userInfo } = user;
      res.json({ user: userInfo, redirectTo });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Verify 2FA code for super admin
  app.post("/api/auth/verify-2fa", async (req, res) => {
    try {
      const { userId, code } = req.body;
      
      if (!userId || !code) {
        return res.status(400).json({ message: "User ID and code are required" });
      }
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user is super admin
      if (user.userType !== "super_admin" && user.role !== "super_admin") {
        return res.status(403).json({ message: "2FA not required for this account" });
      }
      
      // Check if code exists and hasn't expired
      if (!user.twoFactorCode || !user.twoFactorCodeExpiresAt) {
        return res.status(400).json({ message: "No verification code found. Please request a new one." });
      }
      
      const now = new Date();
      if (now > user.twoFactorCodeExpiresAt) {
        return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
      }
      
      // Verify code
      const isCodeValid = await comparePassword(code.trim(), user.twoFactorCode);
      if (!isCodeValid) {
        // Track failed 2FA attempt
        await trackLoginActivity(req, user.id, 'failed', '2FA code invalid', null);
        return res.status(401).json({ message: "Invalid verification code" });
      }
      
      // Clear 2FA code after successful verification
      await db.update(users)
        .set({
          twoFactorCode: null,
          twoFactorCodeExpiresAt: null,
          twoFactorCodeSentAt: null
        })
        .where(eq(users.id, user.id));
      
      // Track successful login
      await trackLoginActivity(req, user.id, 'success', '2FA verified', null);
      
      // Return user info (excluding password)
      const { password: _, twoFactorCode: __, ...userInfo } = user;
      res.json({ 
        user: userInfo, 
        redirectTo: "/super-admin" 
      });
    } catch (error) {
      console.error("2FA verification error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Resend 2FA code for super admin
  app.post("/api/auth/resend-2fa", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user is super admin
      if (user.userType !== "super_admin" && user.role !== "super_admin") {
        return res.status(403).json({ message: "2FA not required for this account" });
      }
      
      // Check cooldown (50 seconds)
      if (user.twoFactorCodeSentAt) {
        const now = new Date();
        const timeSinceLastSend = (now.getTime() - user.twoFactorCodeSentAt.getTime()) / 1000;
        if (timeSinceLastSend < 50) {
          const remainingTime = Math.ceil(50 - timeSinceLastSend);
          return res.status(429).json({ 
            message: `Please wait ${remainingTime} seconds before requesting a new code.`,
            remainingTime 
          });
        }
      }
      
      // Generate new 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedCode = await hashPassword(code);
      
      // Set expiry (5 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);
      
      // Update user with new 2FA code
      await db.update(users)
        .set({
          twoFactorCode: hashedCode,
          twoFactorCodeExpiresAt: expiresAt,
          twoFactorCodeSentAt: new Date()
        })
        .where(eq(users.id, user.id));
      
      // Send 2FA code via email
      const { createTwoFactorAuthEmail } = await import("./utils/emailTemplates.js");
      const emailHtml = createTwoFactorAuthEmail(code);
      
      const emailResult = await sendEmail(
        user.email!,
        "Your Security Code - Yearbuk",
        emailHtml
      );
      
      if (!emailResult.success) {
        console.error("Failed to send 2FA email:", emailResult.error);
        return res.status(500).json({ message: "Failed to send verification code" });
      }
      
      res.json({ message: "New verification code sent successfully" });
    } catch (error) {
      console.error("2FA resend error:", error);
      res.status(500).json({ message: "Failed to resend code" });
    }
  });

  // Password verification endpoint
  app.post("/api/auth/verify-password", async (req, res) => {
    try {
      const { username, password, userId } = req.body;
      
      console.log("🔐 Password verification request:", { 
        hasUsername: !!username, 
        hasPassword: !!password,
        hasUserId: !!userId,
        hasSession: !!req.session,
        sessionUserId: req.session?.userId 
      });
      
      // Priority 1: Use userId from request body
      if (userId) {
        const currentUser = await storage.getUserWithPassword(userId);
        if (!currentUser) {
          console.log("❌ User not found for user ID:", userId);
          return res.status(401).json({ message: "User not found" });
        }
        
        console.log("✓ Found user via userId, comparing password");
        const isValid = await comparePassword(password, currentUser.password);
        if (isValid) {
          console.log("✅ Password correct");
          return res.json({ verified: true });
        } else {
          console.log("❌ Password incorrect");
          return res.status(401).json({ message: "Incorrect password" });
        }
      }
      
      // Priority 2: Use session if available
      if (!username && req.session?.userId) {
        const currentUser = await storage.getUserWithPassword(req.session.userId);
        if (!currentUser) {
          console.log("❌ User not found for session ID:", req.session.userId);
          return res.status(401).json({ message: "User not found" });
        }
        
        console.log("✓ Found user via session, comparing password");
        const isValid = await comparePassword(password, currentUser.password);
        if (isValid) {
          console.log("✅ Password correct");
          return res.json({ verified: true });
        } else {
          console.log("❌ Password incorrect");
          return res.status(401).json({ message: "Incorrect password" });
        }
      }
      
      console.log("⚠️ Using legacy username/password validation");
      // Legacy behavior: verify with username and password
      const user = await storage.validateUser(username, password);
      
      if (user) {
        res.json({ verified: true });
      } else {
        res.status(401).json({ message: "Incorrect credentials" });
      }
    } catch (error) {
      console.error("Password verification error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Request password reset
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.trim()) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email.toLowerCase());
      
      // For security, always return success even if user doesn't exist
      // This prevents email enumeration attacks
      if (!user) {
        return res.json({ message: "If an account exists with this email, you will receive a password reset link." });
      }
      
      // Generate secure random token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = await hashPassword(resetToken);
      
      // Token expires in 30 minutes
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);
      
      // Save token to database
      await storage.createPasswordResetToken({
        userId: user.id,
        token: hashedToken,
        expiresAt
      });
      
      const resetLink = `${getAppBaseUrl(req)}/reset-password/${resetToken}`;
      
      // Send password reset email with liquid glass template
      const emailHtml = createPasswordResetEmail(resetLink);
      
      const emailResult = await sendEmail(
        user.email!,
        "Reset Your Yearbuk Password",
        emailHtml
      );
      
      if (!emailResult.success) {
        console.error("Failed to send password reset email:", emailResult.error);
        return res.status(500).json({ message: "Failed to send password reset email" });
      }
      
      res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      
      // Get all password reset tokens from database
      const allTokenRecords = await db.select()
        .from(passwordResetTokens);
      
      // Find matching token by comparing with bcrypt
      let matchedToken = null;
      for (const tokenRecord of allTokenRecords) {
        const isValid = await comparePassword(token, tokenRecord.token);
        if (isValid) {
          matchedToken = tokenRecord;
          break;
        }
      }
      
      if (!matchedToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Check if token is expired
      if (new Date() > new Date(matchedToken.expiresAt)) {
        await storage.deletePasswordResetToken(matchedToken.id);
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user password
      await storage.updateUser(matchedToken.userId, { password: hashedPassword });
      
      // Delete used token
      await storage.deletePasswordResetToken(matchedToken.id);
      
      // Get user for confirmation email
      const user = await storage.getUser(matchedToken.userId);
      
      // Send confirmation email with liquid glass template
      if (user && user.email) {
        const confirmationHtml = createPasswordChangedEmail();
        
        await sendEmail(
          user.email,
          "Your Yearbuk Password Was Changed",
          confirmationHtml
        );
      }
      
      res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { username, password, userType, firstName, middleName, lastName, dateOfBirth, email, phoneNumber } = req.body;
      
      // Require email for verification
      if (!email || !email.trim()) {
        return res.status(400).json({ message: "Email is required for account verification" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Check if email already exists
      const existingUserWithEmail = await storage.getUserByEmail(email.toLowerCase());
      if (existingUserWithEmail) {
        return res.status(400).json({ message: "This email is already registered" });
      }
      
      // Check if phone number already exists (if provided)
      if (phoneNumber && phoneNumber.trim() !== "") {
        const existingUserWithPhone = await storage.getUserByPhoneNumber(phoneNumber);
        if (existingUserWithPhone) {
          return res.status(400).json({ message: "This phone number is already registered with another account" });
        }
      }
      
      // Hash password before storing
      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        username: username.toLowerCase(),
        password: hashedPassword,
        userType,
        firstName: formatTitleCase(firstName),
        middleName: middleName ? formatTitleCase(middleName) : undefined,
        lastName: formatTitleCase(lastName),
        dateOfBirth,
        email: email.toLowerCase(),
        phoneNumber: phoneNumber || undefined,
        profileImage: undefined,
        isEmailVerified: false,
      });
      
      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      
      // Set token expiry to 24 hours from now
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24);
      
      // Update user with verification token and expiry
      await storage.updateUser(user.id, {
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiresAt: tokenExpiry,
      });
      
      const baseUrl = getAppBaseUrl(req);
      const verificationLink = `${baseUrl}/verify-email/${verificationToken}`;
      
      // Send verification email with liquid glass template
      const emailHtml = createVerificationEmail(verificationLink);
      
      console.log('🔔 About to send verification email to:', email.toLowerCase());
      const emailResult = await sendEmail(email.toLowerCase(), "Verify Your Yearbuk Account", emailHtml);
      console.log('🔔 Email send result:', emailResult);
      
      // Return user info (excluding password and token)
      const { password: _, emailVerificationToken: __, ...userInfo } = user;
      res.json({ 
        user: userInfo, 
        message: "Account created successfully. Please check your email to verify your account."
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  // Email verification endpoint
  app.get("/api/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Find user by verification token
      const user = await storage.getUserByVerificationToken(token);
      
      if (!user) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid or expired verification link." 
        });
      }
      
      // Check if token has expired
      if (user.emailVerificationTokenExpiresAt && new Date() > user.emailVerificationTokenExpiresAt) {
        return res.status(400).json({ 
          success: false,
          message: "Verification link has expired. Please request a new one.",
          expired: true
        });
      }
      
      // Check if already verified
      if (user.isEmailVerified) {
        return res.json({ 
          success: true,
          message: "Email already verified. You can now log in.",
          alreadyVerified: true
        });
      }
      
      // Update user - mark as verified and clear token
      await storage.updateUser(user.id, {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      });
      
      res.json({ 
        success: true,
        message: "Email verified successfully! You can now log in." 
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ 
        success: false,
        message: "Verification failed. Please try again." 
      });
    }
  });

  // School email verification endpoint
  app.get("/api/verify-school-email/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Find school by verification token
      const school = await storage.getSchoolByVerificationToken(token);
      
      if (!school) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid or expired verification link." 
        });
      }
      
      // Check if token has expired
      if (school.emailVerificationTokenExpiresAt && new Date() > school.emailVerificationTokenExpiresAt) {
        return res.status(400).json({ 
          success: false,
          message: "Verification link has expired. Please request a new one.",
          expired: true
        });
      }
      
      // Check if already verified
      if (school.isEmailVerified) {
        return res.json({ 
          success: true,
          message: "Email already verified. Your registration is pending approval.",
          alreadyVerified: true
        });
      }
      
      // Update school - mark as verified and clear token
      await storage.updateSchool(school.id, {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      });
      
      // Notify super admin about new verified school pending approval
      const superAdmins = await storage.getSuperAdmins();
      for (const admin of superAdmins) {
        await storage.createNotification({
          userId: admin.id,
          type: 'school_pending_approval',
          title: 'New School Pending Approval',
          message: `${school.name} has verified their email and is awaiting approval.`,
          relatedId: school.id,
        });
      }
      
      res.json({ 
        success: true,
        message: "Email verified successfully! Your registration will be reviewed by our moderation team. Expect a response within 3-5 business days." 
      });
    } catch (error) {
      console.error("School email verification error:", error);
      res.status(500).json({ 
        success: false,
        message: "Verification failed. Please try again." 
      });
    }
  });

  // Resend verification email endpoint with cooldown
  const resendCooldowns = new Map<string, number>(); // Track last resend time by userId
  
  app.post("/api/resend-verification", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId || !userId.trim()) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Find user by ID
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if already verified
      if (user.isEmailVerified) {
        return res.status(400).json({ message: "This email is already verified. You can log in." });
      }
      
      // Check cooldown (50 seconds)
      const lastSentTime = resendCooldowns.get(userId);
      const now = Date.now();
      const cooldownPeriod = 50000; // 50 seconds in milliseconds
      
      if (lastSentTime && (now - lastSentTime) < cooldownPeriod) {
        const remainingTime = Math.ceil((cooldownPeriod - (now - lastSentTime)) / 1000);
        return res.status(429).json({ 
          message: `Please wait ${remainingTime} seconds before requesting another verification email.`,
          remainingTime 
        });
      }
      
      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      
      // Set token expiry to 24 hours from now
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24);
      
      // Update user with new token and expiry (invalidates old token)
      await storage.updateUser(user.id, {
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiresAt: tokenExpiry,
      });
      
      const baseUrl = getAppBaseUrl(req);
      const verificationLink = `${baseUrl}/verify-email/${verificationToken}`;
      
      // Send verification email
      const emailHtml = createVerificationEmail(verificationLink);
      
      await sendEmail(user.email!, "Verify Your Yearbuk Account", emailHtml);
      
      // Update cooldown tracker
      resendCooldowns.set(userId, now);
      
      res.json({ message: "Verification email sent. Please check your inbox." });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to send verification email. Please try again." });
    }
  });

  // School registration route - Creates registration request only, no user account
  app.post("/api/auth/school-register", upload.single('accreditationDocument'), async (req, res) => {
    try {
      const { username, password, schoolName, country, state, city, email, phoneNumber, website, address, yearFounded, registrationNumber } = req.body;
      
      // Log phone number validation for debugging null constraint issues
      if (!phoneNumber) {
        console.error("ERROR: Phone number is missing or null in school registration:", {
          received: phoneNumber,
          type: typeof phoneNumber,
          allFields: Object.keys(req.body)
        });
      }
      
      // Validate required fields
      if (!username || !password || !schoolName || !country || !city || !email || !phoneNumber || !yearFounded) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Check if username already exists (reserved for when account is created)
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Check if school with this email already has a request
      const existingSchool = await storage.getSchoolByEmail(email);
      if (existingSchool) {
        return res.status(400).json({ message: "A school registration with this email already exists" });
      }
      
      // Hash the temporary admin password for secure storage
      const hashedPassword = await hashPassword(password);
      
      // Handle accreditation document upload
      let accreditationDocumentPath = null;
      if (req.file) {
        // Ensure the file was actually saved successfully
        try {
          await fs.access(req.file.path);
          accreditationDocumentPath = req.file.path;
        } catch (err) {
          console.error("File upload failed:", err);
          // Continue with registration without document
        }
      }
      
      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      
      // Set token expiry to 24 hours from now
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24);
      
      // Create school registration request with temporary admin credentials - NO USER ACCOUNT YET
      const school = await storage.createSchool({
        username,
        name: formatTitleCase(schoolName),
        address: address ? formatTitleCase(address) : undefined,
        country,
        state: state || undefined,
        city: formatTitleCase(city),
        email,
        phoneNumber: phoneNumber, // This maps to phone_number column in DB
        website: website || undefined,
        yearFounded: parseInt(yearFounded),
        registrationNumber: registrationNumber || undefined,
        accreditationDocument: accreditationDocumentPath || undefined,
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiresAt: tokenExpiry,
        isEmailVerified: false,
        tempAdminCredentials: {
          username,
          password: hashedPassword,
          firstName: formatTitleCase(schoolName),
          lastName: ""
        } as any
      });
      
       const baseUrl = getAppBaseUrl(req);
      const verificationLink = `${baseUrl}/verify-school-email/${verificationToken}`;
      
      const emailHtml = createSchoolVerificationEmail(verificationLink, schoolName);
      
      await sendEmail(email, "Verify Your Yearbuk School Registration", emailHtml);
      
      res.json({ 
        school: {
          id: school.id,
          name: school.name,
          email: school.email,
          approvalStatus: school.approvalStatus
        },
        message: "Registration submitted! Please check your email to verify your school account." 
      });
    } catch (error) {
      console.error("School registration error:", error);
      res.status(500).json({ message: "School registration failed" });
    }
  });

  // User routes
  // Search users by name or username (for photo tagging) - must be before /api/users/:id
  app.get("/api/users/search", async (req, res) => {
    try {
      const q = (req.query.q as string) || "";
      if (q.trim().length < 1) return res.json([]);
      const results = await storage.searchUsersByName(q);
      res.json(results.map(u => ({ id: u.id, username: u.username, fullName: u.fullName, profileImage: u.profileImage, userType: u.userType })));
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...userInfo } = user;
      res.json(userInfo);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // School routes
  app.get("/api/schools", async (req, res) => {
    try {
      // Only return approved schools for public access (viewer/alumni accounts)
      const schools = await storage.getApprovedSchools();
      res.json(schools);
    } catch (error) {
      res.status(500).json({ message: "Failed to get schools" });
    }
  });

  app.get("/api/schools/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim() === '') {
        return res.json([]);
      }
      const schools = await storage.searchSchools(query.trim());
      res.json(schools);
    } catch (error) {
      console.error("Error searching schools:", error);
      res.status(500).json({ message: "Failed to search schools" });
    }
  });

  // Get public user profile by username
  app.get("/api/users/by-username/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const user = await storage.getUserByUsername(username.toLowerCase());
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Return only public fields
      res.json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        profileImage: user.profileImage,
        userType: user.userType,
      });
    } catch (error) {
      console.error("Error fetching user by username:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Get the complete public school profile by username.
  // The frontend profile pages consume school, yearbooks, and memories together.
  app.get("/api/schools/profile-by-username/:username", async (req, res) => {
    try {
      const username = decodeURIComponent(req.params.username).trim().toLowerCase();
      const school = await storage.getSchoolByUsername(username);

      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      const [yearbooks, memories] = await Promise.all([
        storage.getYearbooksBySchool(school.id),
        storage.getMemoriesBySchool(school.id),
      ]);

      res.json({ school, yearbooks, memories });
    } catch (error) {
      console.error("Error fetching school profile by username:", error);
      res.status(500).json({ message: "Failed to get school profile" });
    }
  });

  app.get("/api/schools/by-username/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const school = await storage.getSchoolByUsername(username);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      res.json(school);
    } catch (error) {
      console.error("Error fetching school by username:", error);
      res.status(500).json({ message: "Failed to get school" });
    }
  });

  // School gallery image routes
  app.get("/api/schools/:schoolId/gallery", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const images = await storage.getSchoolGalleryImages(schoolId);
      res.json(images);
    } catch (error) {
      console.error("Error fetching school gallery images:", error);
      res.status(500).json({ message: "Failed to get gallery images" });
    }
  });

  app.post("/api/schools/:schoolId/gallery", upload.single('galleryImage'), async (req, res) => {
    try {
      const { schoolId } = req.params;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No image uploaded" });
      }

      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Verify access to the school
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      const { title, description } = req.body;
      
      // Get next display order
      const existingImages = await storage.getSchoolGalleryImages(schoolId);
      const nextDisplayOrder = existingImages.length;

      const imageData = {
        schoolId,
        imageUrl: `/uploads/memories/${file.filename}`, // Now correctly matches upload destination
        title: title || null,
        description: description || null,
        displayOrder: nextDisplayOrder,
        isActive: true
      };

      // Validate the data
      const validatedData = insertSchoolGalleryImageSchema.parse(imageData);
      const galleryImage = await storage.addSchoolGalleryImage(validatedData);
      
      res.status(201).json({ ...galleryImage, message: "Gallery image uploaded successfully!" });
    } catch (error) {
      console.error("Error creating gallery image:", error);
      res.status(500).json({ message: "Failed to upload gallery image" });
    }
  });

  app.patch("/api/schools/:schoolId/gallery/:imageId", async (req, res) => {
    try {
      const { schoolId, imageId } = req.params;
      
      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Verify access to the school
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      // Validate updates and whitelist allowed fields to prevent schoolId tampering
      const allowedUpdates = ['title', 'description', 'displayOrder', 'isActive'];
      const updates = {};
      for (const [key, value] of Object.entries(req.body)) {
        if (allowedUpdates.includes(key)) {
          updates[key] = value;
        }
      }
      
      const updatedImage = await storage.updateSchoolGalleryImage(imageId, schoolId, updates);
      
      if (!updatedImage) {
        return res.status(404).json({ message: "Gallery image not found" });
      }
      
      res.json(updatedImage);
    } catch (error) {
      console.error("Error updating gallery image:", error);
      res.status(500).json({ message: "Failed to update gallery image" });
    }
  });

  app.delete("/api/schools/:schoolId/gallery/:imageId", async (req, res) => {
    try {
      const { schoolId, imageId } = req.params;
      
      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Verify access to the school
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      const success = await storage.deleteSchoolGalleryImage(imageId, schoolId);
      
      if (!success) {
        return res.status(404).json({ message: "Gallery image not found" });
      }
      
      res.json({ message: "Gallery image deleted successfully" });
    } catch (error) {
      console.error("Error deleting gallery image:", error);
      res.status(500).json({ message: "Failed to delete gallery image" });
    }
  });

  app.post("/api/schools/:schoolId/gallery/reorder", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { imageOrders } = req.body;
      
      if (!Array.isArray(imageOrders)) {
        return res.status(400).json({ message: "imageOrders must be an array" });
      }

      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Verify access to the school
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      const success = await storage.reorderSchoolGalleryImages(schoolId, imageOrders);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to reorder images" });
      }
      
      res.json({ message: "Gallery images reordered successfully" });
    } catch (error) {
      console.error("Error reordering gallery images:", error);
      res.status(500).json({ message: "Failed to reorder gallery images" });
    }
  });
  app.get("/api/alumni-badges/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const badges = await storage.getAlumniBadgesByUser(userId);
      res.json(badges);
    } catch (error) {
      console.error("Error fetching alumni badges:", error);
      res.status(500).json({ message: "Failed to get alumni badges" });
    }
  });

  // Get alumni badges by school
  app.get("/api/alumni-badges/school/:schoolId", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const badges = await storage.getAlumniBadgesBySchool(schoolId);
      res.json(badges);
    } catch (error) {
      console.error("Error fetching alumni badges by school:", error);
      res.status(500).json({ message: "Failed to get alumni badges" });
    }
  });



  // Create alumni badge request
  app.post("/api/alumni-badges", async (req, res) => {
    try {
      const { userId, school, admissionYear, graduationYear } = req.body;
      
      if (!userId || !school || !admissionYear || !graduationYear) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get user information for fullName
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const badge = await storage.createAlumniBadge({
        userId,
        school,
        fullName: user.fullName,
        admissionYear,
        graduationYear,
        status: "pending"
      });

      res.status(201).json(badge);
    } catch (error) {
      console.error("Error creating alumni badge:", error);
      res.status(500).json({ message: "Failed to create alumni badge request" });
    }
  });

  // Delete alumni badge
  app.delete("/api/alumni-badges/:badgeId", async (req, res) => {
    try {
      const { badgeId } = req.params;
      
      // Get badge info before deletion for blocking and sync deletion
      const allBadges = await storage.getAlumniBadges();
      const badgeToDelete = allBadges.find(b => b.id === badgeId);
      
      if (!badgeToDelete) {
        return res.status(404).json({ message: "Alumni badge not found" });
      }
      
      // Delete the badge
      const success = await storage.deleteAlumniBadge(badgeId);
      
      if (!success) {
        return res.status(404).json({ message: "Failed to delete alumni badge" });
      }
      
      // Delete the corresponding alumni request if it exists (synchronized deletion)
      if (badgeToDelete.alumniRequestId) {
        await storage.deleteAlumniRequest(badgeToDelete.alumniRequestId);
      }
      
      // Create 3-month block if badge was deleted
      const blockedUntil = new Date();
      blockedUntil.setMonth(blockedUntil.getMonth() + 3);
      
      // Find school by name to get schoolId
      const schools = await storage.getSchools();
      const school = schools.find(s => s.name === badgeToDelete.school);
      
      if (school) {
        await storage.createAlumniRequestBlock({
          userId: badgeToDelete.userId,
          schoolId: school.id,
          blockedUntil,
          reason: "badge_deleted"
        });
      }
      
      res.json({ message: "Alumni badge deleted successfully" });
    } catch (error) {
      console.error("Error deleting alumni badge:", error);
      res.status(500).json({ message: "Failed to delete alumni badge" });
    }
  });

  // Purchase additional badge slots
  app.post("/api/alumni-badges/purchase-slots", async (req, res) => {
    try {
      const { userId, numberOfSlots } = req.body;

      if (!userId || !numberOfSlots || numberOfSlots < 1) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate new badge slots
      const currentSlots = user.badgeSlots || 4;
      const newSlots = currentSlots + numberOfSlots;

      // Update user's badge slots
      const updated = await storage.updateUser(userId, { badgeSlots: newSlots });

      if (!updated) {
        return res.status(500).json({ message: "Failed to update badge slots" });
      }

      res.json({ 
        message: `Successfully added ${numberOfSlots} badge slot(s)`,
        badgeSlots: newSlots
      });
    } catch (error) {
      console.error("Error purchasing badge slots:", error);
      res.status(500).json({ message: "Failed to purchase badge slots" });
    }
  });

  // Get all students from a school (for alumni search)
  app.get("/api/students/:schoolId/search", async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      // Get the school to find its name
      const school = await storage.getSchoolById(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Get all verified alumni badges for this school
      const badges = await storage.getAlumniBadgesBySchool(schoolId);
      const verifiedBadges = badges.filter(badge => badge.status === 'verified');
      
      // Transform badges into student objects
      const students = await Promise.all(verifiedBadges.map(async badge => {
        const user = await storage.getUserById(badge.userId);
        return {
          id: badge.userId,
          fullName: badge.fullName,
          graduationYear: badge.graduationYear,
          admissionYear: badge.admissionYear,
          school: badge.school,
          email: badge.email || user?.email,
          phoneNumber: badge.phoneNumber || user?.phoneNumber,
          showPhoneToAlumni: user?.showPhoneToAlumni
        };
      }));
      
      res.json(students);
    } catch (error) {
      console.error("Error fetching students by school:", error);
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  // Get students from a school by graduation year
  app.get("/api/students/:schoolId/:graduationYear", async (req, res) => {
    try {
      const { schoolId, graduationYear } = req.params;
      
      // Get the school to find its name
      const school = await storage.getSchoolById(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Get all verified alumni badges for this school
      const badges = await storage.getAlumniBadgesBySchool(schoolId);
      const verifiedBadges = badges.filter(badge => 
        badge.status === 'verified' && badge.graduationYear === graduationYear
      );
      
      // Transform badges into student objects
      const students = await Promise.all(verifiedBadges.map(async badge => {
        const user = await storage.getUserById(badge.userId);
        return {
          id: badge.userId,
          fullName: badge.fullName,
          graduationYear: badge.graduationYear,
          admissionYear: badge.admissionYear,
          school: badge.school,
          email: badge.email || user?.email,
          phoneNumber: badge.phoneNumber || user?.phoneNumber,
          showPhoneToAlumni: user?.showPhoneToAlumni
        };
      }));
      
      res.json(students);
    } catch (error) {
      console.error("Error fetching students by graduation year:", error);
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  // Alumni request routes
  app.get("/api/alumni-requests/school/:schoolId", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const requests = await storage.getAlumniRequestsBySchool(schoolId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching alumni requests:", error);
      res.status(500).json({ message: "Failed to get alumni requests" });
    }
  });

  // Get count of pending alumni requests for a school
  app.get("/api/alumni-requests/school/:schoolId/count", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const requests = await storage.getAlumniRequestsBySchool(schoolId);
      const pendingCount = requests.filter(r => r.status === 'pending').length;
      res.json({ count: pendingCount });
    } catch (error) {
      console.error("Error fetching alumni request count:", error);
      res.status(500).json({ message: "Failed to get alumni request count" });
    }
  });

  // Get count of pending memories for a school
  app.get("/api/memories/school/:schoolId/pending-count", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const pendingMemories = await storage.getPendingMemoriesBySchool(schoolId);
      const count = pendingMemories.length;
      res.json({ count });
    } catch (error) {
      console.error("Error fetching pending memories count:", error);
      res.status(500).json({ message: "Failed to get pending memories count" });
    }
  });

  app.post("/api/alumni-requests", async (req, res) => {
    try {
      const requestData = req.body;
      
      if (!requestData.userId || !requestData.schoolId || !requestData.fullName || !requestData.admissionYear || !requestData.graduationYear) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check for existing alumni request for the same school (duplicate prevention)
      const hasExistingRequest = await storage.hasExistingAlumniRequest(requestData.userId, requestData.schoolId);
      if (hasExistingRequest) {
        const school = await storage.getSchool(requestData.schoolId);
        const errorMessage = "You already have a pending alumni request for this school";
        
        // Create notification for user about duplicate request
        await storage.createNotification({
          userId: requestData.userId,
          type: "alumni_request_duplicate",
          title: "Duplicate Alumni Request",
          message: `${errorMessage}${school ? ` (${school.name})` : ''}. Please wait for your existing request to be reviewed.`,
          isRead: false,
          relatedId: requestData.schoolId,
        });
        
        return res.status(400).json({ message: errorMessage });
      }

      // Check for request blocks (3-month blocking after badge deletion)
      const blocks = await storage.getAlumniRequestBlocks(requestData.userId, requestData.schoolId);
      if (blocks.length > 0) {
        const latestBlock = blocks[0];
        const blockedUntilDate = new Date(latestBlock.blockedUntil).toLocaleDateString();
        const errorMessage = `You cannot make alumni requests to this school until ${blockedUntilDate}`;
        
        // Create notification for user about the block
        const school = await storage.getSchool(requestData.schoolId);
        await storage.createNotification({
          userId: requestData.userId,
          type: "alumni_request_blocked",
          title: "Alumni Request Blocked",
          message: `${errorMessage}. This restriction is due to a previous badge deletion.`,
          isRead: false,
          relatedId: latestBlock.id,
        });
        
        return res.status(400).json({ 
          message: errorMessage
        });
      }

      // Check for existing badge from same school (prevent duplicates)
      const school = await storage.getSchool(requestData.schoolId);
      if (school) {
        const existingBadges = await storage.getAlumniBadgesByUser(requestData.userId);
        const duplicateSchoolBadge = existingBadges.find(badge => badge.school === school.name);
        if (duplicateSchoolBadge) {
          const errorMessage = `You already have an alumni badge for ${school.name}. You cannot have multiple badges from the same school.`;
          
          // Create notification for user about duplicate badge
          await storage.createNotification({
            userId: requestData.userId,
            type: "alumni_badge_duplicate",
            title: "Duplicate Alumni Badge",
            message: errorMessage,
            isRead: false,
            relatedId: school.id,
          });
          
          return res.status(400).json({ message: errorMessage });
        }

        // Check badge limit based on user's purchased badge slots
        const user = await storage.getUser(requestData.userId);
        const maxBadgeSlots = user?.badgeSlots || 4;
        if (existingBadges.length >= maxBadgeSlots) {
          const errorMessage = `You have reached the maximum number of alumni badges (${maxBadgeSlots}). Please upgrade your account to add more alumni statuses.`;
          
          // Create notification for user about badge limit
          await storage.createNotification({
            userId: requestData.userId,
            type: "alumni_badge_limit",
            title: "Alumni Badge Limit Reached",
            message: errorMessage,
            isRead: false,
            relatedId: null,
          });
          
          return res.status(400).json({ message: errorMessage });
        }
      }

      // Check rate limiting (max 10 requests per week)
      const recentRequests = await storage.getAlumniRequestsInLastWeek(requestData.userId);
      if (recentRequests.length >= 10) {
        const errorMessage = "You've made too many requests, try again later";
        
        // Create notification for user about rate limit
        await storage.createNotification({
          userId: requestData.userId,
          type: "alumni_request_rate_limit",
          title: "Too Many Alumni Requests",
          message: `${errorMessage}. Maximum 10 requests per week allowed. Please wait before submitting more requests.`,
          isRead: false,
          relatedId: null,
        });
        
        return res.status(429).json({ message: errorMessage });
      }

      const request = await storage.createAlumniRequest(requestData);
      
      // Create notification for school admin about new alumni request
      if (school?.adminUserId) {
        const user = await storage.getUser(requestData.userId);
        await storage.createNotification({
          userId: school.adminUserId,
          type: "alumni_request_new",
          title: "New Alumni Verification Request",
          message: `${user?.fullName || 'A user'} has requested alumni verification for ${requestData.graduationYear}`,
          isRead: false,
          relatedId: request.id,
        });
      }
      
      // Create a pending badge immediately when request is sent
      if (school) {
        // Get user information for fullName
        const user = await storage.getUser(requestData.userId);
        console.log('Looking up user with ID:', requestData.userId, 'Found:', !!user);
        if (user) {
          await storage.createAlumniBadge({
            userId: requestData.userId,
            school: school.name,
            fullName: user.fullName,
            admissionYear: requestData.admissionYear,
            graduationYear: requestData.graduationYear,
            status: "pending"
          });
        } else {
          console.error('User not found for ID:', requestData.userId);
          return res.status(400).json({ message: "User not found for alumni badge creation" });
        }
      }
      
      // Create notification for the user
      await storage.createNotification({
        userId: requestData.userId,
        type: "alumni_request_sent",
        title: "Alumni Status Request Sent",
        message: `Alumni status request successfully sent to ${school?.name || 'the school'}`,
        isRead: false,
        relatedId: request.id,
      });
      
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating alumni request:", error);
      res.status(500).json({ message: "Failed to create alumni request" });
    }
  });

  app.patch("/api/alumni-requests/:requestId/approve", async (req, res) => {
    try {
      const { requestId } = req.params;
      const { reviewedBy, reviewNotes } = req.body;
      
      // Get the request first before updating
      const request = await storage.getAlumniRequestById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Alumni request not found" });
      }

      // Update the existing pending badge to verified status
      const school = await storage.getSchool(request.schoolId);
      if (school) {
        const userBadges = await storage.getAlumniBadgesByUser(request.userId);
        const pendingBadge = userBadges.find(badge => 
          badge.school === school.name && 
          badge.status === 'pending' &&
          badge.admissionYear === request.admissionYear &&
          badge.graduationYear === request.graduationYear
        );
        
        if (pendingBadge) {
          await storage.updateAlumniBadgeStatus(pendingBadge.id, "verified");
        }
      }

      // Create notification for the user
      await storage.createNotification({
        userId: request.userId,
        type: "alumni_approved",
        title: "Alumni Status Approved!",
        message: `Your alumni status request has been approved. You now have alumni access to memories and content.`,
        isRead: false,
        relatedId: requestId,
      });

      // Create confirmation notification for school admin
      if (school?.adminUserId) {
        const user = await storage.getUser(request.userId);
        await storage.createNotification({
          userId: school.adminUserId,
          type: "alumni_approved_confirmation",
          title: "Alumni Request Approved",
          message: `You approved ${user?.fullName || 'an alumni'}'s request`,
          isRead: false,
          relatedId: requestId,
        });
      }

      // Update request status to approved (keep for history)
      const updatedRequest = await storage.updateAlumniRequestStatus(requestId, "approved", reviewedBy, reviewNotes);
      
      res.json({ message: "Alumni request approved successfully", request: updatedRequest });
    } catch (error) {
      console.error("Error approving alumni request:", error);
      res.status(500).json({ message: "Failed to approve alumni request" });
    }
  });

  app.patch("/api/alumni-requests/:requestId/deny", async (req, res) => {
    try {
      const { requestId } = req.params;
      const { reviewedBy, reviewNotes } = req.body;
      
      const updatedRequest = await storage.updateAlumniRequestStatus(requestId, "denied", reviewedBy, reviewNotes);
      
      if (!updatedRequest) {
        return res.status(404).json({ message: "Alumni request not found" });
      }

      // Delete the pending badge since request was denied
      const request = await storage.getAlumniRequestById(requestId);
      if (request) {
        const school = await storage.getSchool(request.schoolId);
        
        // Find and delete the pending badge
        if (school) {
          const userBadges = await storage.getAlumniBadgesByUser(request.userId);
          const pendingBadge = userBadges.find(badge => 
            badge.school === school.name && 
            badge.status === 'pending' &&
            badge.admissionYear === request.admissionYear &&
            badge.graduationYear === request.graduationYear
          );
          
          if (pendingBadge) {
            await storage.deleteAlumniBadge(pendingBadge.id);
          }
        }

        // Create notification for the user
        await storage.createNotification({
          userId: request.userId,
          type: "alumni_denied",
          title: "Alumni Status Denied",
          message: `Your alumni request to ${school?.name || 'the school'} has been denied.${reviewNotes ? ` Reason: ${reviewNotes}` : ''}`,
          isRead: false,
          relatedId: requestId,
        });

        // Create confirmation notification for school admin
        if (school?.adminUserId) {
          const user = await storage.getUser(request.userId);
          await storage.createNotification({
            userId: school.adminUserId,
            type: "alumni_denied_confirmation",
            title: "Alumni Request Denied",
            message: `You denied ${user?.fullName || 'a user'}'s alumni request`,
            isRead: false,
            relatedId: requestId,
          });
        }
      }
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Error denying alumni request:", error);
      res.status(500).json({ message: "Failed to deny alumni request" });
    }
  });

  // Notification routes
  app.get("/api/notifications/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Automatically cleanup old notifications (30 days) when fetching
      await storage.deleteOldNotifications(30);
      
      const notifications = await storage.getNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.patch("/api/notifications/:notificationId/read", async (req, res) => {
    try {
      const { notificationId } = req.params;
      const success = await storage.markNotificationAsRead(notificationId);
      
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.delete("/api/notifications/user/:userId/clear-all", async (req, res) => {
    try {
      const { userId } = req.params;
      const count = await storage.clearAllNotifications(userId);
      res.json({ message: "All notifications cleared", count });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      res.status(500).json({ message: "Failed to clear notifications" });
    }
  });

  app.post("/api/notifications/cleanup", async (req, res) => {
    try {
      const daysOld = 30; // Delete notifications older than 30 days
      const count = await storage.deleteOldNotifications(daysOld);
      res.json({ message: `Deleted ${count} old notifications` });
    } catch (error) {
      console.error("Error cleaning up notifications:", error);
      res.status(500).json({ message: "Failed to cleanup old notifications" });
    }
  });
  




  
  app.get("/api/schools/:id", async (req, res) => {
    try {
      // First try to get school directly by ID
      let school = await storage.getSchool(req.params.id);
      
      // If not found, try to get school by admin user ID
      if (!school) {
        school = await storage.getSchoolByAdminUserId(req.params.id);
      }
      
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      res.json(school);
    } catch (error) {
      console.error("Error in /api/schools/:id:", error);
      res.status(500).json({ message: "Failed to get school" });
    }
  });

  // Update school profile
  app.patch("/api/schools/:id", async (req, res) => {
    try {
      const { address, state, email, city, website, name, motto, aboutDescription } = req.body;
      const schoolId = req.params.id;
      
      // Validate that only optional fields are being updated
      const updateData: any = {};
      if (address !== undefined) updateData.address = address;
      if (state !== undefined) updateData.state = state;
      if (email !== undefined) updateData.email = email;
      if (city !== undefined) updateData.city = city;
      if (website !== undefined) updateData.website = website;
      if (motto !== undefined) updateData.motto = motto;
      if (aboutDescription !== undefined) updateData.aboutDescription = aboutDescription;
      
      // Handle school name change with 30-day restriction
      if (name !== undefined) {
        const school = await storage.getSchoolById(schoolId);
        
        if (!school) {
          return res.status(404).json({ message: "School not found" });
        }
        
        // Check if 30-day restriction applies
        if (school.lastSchoolNameChange) {
          const lastChange = new Date(school.lastSchoolNameChange);
          const now = new Date();
          const daysSinceLastChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceLastChange < 30) {
            const daysRemaining = Math.ceil(30 - daysSinceLastChange);
            return res.status(400).json({ 
              message: `School name can only be changed once every 30 days. Please wait ${daysRemaining} more day${daysRemaining === 1 ? '' : 's'}.` 
            });
          }
        }
        
        updateData.name = name;
        updateData.lastSchoolNameChange = new Date();
      }
      
      const updatedSchool = await storage.updateSchoolProfile(schoolId, updateData);
      
      if (!updatedSchool) {
        return res.status(404).json({ message: "School not found" });
      }
      
      res.json(updatedSchool);
    } catch (error) {
      console.error("Error updating school profile:", error);
      res.status(500).json({ message: "Failed to update school profile" });
    }
  });

  // Upload school banner endpoint
  app.post("/api/schools/:id/banner", upload.single('schoolBanner'), async (req, res) => {
    try {
      const schoolId = req.params.id;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || user.userType !== 'school') {
        return res.status(403).json({ message: 'Only school administrators can upload banners' });
      }
      
      const school = await storage.getSchoolById(schoolId);
      if (!school || school.id !== user.schoolId) {
        if (user.userType !== 'super_admin') {
          return res.status(403).json({ message: 'You can only upload banners for your own school' });
        }
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No banner file uploaded" });
      }
      
      const bannerPath = req.file.path;
      const uploadedFilePath = path.join(process.cwd(), bannerPath);
      
      // Get the school to check for existing banner
      const existingSchool = await storage.getSchoolById(schoolId);
      
      if (!existingSchool) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Delete old banner from Cloudinary if exists
      if (existingSchool.coverPhotoCloudinaryId) {
        await deleteFromCloudinary(existingSchool.coverPhotoCloudinaryId);
      }
      
      let bannerUrl = bannerPath;
      let cloudinaryPublicId = null;
      
      // Try to upload to Cloudinary
      try {
        const cloudinaryResult = await uploadToCloudinary(
          uploadedFilePath,
          `schools/${schoolId}/banner`,
          {
            public_id: `banner_${schoolId}_${Date.now()}`,
            overwrite: true
          }
        );
        bannerUrl = cloudinaryResult.secureUrl;
        cloudinaryPublicId = cloudinaryResult.publicId;
        // Clean up local file after successful upload
        await fs.unlink(uploadedFilePath);
      } catch (error) {
        console.error('Failed to upload banner to Cloudinary, using local file:', error);
        // Keep local file as fallback
      }
      
      // Update school with new banner
      const updatedSchool = await storage.updateSchoolBanner(schoolId, bannerUrl, cloudinaryPublicId);
      
      if (!updatedSchool) {
        return res.status(404).json({ message: "School not found" });
      }
      
      res.json({ 
        message: "Banner uploaded successfully",
        bannerUrl: bannerUrl.startsWith('http') ? bannerUrl : `/public/${bannerUrl}`,
        school: updatedSchool
      });
    } catch (error) {
      console.error("Error uploading school banner:", error);
      res.status(500).json({ message: "Failed to upload school banner" });
    }
  });

  // Upload school logo endpoint
  app.post("/api/schools/:id/logo", upload.single('schoolLogo'), async (req, res) => {
    try {
      const schoolId = req.params.id;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }
      
      // For school admins, verify they can access the specified school
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No logo file uploaded" });
      }
      
      const logoPath = req.file.path;
      const uploadedFilePath = path.join(process.cwd(), logoPath);
      
      // Get the school to check for existing logo
      const existingSchool = await storage.getSchoolById(schoolId);
      
      if (!existingSchool) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Delete old logo from Cloudinary if exists
      if (existingSchool.logoCloudinaryId) {
        await deleteFromCloudinary(existingSchool.logoCloudinaryId);
      }
      // Delete old local logo file if it exists
      if (existingSchool.logo && !existingSchool.logo.includes('cloudinary.com')) {
        try {
          await fs.unlink(existingSchool.logo);
          console.log(`Deleted old logo: ${existingSchool.logo}`);
        } catch (error) {
          console.log(`Could not delete old logo: ${existingSchool.logo}`, error);
        }
      }
      
      // Upload to Cloudinary with organized folder structure
      let logoUrl = logoPath;
      let cloudinaryPublicId: string | null = null;
      
      try {
        // Generate organized folder path
        const folderPath = generateFolderPath(
          existingSchool.name,
          existingSchool.schoolCode,
          'logo'
        );
        
        const cloudinaryResult = await uploadToCloudinary(
          uploadedFilePath,
          folderPath
        );
        logoUrl = cloudinaryResult.secureUrl;
        cloudinaryPublicId = cloudinaryResult.publicId;
        // Clean up local file after successful upload
        await fs.unlink(uploadedFilePath);
      } catch (error) {
        console.error('Failed to upload logo to Cloudinary, using local file:', error);
        // Keep local file as fallback
      }
      
      // Update school with new logo
      const updatedSchool = await storage.updateSchoolLogo(schoolId, logoUrl, cloudinaryPublicId);
      
      if (!updatedSchool) {
        return res.status(404).json({ message: "School not found" });
      }
      
      res.json({ 
        message: "Logo uploaded successfully",
        logoUrl: logoUrl.startsWith('http') ? logoUrl : `/public/${logoUrl}`,
        school: updatedSchool
      });
    } catch (error) {
      console.error("Error uploading school logo:", error);
      res.status(500).json({ message: "Failed to upload school logo" });
    }
  });

  // Get public school profile with yearbooks and memories (by schoolId - legacy)
  app.get("/api/schools/profile/:schoolId", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const school = await storage.getSchool(schoolId);
      
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Get published yearbooks for this school with front covers from yearbook_pages
      const publishedYearbooks = await storage.getAllPublishedYearbooks(schoolId);
      
      // Get approved memories for this school
      const allMemories = await storage.getMemoriesBySchool(schoolId);
      const approvedMemories = allMemories
        .filter(m => m.status === 'approved')
        .slice(0, 20) // Limit to 20 most recent
        .map(m => ({
          id: m.id,
          title: m.title,
          imageUrl: m.imageUrl,
          eventDate: m.eventDate,
          year: m.year
        }));
      
      // Return public school info
      res.json({
        school: {
          id: school.id,
          username: school.username,
          name: school.name,
          logo: school.logo,
          coverPhoto: school.coverPhoto,
          motto: school.motto,
          aboutDescription: school.aboutDescription,
          city: school.city,
          country: school.country,
          yearFounded: school.yearFounded,
          website: school.website
        },
        yearbooks: publishedYearbooks,
        memories: approvedMemories
      });
    } catch (error) {
      console.error("Error fetching school profile:", error);
      res.status(500).json({ message: "Failed to fetch school profile" });
    }
  });

  // Get public school profile by username with yearbooks and memories
  app.get("/api/schools/profile-by-username/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const school = await storage.getSchoolByUsername(username);
      
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Get published yearbooks for this school with front covers from yearbook_pages
      const publishedYearbooks = await storage.getAllPublishedYearbooks(school.id);
      
      // Get approved memories for this school
      const allMemories = await storage.getMemoriesBySchool(school.id);
      const approvedMemories = allMemories
        .filter(m => m.status === 'approved')
        .slice(0, 20) // Limit to 20 most recent
        .map(m => ({
          id: m.id,
          title: m.title,
          imageUrl: m.imageUrl,
          eventDate: m.eventDate,
          year: m.year
        }));
      
      // Return public school info
      res.json({
        school: {
          id: school.id,
          username: school.username,
          name: school.name,
          logo: school.logo,
          coverPhoto: school.coverPhoto,
          motto: school.motto,
          aboutDescription: school.aboutDescription,
          city: school.city,
          country: school.country,
          state: school.state,
          address: school.address,
          yearFounded: school.yearFounded,
          website: school.website
        },
        yearbooks: publishedYearbooks,
        memories: approvedMemories
      });
    } catch (error) {
      console.error("Error fetching school profile by username:", error);
      res.status(500).json({ message: "Failed to fetch school profile" });
    }
  });

  // Get school stats (memories, yearbooks, alumni counts)
  app.get("/api/schools/:schoolId/stats", async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      // Get memories count
      const allMemories = await storage.getMemoriesBySchool(schoolId);
      const memoriesCount = allMemories.filter(m => m.status === 'approved').length;
      
      // Get yearbooks count
      const yearbooks = await storage.getYearbooksBySchool(schoolId);
      const yearbooksCount = yearbooks.filter(yb => yb.isPublished).length;
      
      // Get alumni count (verified badges only)
      const alumniBadges = await storage.getAlumniBadgesBySchool(schoolId);
      const alumniCount = alumniBadges.filter(badge => badge.status === 'verified').length;
      
      res.json({
        memoriesCount,
        yearbooksCount,
        alumniCount
      });
    } catch (error) {
      console.error("Error fetching school stats:", error);
      res.status(500).json({ message: "Failed to fetch school stats" });
    }
  });

  // Get verified alumni for a school with user details
  app.get("/api/schools/:schoolId/alumni", async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      // Get all alumni badges for this school
      const alumniBadges = await storage.getAlumniBadgesBySchool(schoolId);
      
      // Filter for verified alumni only and format response
      const verifiedAlumni = alumniBadges
        .filter(badge => badge.status === 'verified')
        .map(badge => ({
          id: badge.id,
          userId: badge.userId,
          fullName: badge.fullName,
          graduationYear: badge.graduationYear,
          admissionYear: badge.admissionYear,
          profileImage: badge.profileImage,
          email: badge.email,
          phoneNumber: badge.phoneNumber,
          showPhoneToAlumni: badge.showPhoneToAlumni
        }));
      
      res.json(verifiedAlumni);
    } catch (error) {
      console.error("Error fetching school alumni:", error);
      res.status(500).json({ message: "Failed to fetch school alumni" });
    }
  });

  // Get all approved memories for a school (for memories tab)
  app.get("/api/schools/:schoolId/memories-all", async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      const allMemories = await storage.getMemoriesBySchool(schoolId);
      const approvedMemories = allMemories
        .filter(m => m.status === 'approved')
        .map(m => ({
          id: m.id,
          title: m.title,
          description: m.description,
          imageUrl: m.imageUrl,
          cloudinaryPublicId: m.cloudinaryPublicId,
          eventDate: m.eventDate,
          year: m.year,
          category: m.category
        }));
      
      res.json(approvedMemories);
    } catch (error) {
      console.error("Error fetching school memories:", error);
      res.status(500).json({ message: "Failed to fetch school memories" });
    }
  });

  // Get all published yearbooks for a school (for yearbooks tab)
  app.get("/api/schools/:schoolId/yearbooks-all", async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      const yearbooks = await storage.getYearbooksBySchool(schoolId);
      const publishedYearbooks = await Promise.all(
        yearbooks
          .filter(yb => yb.isPublished)
          .map(async (yb) => {
            // Fetch front and back cover pages from yearbook_pages table
            const pages = await storage.getYearbookPages(yb.id);
            const frontCoverPage = pages.find(p => p.pageType === "front_cover");
            const backCoverPage = pages.find(p => p.pageType === "back_cover");
            
            return {
              id: yb.id,
              year: yb.year,
              title: yb.title,
              // Use page imageUrl if available, otherwise fall back to legacy column
              frontCoverUrl: frontCoverPage?.imageUrl || yb.frontCoverUrl,
              backCoverUrl: backCoverPage?.imageUrl || yb.backCoverUrl,
              isFree: yb.isFree,
              price: yb.price,
              orientation: yb.orientation,
              uploadType: yb.uploadType
            };
          })
      );
      
      res.json(publishedYearbooks);
    } catch (error) {
      console.error("Error fetching school yearbooks:", error);
      res.status(500).json({ message: "Failed to fetch school yearbooks" });
    }
  });

  // Get login activity for a user
  app.get("/api/users/:userId/login-activity", async (req, res) => {
    try {
      const { userId } = req.params;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const requestingUserId = authHeader.substring(7);
      
      // Users can only view their own login activity
      if (requestingUserId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activities = await storage.getLoginActivitiesByUser(userId, limit);
      
      res.json(activities);
    } catch (error) {
      console.error("Error fetching login activity:", error);
      res.status(500).json({ message: "Failed to fetch login activity" });
    }
  });

  // Get most recent login for a user
  app.get("/api/users/:userId/recent-login", async (req, res) => {
    try {
      const { userId } = req.params;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const requestingUserId = authHeader.substring(7);
      
      // Users can only view their own login activity
      if (requestingUserId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const recentLogin = await storage.getMostRecentLogin(userId);
      
      if (!recentLogin) {
        return res.status(404).json({ message: "No login activity found" });
      }
      
      res.json(recentLogin);
    } catch (error) {
      console.error("Error fetching recent login:", error);
      res.status(500).json({ message: "Failed to fetch recent login" });
    }
  });

  // Check username availability
  app.post("/api/users/check-username", async (req, res) => {
    try {
      const { username, currentUserId } = req.body;
      
      if (!username) {
        return res.status(400).json({ 
          available: false, 
          message: "Username is required" 
        });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      
      if (existingUser) {
        // If it's the current user's own username, it's available for them
        if (currentUserId && existingUser.id === currentUserId) {
          return res.json({ 
            available: true, 
            message: "This is your current username" 
          });
        }
        
        return res.json({ 
          available: false, 
          message: "Username is already taken" 
        });
      }
      
      // Username is available
      res.json({ 
        available: true, 
        message: "Username is available" 
      });
    } catch (error) {
      console.error("Error checking username availability:", error);
      res.status(500).json({ 
        available: false, 
        message: "Failed to check username availability" 
      });
    }
  });

  // Update user profile (email, username, fullName, password) - MUST come before /api/users/:id
  app.patch("/api/users/profile", async (req, res) => {
    try {
      const { email, username, fullName, currentPassword, newPassword } = req.body;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization required' });
      }
      
      const userId = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Get current user
      const currentUser = await storage.getUserById(userId);
      
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // If changing password, verify current password
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: "Current password required" });
        }
        
        // Here we would typically hash the currentPassword and compare with stored hash
        // For now, assuming the storage layer handles password verification
        if (currentUser.password !== currentPassword) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
      }
      
      // Prepare update data
      const updateData: any = {};
      if (email !== undefined) updateData.email = email;
      if (username !== undefined) updateData.username = username;
      if (fullName !== undefined) updateData.fullName = fullName;
      if (newPassword !== undefined) updateData.password = newPassword;
      
      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        // Return current user data unchanged
        const { password, ...safeUser } = currentUser;
        return res.json(safeUser);
      }
      
      const updatedUser = await storage.updateUserProfile(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return user without password
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Update user privacy settings and profile
  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { showPhoneToAlumni, phoneNumber, username, fullName } = req.body;
      const userId = req.params.id;
      
      // Validate that only allowed fields are being updated
      const updateData: any = {};
      if (showPhoneToAlumni !== undefined) updateData.showPhoneToAlumni = showPhoneToAlumni;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (fullName !== undefined) {
        const normalizedFullName = typeof fullName === "string" ? fullName.trim() : "";
        if (!normalizedFullName) {
          return res.status(400).json({ message: "Name cannot be empty" });
        }
        updateData.fullName = normalizedFullName;
      }
      
      // Handle username update separately with validation
      if (username !== undefined) {
        const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : "";
        if (normalizedUsername.length < 3) {
          return res.status(400).json({ message: "Username must be at least 3 characters" });
        }
        
        const currentUser = await storage.getUserById(userId);
        if (!currentUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Do not consume the cooldown when the username was not changed.
        if (normalizedUsername === currentUser.username) {
          delete updateData.username;
        } else {
          // Check if username is already taken by another user
          const existingUser = await storage.getUserByUsername(normalizedUsername);
          if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({ message: "Username is already taken" });
          }
          
          // Check 14-day cooldown for username changes
          if (currentUser.lastUsernameChange) {
            const daysSinceLastChange = (Date.now() - new Date(currentUser.lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLastChange < 14) {
              const daysRemaining = Math.ceil(14 - daysSinceLastChange);
              return res.status(400).json({ 
                message: `Username can only be changed once every 14 days. Please wait ${daysRemaining} more day${daysRemaining !== 1 ? 's' : ''}.`
              });
            }
          }
          
          updateData.username = normalizedUsername;
          updateData.lastUsernameChange = new Date();
        }
      }
      
      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        // Return current user data unchanged
        const currentUser = await storage.getUserById(userId);
        if (!currentUser) {
          return res.status(404).json({ message: "User not found" });
        }
        const { password, ...safeUser } = currentUser;
        return res.json(safeUser);
      }
      
      // Use the profile updater for name/username changes and the privacy
      // updater when only privacy fields are being changed.
      let updatedUser;
      if (username !== undefined || fullName !== undefined) {
        updatedUser = await storage.updateUserProfile(userId, updateData);
      } else {
        updatedUser = await storage.updateUserPrivacySettings(userId, updateData);
      }
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return user without password
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
  });

  // Test endpoint to debug auth headers
  app.get("/api/test-auth", async (req, res) => {
    const authHeader = req.headers.authorization;
    console.log("[TEST] Auth header received:", authHeader);
    res.json({ 
      hasAuthHeader: !!authHeader,
      authHeader: authHeader || null,
      userId: authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    });
  });

  // Currency preference update endpoint
  app.put("/api/users/currency", async (req, res) => {
    try {
      const { preferredCurrency } = req.body;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization required' });
      }
      
      const userId = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Validate currency value
      if (!preferredCurrency || !['USD', 'NGN'].includes(preferredCurrency)) {
        return res.status(400).json({ error: "Invalid currency preference" });
      }

      const updatedUser = await storage.updateUserProfile(userId, { preferredCurrency });
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "Currency preference updated successfully", user: updatedUser });
    } catch (error) {
      console.error('Error updating currency preference:', error);
      res.status(500).json({ error: "Failed to update currency preference" });
    }
  });

  // Update profile image (preset selection)
  app.patch("/api/users/:id/profile-image", async (req, res) => {
    try {
      const userId = req.params.id;
      const { imageUrl, imageType } = req.body; // imageType: 'preset' or 'yearbook'
      
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization required' });
      }
      
      const requestingUserId = authHeader.substring(7);
      
      // Verify user is updating their own profile
      if (userId !== requestingUserId) {
        return res.status(403).json({ message: 'Unauthorized to update this profile' });
      }
      
      // Validate image URL
      if (!imageUrl) {
        return res.status(400).json({ message: 'Image URL is required' });
      }
      
      // Preset photos have been replaced with solid color SVG profiles. Keep
      // the accepted format strict because this value is later rendered as an
      // image URL throughout the app.
      if (imageType === 'preset') {
        const validPresets = [
          '/assets/avatars/professional_avatar__d707ef6a.jpg',
          '/assets/avatars/professional_avatar__91ae62b7.jpg',
          '/assets/avatars/professional_avatar__5f52401e.jpg',
          '/assets/avatars/professional_avatar__0525eae9.jpg',
          '/assets/avatars/professional_avatar__b5b3619d.jpg',
          '/assets/avatars/professional_avatar__9701d4e2.jpg',
          '/assets/avatars/professional_avatar__77f26f6b.jpg',
          '/assets/avatars/professional_avatar__1476bfc5.jpg',
        ];
        
        if (!validPresets.includes(imageUrl)) {
          return res.status(400).json({ message: 'Invalid preset avatar' });
        }
      }

      if (imageType === 'color') {
        let decodedSvg = '';
        try {
          if (!imageUrl.startsWith('data:image/svg+xml,')) {
            throw new Error('Invalid color profile format');
          }
          decodedSvg = decodeURIComponent(imageUrl.slice('data:image/svg+xml,'.length));
        } catch {
          return res.status(400).json({ message: 'Invalid profile color' });
        }

        const isSolidColorSvg =
          /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#[0-9a-fA-F]{6}"><\/rect><\/svg>$/.test(decodedSvg) ||
          /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#[0-9a-fA-F]{6}"\/><\/svg>$/.test(decodedSvg);

        if (!isSolidColorSvg) {
          return res.status(400).json({ message: 'Invalid profile color' });
        }
      }
      
      // Update user profile image
      const updatedUser = await storage.updateUserProfile(userId, { profileImage: imageUrl });
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error('Error updating profile image:', error);
      res.status(500).json({ message: 'Failed to update profile image' });
    }
  });

  // Upload profile image file (for yearbook photo or custom upload)
  app.post("/api/users/:id/profile-image", upload.single('profileImage'), async (req, res) => {
    try {
      const userId = req.params.id;
      
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const requestingUserId = authHeader.substring(7);
      
      // Verify user is updating their own profile
      if (userId !== requestingUserId) {
        return res.status(403).json({ message: 'Unauthorized to update this profile' });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No image file uploaded' });
      }
      
      const imagePath = req.file.path;
      const uploadedFilePath = path.join(process.cwd(), imagePath);
      
      // Get the user to check for existing profile image
      const existingUser = await storage.getUserById(userId);
      
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Delete old profile image from Cloudinary if exists
      if (existingUser.profileImage && existingUser.profileImage.includes('cloudinary.com')) {
        // Extract public_id from cloudinary URL and delete
        const urlParts = existingUser.profileImage.split('/');
        const publicIdWithExt = urlParts.slice(7).join('/'); // Get everything after '/upload/'
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // Remove extension
        try {
          await deleteFromCloudinary(publicId);
        } catch (error) {
          console.log(`Could not delete old profile image from Cloudinary:`, error);
        }
      }
      
      // Upload to Cloudinary
      let imageUrl = imagePath;
      
      try {
        const cloudinaryResult = await uploadToCloudinary(
          uploadedFilePath,
          `profiles/${userId}`,
          {
            public_id: `profile_${userId}_${Date.now()}`,
            overwrite: true
          }
        );
        imageUrl = cloudinaryResult.secureUrl;
        
        // Clean up local file after successful upload
        await fs.unlink(uploadedFilePath);
      } catch (error) {
        console.error('Failed to upload to Cloudinary:', error);
        // Clean up local file
        try {
          await fs.unlink(uploadedFilePath);
        } catch {}
        return res.status(500).json({ message: 'Failed to upload image' });
      }
      
      // Update user profile image
      const updatedUser = await storage.updateUserProfile(userId, { profileImage: imageUrl });
      
      if (!updatedUser) {
        return res.status(500).json({ message: 'Failed to update user profile' });
      }
      
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error('Error uploading profile image:', error);
      res.status(500).json({ message: 'Failed to upload profile image' });
    }
  });

  // Crop yearbook page for profile photo (verified alumni only)
  app.post("/api/users/:id/crop-yearbook-photo", async (req, res) => {
    try {
      const userId = req.params.id;
      const { yearbookId, pageId, cropData } = req.body;
      
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization required' });
      }
      
      const requestingUserId = authHeader.substring(7);
      
      // Verify user is cropping for their own profile
      if (userId !== requestingUserId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      
      // Validate crop data
      if (!cropData || !cropData.x || !cropData.y || !cropData.width || !cropData.height) {
        return res.status(400).json({ message: 'Invalid crop data' });
      }
      
      // Get user to check verification status
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get yearbook to find school
      const yearbook = await storage.getYearbookById(yearbookId);
      if (!yearbook) {
        return res.status(404).json({ message: 'Yearbook not found' });
      }
      
      // Check if user is verified alumni for this school
      const alumniBadges = await storage.getAlumniBadgesByUser(userId);
      const isVerifiedAlumni = alumniBadges.some((badge: any) => 
        badge.status === 'verified' && 
        (badge.schoolId === yearbook.schoolId || badge.school === yearbook.schoolId)
      );
      
      if (!isVerifiedAlumni) {
        return res.status(403).json({ 
          message: 'Only verified alumni can use yearbook photos as profile pictures' 
        });
      }
      
      // Check if user has purchased this yearbook
      const hasPurchased = await storage.checkUserYearbookAccess(userId, yearbook.schoolId, yearbook.year);
      if (!hasPurchased) {
        return res.status(403).json({ 
          message: 'You must purchase this yearbook to use it for your profile photo' 
        });
      }
      
      // Get the yearbook page
      const page = await storage.getYearbookPageById(pageId);
      if (!page || page.yearbookId !== yearbookId) {
        return res.status(404).json({ message: 'Yearbook page not found' });
      }
      
      // Download the yearbook page temporarily
      const tempDir = 'public/uploads/temp';
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempFileName = `temp_${Date.now()}_${userId}.jpg`;
      const tempFilePath = path.join(tempDir, tempFileName);
      
      try {
        // Get the image from Cloudinary or local storage
        let imageBuffer: Buffer;
        
        if (page.imageUrl.includes('cloudinary.com')) {
          // Download from Cloudinary
          const response = await fetch(page.imageUrl);
          const arrayBuffer = await response.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        } else {
          // Read from local file system
          const localPath = page.imageUrl.startsWith('/') 
            ? `public${page.imageUrl}` 
            : page.imageUrl;
          imageBuffer = await fs.readFile(localPath);
        }
        
        // Crop the image using sharp
        const croppedBuffer = await sharp(imageBuffer)
          .extract({
            left: Math.round(cropData.x),
            top: Math.round(cropData.y),
            width: Math.round(cropData.width),
            height: Math.round(cropData.height)
          })
          .resize(400, 400, { fit: 'cover' }) // Resize to standard profile photo size
          .jpeg({ quality: 90 })
          .toBuffer();
        
        // Save temporarily
        await fs.writeFile(tempFilePath, croppedBuffer);
        
        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(
          tempFilePath,
          `profiles/${userId}`,
          {
            public_id: `yearbook_${yearbookId}_${Date.now()}`,
            overwrite: true
          }
        );
        
        // Delete temporary file
        await fs.unlink(tempFilePath);
        
        // Update user profile image
        const updatedUser = await storage.updateUserProfile(userId, { 
          profileImage: uploadResult.secureUrl 
        });
        
        if (!updatedUser) {
          return res.status(500).json({ message: 'Failed to update user profile' });
        }
        
        const { password, ...safeUser } = updatedUser;
        res.json({ 
          success: true, 
          user: safeUser,
          profileImage: uploadResult.secureUrl
        });
        
      } catch (processingError) {
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempFilePath);
        } catch {}
        
        throw processingError;
      }
      
    } catch (error) {
      console.error('Error cropping yearbook photo:', error);
      res.status(500).json({ message: 'Failed to crop yearbook photo' });
    }
  });

  // Memory routes
  // IMPORTANT: Specific routes must come before general patterns to avoid conflicts
  
  // Get pending memories for a school (requires school admin authentication)
  app.get("/api/memories/school/:schoolId/pending", async (req, res) => {
    console.log("=== PENDING MEMORIES ROUTE START ===");
    try {
      const { schoolId } = req.params;
      console.log("1. SchoolId:", schoolId);
      
      // Authentication check
      const authHeader = req.headers.authorization;
      console.log("2. Auth header:", authHeader ? "Present" : "Missing");
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("AUTH FAIL: No Bearer token");
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      console.log("3. User ID:", userId);
      const user = await storage.getUser(userId);
      console.log("4. User found:", user ? user.userType : "Not found");
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        console.log("AUTH FAIL: Insufficient privileges");
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // For school admins, verify they can access the specified school  
      // Super admins have access to all schools, so skip this check for them
      console.log("5. User type check:", user.userType);
      if (user.userType === 'school_admin' || user.userType === 'school') {
        console.log("6. Checking school access for non-super-admin");
        const userSchool = await storage.getSchoolByAdminUserId(userId);
        if (!userSchool || userSchool.id !== schoolId) {
          console.log("SCHOOL ACCESS FAIL");
          return res.status(403).json({ message: "Access denied for this school" });
        }
      } else {
        console.log("6. Skipping school check for super_admin");
      }

      console.log("7. About to call getSimplePendingMemories");
      // SIMPLE WORKING SOLUTION: Use helper function
      const rawMemories = await getSimplePendingMemories(schoolId);
      console.log("8. Got memories:", rawMemories ? rawMemories.length : "null");
      
      // Transform snake_case DB fields to camelCase for frontend compatibility
      const pendingMemories = rawMemories.map(memory => ({
        id: memory.id,
        title: memory.title,
        description: memory.description,
        imageUrl: memory.image_url ? `/public${memory.image_url}` : null,
        mediaType: memory.media_type,
        eventDate: memory.event_date,
        year: memory.year,
        category: memory.category,
        status: memory.status,
        uploadedBy: memory.uploaded_by,
        createdAt: memory.created_at
      }));
      
      // Prevent caching to avoid 304 responses for pending data
      res.setHeader('Cache-Control', 'no-store');
      res.json(pendingMemories);
      console.log("9. Response sent successfully");
    } catch (error) {
      console.error("ERROR in pending memories route:", error);
      res.status(500).json({ message: "Failed to fetch pending memories" });
    }
  });
  
  app.get("/api/memories/school/:schoolId/:year", async (req, res) => {
    try {
      const { schoolId, year } = req.params;
      
      const validYear = validateYear(year);
      if (validYear === null) {
        return res.status(400).json({ error: "Invalid or missing year parameter" });
      }
      
      const allMemories = await storage.getMemoriesBySchoolAndYear(schoolId, validYear);
      // Filter out pending memories - only show approved memories in public uploads section
      const approvedMemories = allMemories.filter(memory => memory.status === 'approved');
      res.json(approvedMemories);
    } catch (error) {
      res.status(500).json({ message: "Failed to get memories" });
    }
  });

  // Get tagged memories for a user (approved only)
  app.get("/api/memories/tagged/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const taggedMemories = await storage.getTaggedMemoriesByUser(userId);
      res.json(taggedMemories);
    } catch (error) {
      console.error("Error fetching tagged memories:", error);
      res.status(500).json({ message: "Failed to fetch tagged memories" });
    }
  });

  app.get("/api/memories/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const userMemories = await storage.getMemoriesByUser(userId);
      res.json(userMemories);
    } catch (error) {
      console.error("Error fetching user memories:", error);
      res.status(500).json({ message: "Failed to fetch user memories" });
    }
  });

  app.post("/api/memories", upload.single('memoryFile'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { title, description, eventDate, year, category, schoolId, uploadedBy } = req.body;
      
      // Validate year parameter
      if (!year || isNaN(parseInt(year, 10))) {
        return res.status(400).json({ error: "Invalid or missing year parameter" });
      }
      
      // Check if user is authenticated and get user type
      let memoryStatus = 'pending'; // Default to pending for moderation
      let uploaderName = uploadedBy || null;
      let uploaderUserId: string | null = null;
      
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const userId = authHeader.substring(7);
        uploaderUserId = userId;
        const user = await storage.getUser(userId);
        
        // Only school admins and super admins can auto-approve their uploads
        if (user && (user.userType === 'school' || user.userType === 'school_admin' || user.userType === 'super_admin')) {
          memoryStatus = 'approved';
          uploaderName = user.fullName; // Use authenticated user's name
        } else if (user) {
          // For viewers, etc. - set their name as uploader
          uploaderName = user.fullName;
        }
      }
      
      // Upload to Cloudinary and determine media type
      const uploadedFilePath = path.join(process.cwd(), 'public/uploads/memories', file.filename);
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      
      let mediaUrl = `/uploads/memories/${file.filename}`;
      let cloudinaryPublicId: string | null = null;
      
      // Only upload images to Cloudinary (videos stay local for now)
      if (mediaType === 'image') {
        try {
          // Get school info for organized folder structure
          const school = await storage.getSchool(schoolId);
          if (!school) {
            throw new Error('School not found');
          }
          
          // Generate organized folder path
          const folderPath = generateFolderPath(
            school.name,
            school.schoolCode,
            'memories',
            parseInt(year)
          );
          
          const cloudinaryResult = await uploadToCloudinary(
            uploadedFilePath,
            folderPath
          );
          mediaUrl = cloudinaryResult.secureUrl;
          cloudinaryPublicId = cloudinaryResult.publicId;
          // Clean up local file after successful upload
          await fs.unlink(uploadedFilePath);
        } catch (error) {
          console.error('Failed to upload memory to Cloudinary, using local file:', error);
          // Keep local file as fallback
        }
      }
      
      // Create memory object
      const memoryData = {
        schoolId,
        title,
        description: description || null,
        imageUrl: mediaType === 'image' ? mediaUrl : null,
        cloudinaryPublicId,
        mediaType,
        eventDate,
        year: parseInt(year),
        category: category || null,
        tags: [],
        status: memoryStatus as 'pending' | 'approved',
        uploadedBy: uploaderName,
        userId: uploaderUserId
      };

      // Validate the data
      const validatedData = insertMemorySchema.parse(memoryData);
      
      // Create the memory
      const memory = await storage.createMemory(validatedData);
      
      // Create notification for school admin if memory is pending approval
      if (memoryStatus === 'pending') {
        const school = await storage.getSchool(schoolId);
        if (school?.adminUserId) {
          await storage.createNotification({
            userId: school.adminUserId,
            type: "memory_uploaded",
            title: "New Memory Pending Approval",
            message: `${uploaderName || 'A user'} uploaded a new memory: ${title}`,
            isRead: false,
            relatedId: memory.id,
          });
        }
      }
      
      // Return different messages based on status
      const responseMessage = memoryStatus === 'pending' 
        ? "Memory uploaded successfully! It's pending approval by the school."
        : "Memory uploaded and published successfully!";
      
      res.status(201).json({ ...memory, message: responseMessage });
    } catch (error) {
      console.error("Error creating memory:", error);
      res.status(500).json({ message: "Failed to create memory" });
    }
  });


  // Approve a pending memory (requires school admin authentication)
  app.patch("/api/memories/:memoryId/approve", async (req, res) => {
    try {
      const { memoryId } = req.params;
      const { approvedBy } = req.body;
      
      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Get the memory to verify school ownership
      const memory = await storage.getMemoryById(memoryId);
      if (!memory) {
        return res.status(404).json({ message: "Memory not found" });
      }

      // For school admins, verify they can access the school that owns this memory
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const userSchool = await storage.getSchoolByAdminUserId(userId);
        if (!userSchool || userSchool.id !== memory.schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      const updatedMemory = await storage.approveMemory(memoryId, approvedBy || userId);
      res.json(updatedMemory);
    } catch (error) {
      console.error("Error approving memory:", error);
      res.status(500).json({ message: "Failed to approve memory" });
    }
  });

  // Update memory title and category (requires school admin authentication)
  app.patch("/api/memories/:memoryId/title", async (req, res) => {
    try {
      const { memoryId } = req.params;
      const { title, category } = req.body;
      
      // Validate input
      if (!title || title.trim().length === 0) {
        return res.status(400).json({ message: "Title is required" });
      }
      
      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Get the memory to verify school ownership
      const memory = await storage.getMemoryById(memoryId);
      if (!memory) {
        return res.status(404).json({ message: "Memory not found" });
      }

      // For school admins, verify they can access the school that owns this memory
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const userSchool = await storage.getSchoolByAdminUserId(userId);
        if (!userSchool || userSchool.id !== memory.schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      const updatedMemory = await storage.updateMemoryTitle(memoryId, title.trim(), category);
      if (!updatedMemory) {
        return res.status(404).json({ message: "Memory not found" });
      }
      
      res.json(updatedMemory);
    } catch (error) {
      console.error("Error updating memory title:", error);
      res.status(500).json({ message: "Failed to update memory title" });
    }
  });

  // Delete/deny a memory (requires school admin authentication)
  app.delete("/api/memories/:memoryId", async (req, res) => {
    try {
      const { memoryId } = req.params;
      
      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Get the memory to verify school ownership
      const memory = await storage.getMemoryById(memoryId);
      if (!memory) {
        return res.status(404).json({ message: "Memory not found" });
      }

      // For school admins, verify they can access the school that owns this memory
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const userSchool = await storage.getSchoolByAdminUserId(userId);
        if (!userSchool || userSchool.id !== memory.schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      // Delete the actual files from disk to prevent orphaned files
      const fs = await import('fs');
      const path = await import('path');
      
      try {
        if (memory.imageUrl) {
          const imagePath = path.default.join(__dirname, '../public', memory.imageUrl);
          if (fs.default.existsSync(imagePath)) {
            fs.default.unlinkSync(imagePath);
            console.log(`Deleted image file: ${imagePath}`);
          }
        }
        if (memory.videoUrl) {
          const videoPath = path.default.join(__dirname, '../public', memory.videoUrl);
          if (fs.default.existsSync(videoPath)) {
            fs.default.unlinkSync(videoPath);
            console.log(`Deleted video file: ${videoPath}`);
          }
        }
      } catch (fileError) {
        console.error("Error deleting files:", fileError);
        // Continue with database deletion even if file deletion fails
      }
      
      await storage.deleteMemory(memoryId);
      res.json({ message: "Memory deleted successfully" });
    } catch (error) {
      console.error("Error deleting memory:", error);
      res.status(500).json({ message: "Failed to delete memory" });
    }
  });

  // Public upload link routes (requires school admin authentication)
  app.post("/api/public-upload-links", async (req, res) => {
    try {
      // Authentication check - require Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7); // Remove 'Bearer ' prefix
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // For school admins, verify they can access the specified school
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== req.body.schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      // Validate request body structure first
      const publicLinkData = {
        schoolId: req.body.schoolId,
        year: req.body.year ? parseInt(req.body.year) : undefined,
        category: req.body.category,
        validForHours: req.body.validForHours ? parseInt(req.body.validForHours) : undefined
      };

      // Basic validation
      if (!publicLinkData.schoolId || !publicLinkData.year || !publicLinkData.category || !publicLinkData.validForHours) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check for existing active links for the same school, year, and category
      const existingLinks = await storage.getPublicUploadLinksBySchoolAndYear(publicLinkData.schoolId, publicLinkData.year);
      const activeLink = existingLinks.find(link => 
        link.category === publicLinkData.category && 
        link.isActive && 
        new Date() < link.expiresAt
      );

      if (activeLink) {
        return res.status(409).json({ 
          message: `An active upload link for ${publicLinkData.category} already exists for ${publicLinkData.year}. Please wait for it to expire or deactivate it first.`,
          existingLink: {
            expiresAt: activeLink.expiresAt.toISOString(),
            category: activeLink.category,
            id: activeLink.id
          }
        });
      }

      // Calculate expiration date (max 48 hours)
      const maxHours = Math.min(publicLinkData.validForHours, 48);
      const expiresAt = new Date(Date.now() + (maxHours * 60 * 60 * 1000));

      const result = await storage.createPublicUploadLink({
        schoolId: publicLinkData.schoolId,
        year: publicLinkData.year,
        category: publicLinkData.category,
        expiresAt,
        createdBy: userId
      });

      // Notify verified alumni about the new upload code
      const notifiedCount = await storage.notifyAlumniOfUploadCode(
        publicLinkData.schoolId,
        publicLinkData.year.toString(),
        result.linkCode,
        expiresAt,
        result.id
      );
      console.log(`Notified ${notifiedCount} verified alumni about upload code ${result.linkCode}`);

      res.status(201).json({
        linkCode: result.linkCode,
        id: result.id,
        expiresAt: expiresAt.toISOString(),
        schoolId: publicLinkData.schoolId,
        year: publicLinkData.year,
        category: publicLinkData.category
      });
    } catch (error) {
      console.error("Error creating public upload link:", error);
      res.status(500).json({ message: "Failed to create upload link" });
    }
  });

  app.get("/api/public-upload-links/:code", async (req, res) => {
    try {
      const { code } = req.params;
      // No reCAPTCHA verification needed for code validation - only for actual uploads
      
      // Format code with dashes if it doesn't have them (16 chars becomes XXXX-XXXX-XXXX-XXXX)
      const formattedCode = code.length === 16 && !code.includes('-') 
        ? `${code.slice(0,4)}-${code.slice(4,8)}-${code.slice(8,12)}-${code.slice(12,16)}`
        : code;
      
      const link = await storage.getPublicUploadLinkByCode(formattedCode);
      
      if (!link) {
        return res.status(404).json({ message: "This code has expired or is invalid" });
      }

      // Check if still active
      if (!link.isActive) {
        return res.status(410).json({ message: "Upload link is no longer active" });
      }

      // Upload limits removed - uploads are unlimited until expiry

      const school = await storage.getSchoolById(link.schoolId);
      res.json({
        id: link.id,
        schoolId: link.schoolId,
        schoolName: school?.name || null,
        year: link.year,
        category: link.category,
        isValid: true
      });
    } catch (error) {
      console.error("Error validating upload link:", error);
      res.status(500).json({ message: "Failed to validate upload link" });
    }
  });

  // Get public upload links for a school and year
  app.get("/api/public-upload-links/school/:schoolId/:year", async (req, res) => {
    try {
      const { schoolId, year } = req.params;
      
      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Verify access to the school
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      const validYear = validateYear(year);
      if (validYear === null) {
        return res.status(400).json({ error: "Invalid or missing year parameter" });
      }
      
      const links = await storage.getPublicUploadLinksBySchoolAndYear(schoolId, validYear);
      res.json(links);
    } catch (error) {
      console.error("Error fetching public upload links:", error);
      res.status(500).json({ message: "Failed to fetch upload links" });
    }
  });

  // Toggle public upload link active status
  app.patch("/api/public-upload-links/:linkId/toggle", async (req, res) => {
    try {
      const { linkId } = req.params;
      const { isActive } = req.body;
      
      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Get the link to verify ownership
      const link = await storage.getPublicUploadLinkById(linkId);
      if (!link) {
        return res.status(404).json({ message: "Upload link not found" });
      }

      // Verify access to the school
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== link.schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      const updatedLink = await storage.updatePublicUploadLinkStatus(linkId, isActive);
      res.json(updatedLink);
    } catch (error) {
      console.error("Error updating upload link status:", error);
      res.status(500).json({ message: "Failed to update link status" });
    }
  });

  // Delete public upload link
  app.delete("/api/public-upload-links/:linkId", async (req, res) => {
    try {
      const { linkId } = req.params;
      
      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school_admin' && user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Get the link to verify ownership
      const link = await storage.getPublicUploadLinkById(linkId);
      if (!link) {
        return res.status(404).json({ message: "Upload link not found" });
      }

      // Verify access to the school
      if (user.userType === 'school_admin' || user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== link.schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      // Delete associated notifications first
      const deletedNotifications = await storage.deleteUploadCodeNotifications(linkId);
      console.log(`Deleted ${deletedNotifications} upload code notifications for link ${linkId}`);

      await storage.deletePublicUploadLink(linkId);
      res.json({ message: "Upload link deleted successfully" });
    } catch (error) {
      console.error("Error deleting upload link:", error);
      res.status(500).json({ message: "Failed to delete link" });
    }
  });

  app.post("/api/public-uploads/:code", upload.single('memoryFile'), async (req, res) => {
    try {
      const { code } = req.params;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { title, description, uploadedBy, recaptchaToken, taggedUserIds } = req.body;
      
      if (!uploadedBy) {
        return res.status(400).json({ message: "Uploaded by name is required" });
      }
      
      // Check if user is logged in
      const authHeader = req.headers.authorization;
      const isLoggedIn = authHeader && authHeader.startsWith('Bearer ');
      
      // For unregistered users, verify reCAPTCHA token (skipped in beta mode)
      if (!isLoggedIn && !BETA_VERSION) {
        if (!recaptchaToken) {
          return res.status(400).json({ message: "reCAPTCHA verification required" });
        }
        
        // Verify the reCAPTCHA token with Google
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (!secretKey) {
          console.error("RECAPTCHA_SECRET_KEY not configured");
          return res.status(500).json({ message: "Server configuration error" });
        }
        
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;
        const recaptchaResponse = await fetch(verifyUrl, { method: 'POST' });
        const recaptchaData = await recaptchaResponse.json();
        
        console.log("reCAPTCHA verification result:", { 
          success: recaptchaData.success, 
          errorCodes: recaptchaData['error-codes'],
          score: recaptchaData.score 
        });
        
        if (!recaptchaData.success) {
          const errorCodes = recaptchaData['error-codes'] || [];
          console.error("reCAPTCHA verification failed with errors:", errorCodes);
          return res.status(400).json({ message: "reCAPTCHA verification failed. Please try again." });
        }
      }

      // Validate the upload link
      // Format code with dashes if it doesn't have them (16 chars becomes XXXX-XXXX-XXXX-XXXX)
      const formattedCode = code.length === 16 && !code.includes('-') 
        ? `${code.slice(0,4)}-${code.slice(4,8)}-${code.slice(8,12)}-${code.slice(12,16)}`
        : code;
      const link = await storage.getPublicUploadLinkByCode(formattedCode);
      if (!link) {
        return res.status(404).json({ message: "This code has expired or is invalid" });
      }

      if (!link.isActive) {
        return res.status(410).json({ message: "Upload link is no longer active" });
      }


      // Determine media type and URL
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const mediaUrl = `/uploads/memories/${file.filename}`;

      // Extract logged-in userId if available (authHeader already declared above)
      const uploaderUserId: string | null = isLoggedIn ? (authHeader as string).substring(7) : null;
      
      // Create memory with pending status for approval
      const memoryData = {
        schoolId: link.schoolId,
        title: title || 'Untitled',
        description: description || null,
        imageUrl: mediaType === 'image' ? mediaUrl : null,
        videoUrl: mediaType === 'video' ? mediaUrl : null,
        mediaType,
        eventDate: link.year.toString(),
        year: link.year,
        category: link.category,
        tags: [],
        status: 'pending' as const,
        uploadedBy,
        userId: uploaderUserId,
        publicUploadLinkId: link.id
      };

      // Validate the data
      const validatedData = insertMemorySchema.parse(memoryData);
      
      // Create the memory
      const memory = await storage.createMemory(validatedData);

      // Save photo tags if any users were tagged
      if (taggedUserIds) {
        try {
          const ids: string[] = typeof taggedUserIds === 'string' ? JSON.parse(taggedUserIds) : taggedUserIds;
          if (ids.length > 0) {
            await storage.createPhotoTags(memory.id, ids);
          }
        } catch (e) {
          console.error("Failed to save photo tags:", e);
        }
      }

      // Create notification for school admin about new public upload
      const school = await storage.getSchool(link.schoolId);
      if (school?.adminUserId) {
        await storage.createNotification({
          userId: school.adminUserId,
          type: "memory_uploaded",
          title: "New Memory Pending Approval",
          message: `${uploadedBy || 'A guest'} uploaded a new memory via public link`,
          isRead: false,
          relatedId: memory.id,
        });
      }

      res.status(201).json({
        id: memory.id,
        message: "Photo/video uploaded successfully! It's pending approval by the school."
      });
    } catch (error) {
      console.error("Error processing public upload:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Year purchase routes for schools
  app.get("/api/year-purchases/school/:schoolId", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const purchases = await storage.getYearPurchasesBySchool(schoolId);
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching year purchases:", error);
      res.status(500).json({ message: "Failed to get year purchases" });
    }
  });

  app.post("/api/year-purchases", async (req, res) => {
    try {
      const purchaseData = req.body;
      
      // Convert purchaseDate string to Date object if needed
      if (purchaseData.purchaseDate && typeof purchaseData.purchaseDate === 'string') {
        purchaseData.purchaseDate = new Date(purchaseData.purchaseDate);
      }
      
      const purchase = await storage.createYearPurchase(purchaseData);
      res.status(201).json(purchase);
    } catch (error) {
      console.error("Error creating year purchase:", error);
      res.status(500).json({ message: "Failed to create year purchase" });
    }
  });

  app.patch("/api/year-purchases/:purchaseId", async (req, res) => {
    try {
      const { purchaseId } = req.params;
      const { purchased } = req.body;
      const updatedPurchase = await storage.updateYearPurchase(purchaseId, purchased);
      
      if (!updatedPurchase) {
        return res.status(404).json({ message: "Year purchase not found" });
      }
      
      res.json(updatedPurchase);
    } catch (error) {
      console.error("Error updating year purchase:", error);
      res.status(500).json({ message: "Failed to update year purchase" });
    }
  });

  // Viewer year purchase routes
  app.get("/api/viewer-year-purchases/:userId/:schoolId", async (req, res) => {
    try {
      const { userId, schoolId } = req.params;
      const purchases = await storage.getViewerYearPurchases(userId, schoolId);
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching viewer year purchases:", error);
      res.status(500).json({ message: "Failed to get viewer year purchases" });
    }
  });

  // Get all purchased yearbooks for a user (for Library feature)
  app.get("/api/library/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      console.log(`📚 Library API called for userId: ${userId}`);
      const purchases = await storage.getAllViewerYearPurchases(userId);
      console.log(`📚 Found ${purchases.length} purchased yearbooks`);
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching library yearbooks:", error);
      res.status(500).json({ message: "Failed to get library yearbooks" });
    }
  });


  app.post("/api/viewer-year-purchases", async (req, res) => {
    try {
      const purchaseData = req.body;
      
      // Convert purchaseDate string to Date object if needed
      if (purchaseData.purchaseDate && typeof purchaseData.purchaseDate === 'string') {
        purchaseData.purchaseDate = new Date(purchaseData.purchaseDate);
      }
      
      const purchase = await storage.createViewerYearPurchase(purchaseData);
      res.status(201).json(purchase);
    } catch (error) {
      console.error("Error creating viewer year purchase:", error);
      res.status(500).json({ message: "Failed to create viewer year purchase" });
    }
  });

  app.patch("/api/viewer-year-purchases/:purchaseId", async (req, res) => {
    try {
      const { purchaseId } = req.params;
      const { purchased } = req.body;
      const updatedPurchase = await storage.updateViewerYearPurchase(purchaseId, purchased);
      
      if (!updatedPurchase) {
        return res.status(404).json({ message: "Viewer year purchase not found" });
      }
      
      res.json(updatedPurchase);
    } catch (error) {
      console.error("Error updating viewer year purchase:", error);
      res.status(500).json({ message: "Failed to update viewer year purchase" });
    }
  });

  // Cart routes
  app.get("/api/cart/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const cartItems = await storage.getCartItems(userId);
      res.json(cartItems);
    } catch (error) {
      console.error("Error fetching cart items:", error);
      res.status(500).json({ message: "Failed to get cart items" });
    }
  });

  app.post("/api/cart", async (req, res) => {
    try {
      const cartItemData = req.body;
      
      // Check if item already exists in cart
      const existingItem = await storage.getCartItem(
        cartItemData.userId,
        cartItemData.schoolId,
        cartItemData.year
      );
      
      if (existingItem) {
        return res.status(409).json({ message: "Item already in cart" });
      }
      
      const cartItem = await storage.addCartItem(cartItemData);
      res.status(201).json(cartItem);
    } catch (error) {
      console.error("Error adding item to cart:", error);
      res.status(500).json({ message: "Failed to add item to cart" });
    }
  });

  app.delete("/api/cart/:cartItemId", async (req, res) => {
    try {
      const { cartItemId } = req.params;
      const success = await storage.removeCartItem(cartItemId);
      
      if (!success) {
        return res.status(404).json({ message: "Cart item not found" });
      }
      
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      console.error("Error removing item from cart:", error);
      res.status(500).json({ message: "Failed to remove item from cart" });
    }
  });

  app.delete("/api/cart/clear/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      await storage.clearCart(userId);
      res.json({ message: "Cart cleared" });
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  // Helper function to validate and parse year parameter
  const validateYear = (yearParam: string): number | null => {
    const year = parseInt(yearParam, 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      return null;
    }
    return year;
  };

  // Yearbook management routes
  // Get all yearbooks for a school (used by school dashboard)
  app.get("/api/yearbooks/:schoolId/all", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const yearbooks = await storage.getAllYearbooksForSchool(schoolId);
      res.json(yearbooks);
    } catch (error) {
      console.error("Error fetching all yearbooks:", error);
      res.status(500).json({ message: "Failed to get yearbooks" });
    }
  });

  app.get("/api/yearbooks/:schoolId/:year", async (req, res) => {
    try {
      const { schoolId, year } = req.params;
      
      const validYear = validateYear(year);
      if (validYear === null) {
        return res.status(400).json({ error: "Invalid or missing year parameter" });
      }
      
      const yearbook = await storage.getYearbookBySchoolAndYear(schoolId, validYear);
      if (!yearbook) {
        return res.status(404).json({ message: "Yearbook not found" });
      }
      
      // Apply watermarks for viewer accounts
      let userId = req.headers['x-user-id'] as string || req.query.userId as string;
      if (!userId && req.headers['authorization']) {
        const authHeader = req.headers['authorization'] as string;
        userId = authHeader.replace('Bearer ', '');
      }
      if (userId) {
        const user = await storage.getUserById(userId);
        if (user && (yearbook as any).pages) {
          (yearbook as any).pages = (yearbook as any).pages.map((page: any) => ({
            ...page,
            imageUrl: getImageUrl(page.imageUrl, page.cloudinaryPublicId, user.userType)
          }));
        }
      }
      
      res.json(yearbook);
    } catch (error) {
      console.error("Error fetching yearbook:", error);
      res.status(500).json({ message: "Failed to get yearbook" });
    }
  });

  // Route for viewers to get only published yearbooks
  app.get("/api/published-yearbooks/:schoolId/:year", async (req, res) => {
    try {
      const { schoolId, year } = req.params;
      
      const validYear = validateYear(year);
      if (validYear === null) {
        return res.status(400).json({ error: "Invalid or missing year parameter" });
      }
      
      const yearbook = await storage.getPublishedYearbook(schoolId, validYear);
      if (!yearbook) {
        return res.status(404).json({ message: "Published yearbook not found" });
      }
      
      // Apply watermarks for viewer accounts
      let userId = req.headers['x-user-id'] as string || req.query.userId as string;
      if (!userId && req.headers['authorization']) {
        const authHeader = req.headers['authorization'] as string;
        userId = authHeader.replace('Bearer ', '');
      }
      if (userId) {
        const user = await storage.getUserById(userId);
        if (user && (yearbook as any).pages) {
          (yearbook as any).pages = (yearbook as any).pages.map((page: any) => ({
            ...page,
            imageUrl: getImageUrl(page.imageUrl, page.cloudinaryPublicId, user.userType)
          }));
        }
      }
      
      res.json(yearbook);
    } catch (error) {
      console.error("Error fetching published yearbook:", error);
      res.status(500).json({ message: "Failed to get published yearbook" });
    }
  });

  // New efficient endpoint to get ALL published yearbooks for a school
  app.get("/api/published-yearbooks-list/:schoolId", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const publishedYearbooks = await storage.getAllPublishedYearbooks(schoolId);
      res.json(publishedYearbooks);
    } catch (error) {
      console.error("Error fetching all published yearbooks:", error);
      res.status(500).json({ message: "Failed to get published yearbooks" });
    }
  });

  app.post("/api/yearbooks", async (req, res) => {
    try {
      const { year, schoolId } = req.body;
      
      // Validate required fields
      if (!schoolId) {
        return res.status(400).json({ error: "School ID is required" });
      }
      
      // Validate year
      if (!year || typeof year !== 'number' || isNaN(year) || year < 1900 || year > 2100) {
        return res.status(400).json({ error: "Invalid or missing year parameter" });
      }

      // If a yearbook already exists for this school/year, return it (idempotent)
      const existing = await storage.getYearbook(schoolId, year);
      if (existing) {
        return res.status(200).json(existing);
      }
      
      const yearbook = await storage.createYearbook(req.body);
      res.status(201).json(yearbook);
    } catch (error) {
      console.error("Error creating yearbook:", error);
      res.status(500).json({ message: "Failed to create yearbook" });
    }
  });

  app.patch("/api/yearbooks/:yearbookId/publish", async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const { isPublished } = req.body;
      const yearbook = await storage.updateYearbookPublishStatus(yearbookId, isPublished);
      if (!yearbook) {
        return res.status(404).json({ message: "Yearbook not found" });
      }
      res.json(yearbook);
    } catch (error) {
      console.error("Error updating yearbook:", error);
      res.status(500).json({ message: "Failed to update yearbook" });
    }
  });

  // Draft management routes
  app.post("/api/yearbooks/:yearbookId/publish-drafts", async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const result = await storage.publishDrafts(yearbookId);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      res.json({ message: result.message, success: true });
    } catch (error) {
      console.error("Error publishing drafts:", error);
      res.status(500).json({ message: "Failed to publish drafts" });
    }
  });

  app.post("/api/yearbooks/:yearbookId/discard-drafts", async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const result = await storage.discardDrafts(yearbookId);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      res.json({ message: result.message, success: true });
    } catch (error) {
      console.error("Error discarding drafts:", error);
      res.status(500).json({ message: "Failed to discard drafts" });
    }
  });

  app.patch("/api/yearbooks/:yearbookId/auto-save", async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const { isAutoSave } = req.body;
      const yearbook = await storage.updateDraftTimestamp(yearbookId, isAutoSave !== false);
      if (!yearbook) {
        return res.status(404).json({ message: "Yearbook not found" });
      }
      res.json(yearbook);
    } catch (error) {
      console.error("Error updating draft timestamp:", error);
      res.status(500).json({ message: "Failed to update draft timestamp" });
    }
  });

  app.post("/api/yearbooks/:yearbookId/upload-page", upload.single('file'), async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const { pageType, title, pageNumber: customPageNumber } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // For covers, delete existing cover first to enable replacement
      if (pageType === "front_cover" || pageType === "back_cover") {
        const existingPages = await storage.getYearbookPages(yearbookId);
        const existingCover = existingPages.find(p => p.pageType === pageType);
        if (existingCover) {
          // Delete from Cloudinary if publicId exists
          if (existingCover.cloudinaryPublicId) {
            await deleteFromCloudinary(existingCover.cloudinaryPublicId);
          }
          // Also delete local file if it exists (backward compatibility)
          if (!existingCover.imageUrl.includes('cloudinary.com')) {
            const oldImagePath = path.join(process.cwd(), 'public', existingCover.imageUrl);
            try {
              await fs.unlink(oldImagePath);
            } catch (error) {
              console.warn('Could not delete old cover image:', oldImagePath, error);
            }
          }
          
          await storage.deleteYearbookPage(existingCover.id);
        }
      }
      
      // Check if uploaded file is a PDF
      const isPdf = req.file.mimetype === 'application/pdf';
      
      if (isPdf) {
        // For content PDFs, check if pages already exist - only allow one PDF upload
        if (pageType === "content") {
          const existingPages = await storage.getYearbookPages(yearbookId);
          const hasContentPages = existingPages.some(p => p.pageType === "content" || p.pageType === "front_cover" || p.pageType === "back_cover");
          
          if (hasContentPages) {
            // Delete the uploaded PDF file
            await fs.unlink(path.join(process.cwd(), 'public/uploads/yearbooks', req.file.filename));
            
            return res.status(400).json({ 
              message: "A PDF has already been uploaded for this yearbook. Please delete all existing pages first before uploading a new PDF.",
              error: "PDF_ALREADY_EXISTS"
            });
          }
        }
        
        // Handle PDF upload using Cloudinary
        console.log('Processing PDF upload via Cloudinary:', req.file.filename);
        
        const uploadedPdfPath = path.join(process.cwd(), 'public/uploads/yearbooks', req.file.filename);
        
        try {
          // Get yearbook and school info for organized folder structure
          const yearbook = await storage.getYearbookById(yearbookId);
          if (!yearbook) {
            throw new Error('Yearbook not found');
          }
          const school = await storage.getSchool(yearbook.schoolId);
          if (!school) {
            throw new Error('School not found');
          }
          
          // Generate organized folder path
          const folderPath = generateFolderPath(
            school.name,
            school.schoolCode,
            'yearbooks',
            yearbook.year
          );
          
          // Upload PDF to Cloudinary and convert all pages to individual images
          const { pages, pdfPublicId } = await uploadPdfToCloudinary(
            uploadedPdfPath,
            folderPath
          );
          
          // Generate a unique batch ID for this PDF upload (includes PDF source ID for deletion)
          const pdfUploadBatchId = `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${pdfPublicId}`;
          
          // Create yearbook pages for each extracted image
          const createdPages = [];
          
          for (let i = 0; i < pages.length; i++) {
            const pageData = pages[i];
            
            // For PDF uploads of content, automatically assign first and last pages as covers
            let currentPageType = pageType;
            let currentTitle = title;
            
            if (pageType === "front_cover") {
              currentPageType = "front_cover";
              currentTitle = `${title} - Cover`;
            } else if (pageType === "back_cover") {
              currentPageType = "back_cover"; 
              currentTitle = `${title} - Back Cover`;
            } else {
              // For content PDFs, automatically mark first page as front cover and last as back cover
              if (i === 0) {
                currentPageType = "front_cover";
                currentTitle = "Front Cover";
              } else if (i === pages.length - 1) {
                currentPageType = "back_cover";
                currentTitle = "Back Cover";
              } else {
                currentPageType = "content";
                currentTitle = `Page ${i}`;
              }
            }
            
            const pageNumber = (currentPageType === "front_cover" || currentPageType === "back_cover") 
              ? 0 
              : await storage.getNextPageNumber(yearbookId);
            
            // Store secure_url which is HTTPS by default
            const page = await storage.createYearbookPage({
              yearbookId,
              title: currentTitle,
              imageUrl: pageData.secureUrl,
              cloudinaryPublicId: pageData.publicId,
              pageType: currentPageType,
              pageNumber,
              status: 'draft', // Always create as draft
              pdfUploadBatchId
            });
            
            createdPages.push(page);
            
            // For covers, only process first page (front) or last page (back)
            if (pageType === "front_cover" && i === 0) break;
            if (pageType === "back_cover" && i === pages.length - 1) break;
          }
          
          // For content PDFs, automatically set front and back covers as DRAFTS
          if (pageType === "content" && createdPages.length >= 2) {
            const frontCover = createdPages[0];
            const backCover = createdPages[createdPages.length - 1];
            
            await storage.setDraftCovers(
              yearbookId,
              frontCover.imageUrl,
              backCover.imageUrl
            );
            
            console.log(`Auto-assigned DRAFT covers: front=${frontCover.imageUrl}, back=${backCover.imageUrl}`);
          }
          
          // Mark yearbook as having unsaved drafts
          await db.update(yearbooks)
            .set({ hasUnsavedDrafts: true })
            .where(eq(yearbooks.id, yearbookId));
          
          // Clean up original PDF file
          await fs.unlink(uploadedPdfPath);
          
          res.status(201).json({ 
            message: `PDF processed successfully via Cloudinary. Created ${createdPages.length} page(s).`,
            pages: createdPages,
            pagesCreated: createdPages.length,
            isPDFProcessed: true,
            coversAutoAssigned: pageType === "content" && createdPages.length >= 2,
            pdfUploadBatchId
          });
          
        } catch (error: any) {
          console.error('PDF processing error:', error);
          // Clean up PDF file on error
          try {
            await fs.unlink(uploadedPdfPath);
          } catch (cleanupError) {
            console.warn('Could not clean up PDF file:', cleanupError);
          }
          
          return res.status(500).json({ 
            message: "Failed to process PDF via Cloudinary. Please try again or upload individual image files.",
            error: error.message 
          });
        }
        
      } else {
        // Handle regular image upload using Cloudinary
        const uploadedImagePath = path.join(process.cwd(), 'public/uploads/yearbooks', req.file.filename);
        
        try {
          // Get yearbook and school info for organized folder structure
          const yearbook = await storage.getYearbookById(yearbookId);
          if (!yearbook) {
            throw new Error('Yearbook not found');
          }
          const school = await storage.getSchool(yearbook.schoolId);
          if (!school) {
            throw new Error('School not found');
          }
          
          // Generate organized folder path
          const folderPath = generateFolderPath(
            school.name,
            school.schoolCode,
            'yearbooks',
            yearbook.year
          );
          
          // Use authenticated upload for content pages, public for covers
          const isContentPage = pageType === "content";
          const cloudinaryResult = isContentPage
            ? await uploadSecureYearbookPage(uploadedImagePath, folderPath)
            : await uploadToCloudinary(uploadedImagePath, folderPath);
          
          // Use custom page number if provided (for pending pages), otherwise auto-assign
          const pageNumber = (pageType === "front_cover" || pageType === "back_cover") 
            ? 0 
            : (customPageNumber ? parseInt(customPageNumber as string) : await storage.getNextPageNumber(yearbookId));
          
          const page = await storage.createYearbookPage({
            yearbookId,
            title,
            imageUrl: cloudinaryResult.secureUrl,
            cloudinaryPublicId: cloudinaryResult.publicId,
            pageType,
            pageNumber,
            status: 'draft' // Always create as draft
          });
          
          // Mark yearbook as having unsaved drafts
          await db.update(yearbooks)
            .set({ hasUnsavedDrafts: true })
            .where(eq(yearbooks.id, yearbookId));
          
          // Clean up local file after successful upload
          await fs.unlink(uploadedImagePath);
          
          res.status(201).json(page);
        } catch (error: any) {
          console.error('Image upload to Cloudinary error:', error);
          // Clean up local file on error
          try {
            await fs.unlink(uploadedImagePath);
          } catch (cleanupError) {
            console.warn('Could not clean up local file:', cleanupError);
          }
          
          return res.status(500).json({ 
            message: "Failed to upload image to Cloudinary",
            error: error.message 
          });
        }
      }
      
    } catch (error) {
      console.error("Error uploading page:", error);
      
      // Handle multer errors specifically
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "File too large. Maximum size is 20MB." });
        }
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to upload page" });
    }
  });

  app.delete("/api/yearbooks/pages/:pageId", async (req, res) => {
    try {
      const { pageId } = req.params;
      
      // Get page data before deletion
      const page = await storage.getYearbookPageById(pageId);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }
      
      // If page is published, mark as draft_deleted instead of hard deleting
      if (page.status === 'published') {
        await db.update(yearbookPages)
          .set({ status: 'draft_deleted' })
          .where(eq(yearbookPages.id, pageId));
        
        // Mark yearbook as having unsaved drafts
        await db.update(yearbooks)
          .set({ hasUnsavedDrafts: true })
          .where(eq(yearbooks.id, page.yearbookId));
        
        return res.json({ message: "Page marked for deletion (will be permanent when you save changes)" });
      }
      
      // If page is draft or draft_deleted, actually delete it permanently
      const success = await storage.deleteYearbookPage(pageId);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete page from database" });
      }
      
      // Clean up associated image file for draft pages only
      try {
        // Delete from Cloudinary if publicId exists
        if (page.cloudinaryPublicId) {
          await deleteFromCloudinary(page.cloudinaryPublicId);
          console.log(`Deleted from Cloudinary: ${page.cloudinaryPublicId}`);
        }
        
        // Also handle local file cleanup for backward compatibility
        const imageUrl = page.imageUrl;
        
        // Only clean up local files if not a Cloudinary URL
        if (!imageUrl.includes('cloudinary.com') && imageUrl.startsWith('/api/secure-image/yearbooks/')) {
          // Extract the file path from secure image URL
          // Format: /api/secure-image/yearbooks/filename OR /api/secure-image/yearbooks/pdf_pages_timestamp/filename
          const urlParts = imageUrl.split('/');
          const lastPart = urlParts[urlParts.length - 1]; // filename
          const secondLastPart = urlParts[urlParts.length - 2]; // might be folder or 'yearbooks'
          
          if (secondLastPart && secondLastPart.startsWith('pdf_pages_')) {
            // This is a PDF-extracted image in a subdirectory
            const folderPath = path.join(process.cwd(), 'public/uploads/yearbooks', secondLastPart);
            const filePath = path.join(folderPath, lastPart);
            
            // Delete the specific image file
            if (fsSync.existsSync(filePath)) {
              await fs.unlink(filePath);
              console.log(`Deleted PDF-extracted image: ${filePath}`);
            }
            
            // Check if the PDF folder is now empty and delete it
            try {
              const folderContents = await fs.readdir(folderPath);
              if (folderContents.length === 0) {
                await fs.rmdir(folderPath);
                console.log(`Deleted empty PDF folder: ${folderPath}`);
              }
            } catch (folderError) {
              console.warn(`Could not clean up PDF folder ${folderPath}:`, folderError);
            }
            
          } else {
            // This is a regular yearbook image
            const filePath = path.join(process.cwd(), 'public/uploads/yearbooks', lastPart);
            if (fsSync.existsSync(filePath)) {
              await fs.unlink(filePath);
              console.log(`Deleted yearbook image: ${filePath}`);
            }
          }
        }
        
      } catch (cleanupError) {
        console.warn('Could not clean up image file:', cleanupError);
        // Don't fail the delete operation if file cleanup fails
      }
      
      // Check if this page was part of a PDF upload batch and if it was the last page
      if (page.pdfUploadBatchId) {
        try {
          // Check if there are any remaining pages from this PDF batch
          const remainingPages = await storage.getPagesByBatchId(page.pdfUploadBatchId);
          
          if (!remainingPages || remainingPages.length === 0) {
            // This was the last page from the PDF - delete the source PDF from Cloudinary
            console.log(`Last page from PDF batch ${page.pdfUploadBatchId} deleted - cleaning up source PDF`);
            
            const batchParts = page.pdfUploadBatchId.split('-');
            // Check if this is the format with pdfPublicId (at least 4 parts: pdf-timestamp-random-publicId)
            if (batchParts.length >= 4 && batchParts[0] === 'pdf') {
              // Extract pdfPublicId (everything after the first 3 parts)
              const pdfPublicId = batchParts.slice(3).join('-');
              if (pdfPublicId) {
                try {
                  await deleteFromCloudinary(pdfPublicId);
                  console.log(`✅ Deleted source PDF from Cloudinary: ${pdfPublicId}`);
                } catch (pdfError) {
                  console.warn('⚠️  Could not delete source PDF from Cloudinary:', pdfError);
                }
              }
            }
          }
        } catch (batchCheckError) {
          console.warn('Could not check for remaining batch pages:', batchCheckError);
          // Don't fail the delete operation
        }
      }
      
      res.json({ message: "Draft page deleted successfully" });
    } catch (error) {
      console.error("Error deleting page:", error);
      res.status(500).json({ message: "Failed to delete page" });
    }
  });

  // Delete all pages from a PDF upload batch
  app.delete("/api/yearbooks/pdf-batch/:batchId(*)", async (req, res) => {
    try {
      const { batchId } = req.params;
      
      // Get all pages with this batch ID
      const pages = await storage.getPagesByBatchId(batchId);
      
      if (!pages || pages.length === 0) {
        return res.status(404).json({ message: "No pages found for this PDF upload" });
      }
      
      console.log(`Deleting ${pages.length} pages from PDF batch: ${batchId}`);
      
      // Delete each page and its associated files
      for (const page of pages) {
        try {
          // Delete from database
          await storage.deleteYearbookPage(page.id);
          
          // Delete from Cloudinary if publicId exists
          if (page.cloudinaryPublicId) {
            await deleteFromCloudinary(page.cloudinaryPublicId);
            console.log(`Deleted from Cloudinary: ${page.cloudinaryPublicId}`);
          }
          
          // Also handle local file cleanup for backward compatibility
          const imageUrl = page.imageUrl;
          
          if (!imageUrl.includes('cloudinary.com') && imageUrl.startsWith('/api/secure-image/yearbooks/')) {
            const urlParts = imageUrl.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            const secondLastPart = urlParts[urlParts.length - 2];
            
            if (secondLastPart && secondLastPart.startsWith('pdf_pages_')) {
              const folderPath = path.join(process.cwd(), 'public/uploads/yearbooks', secondLastPart);
              const filePath = path.join(folderPath, lastPart);
              
              if (fsSync.existsSync(filePath)) {
                await fs.unlink(filePath);
              }
            } else {
              const filePath = path.join(process.cwd(), 'public/uploads/yearbooks', lastPart);
              if (fsSync.existsSync(filePath)) {
                await fs.unlink(filePath);
              }
            }
          }
        } catch (pageError) {
          console.error(`Error deleting page ${page.id}:`, pageError);
          // Continue with other pages
        }
      }
      
      // Also delete the source PDF from Cloudinary if batch ID contains it
      // Format: pdf-${timestamp}-${random}-${pdfPublicId}
      try {
        const batchParts = batchId.split('-');
        // Check if this is the new format with pdfPublicId (at least 4 parts)
        if (batchParts.length >= 4 && batchParts[0] === 'pdf') {
          // Extract pdfPublicId (everything after the first 3 parts)
          const pdfPublicId = batchParts.slice(3).join('-');
          if (pdfPublicId) {
            await deleteFromCloudinary(pdfPublicId);
            console.log(`Deleted source PDF from Cloudinary: ${pdfPublicId}`);
          }
        }
      } catch (pdfError) {
        console.warn('Could not delete source PDF:', pdfError);
        // Don't fail the whole operation if PDF deletion fails
      }
      
      res.json({ 
        message: `Successfully deleted ${pages.length} pages from PDF upload`,
        deletedCount: pages.length 
      });
    } catch (error) {
      console.error("Error deleting PDF batch:", error);
      res.status(500).json({ message: "Failed to delete PDF batch" });
    }
  });

  // Reset upload type — deletes all pages and updates uploadType
  app.delete("/api/yearbooks/:yearbookId/reset-upload-type", async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const { newUploadType } = req.body;

      if (!newUploadType || !["image", "pdf"].includes(newUploadType)) {
        return res.status(400).json({ message: "Invalid upload type. Must be 'image' or 'pdf'." });
      }

      const pages = await db.select().from(yearbookPages).where(eq(yearbookPages.yearbookId, yearbookId));

      for (const page of pages) {
        try {
          if (page.cloudinaryPublicId) {
            await deleteFromCloudinary(page.cloudinaryPublicId);
          }

          const imageUrl = page.imageUrl;
          if (imageUrl && !imageUrl.includes('cloudinary.com') && imageUrl.startsWith('/api/secure-image/yearbooks/')) {
            const urlParts = imageUrl.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            const secondLastPart = urlParts[urlParts.length - 2];
            if (secondLastPart && secondLastPart.startsWith('pdf_pages_')) {
              const filePath = path.join(process.cwd(), 'public/uploads/yearbooks', secondLastPart, lastPart);
              if (fsSync.existsSync(filePath)) await fs.unlink(filePath);
            } else {
              const filePath = path.join(process.cwd(), 'public/uploads/yearbooks', lastPart);
              if (fsSync.existsSync(filePath)) await fs.unlink(filePath);
            }
          }
        } catch (err) {
          console.error(`Error cleaning up page ${page.id}:`, err);
        }
      }

      // Also try to delete source PDFs referenced in batch IDs
      const batchIds = [...new Set(pages.map(p => p.pdfUploadBatchId).filter(Boolean))] as string[];
      for (const batchId of batchIds) {
        try {
          const batchParts = batchId.split('-');
          if (batchParts.length >= 4 && batchParts[0] === 'pdf') {
            const pdfPublicId = batchParts.slice(3).join('-');
            if (pdfPublicId) await deleteFromCloudinary(pdfPublicId);
          }
        } catch (err) {
          console.warn('Could not delete source PDF for batch:', batchId, err);
        }
      }

      await db.delete(yearbookPages).where(eq(yearbookPages.yearbookId, yearbookId));

      await db.update(yearbooks)
        .set({ uploadType: newUploadType, detectedAspectRatio: null, hasUnsavedDrafts: false })
        .where(eq(yearbooks.id, yearbookId));

      res.json({ message: `Upload type reset to '${newUploadType}'. All pages deleted.`, deletedCount: pages.length });
    } catch (error) {
      console.error("Error resetting upload type:", error);
      res.status(500).json({ message: "Failed to reset upload type" });
    }
  });

  // Reorder yearbook page
  app.patch("/api/yearbooks/pages/:pageId/reorder", async (req, res) => {
    try {
      const { pageId } = req.params;
      const { pageNumber } = req.body;

      if (typeof pageNumber !== 'number' || pageNumber < 1) {
        return res.status(400).json({ message: "Invalid page number" });
      }

      const updatedPage = await storage.updateYearbookPageOrder(pageId, pageNumber);
      if (!updatedPage) {
        return res.status(404).json({ message: "Page not found" });
      }

      res.json(updatedPage);
    } catch (error) {
      console.error("Error reordering page:", error);
      res.status(500).json({ message: "Failed to reorder page" });
    }
  });

  app.post("/api/yearbooks/:yearbookId/table-of-contents", async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const tocItem = await storage.createTableOfContentsItem({
        ...req.body,
        yearbookId
      });
      res.status(201).json(tocItem);
    } catch (error) {
      console.error("Error creating TOC item:", error);
      res.status(500).json({ message: "Failed to create table of contents item" });
    }
  });

  // Update table of contents item
  app.patch("/api/yearbooks/table-of-contents/:tocId", async (req, res) => {
    try {
      const { tocId } = req.params;
      const updatedItem = await storage.updateTableOfContentsItem(tocId, req.body);
      if (!updatedItem) {
        return res.status(404).json({ message: "TOC item not found" });
      }
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating TOC item:", error);
      res.status(500).json({ message: "Failed to update table of contents item" });
    }
  });

  // Delete table of contents item
  app.delete("/api/yearbooks/table-of-contents/:tocId", async (req, res) => {
    try {
      const { tocId } = req.params;
      const success = await storage.deleteTableOfContentsItem(tocId);
      if (!success) {
        return res.status(404).json({ message: "TOC item not found" });
      }
      res.json({ message: "TOC item deleted successfully" });
    } catch (error) {
      console.error("Error deleting TOC item:", error);
      res.status(500).json({ message: "Failed to delete table of contents item" });
    }
  });

  // Update yearbook orientation, upload type, initialization status, and detected aspect ratio
  app.patch("/api/yearbooks/:yearbookId", async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const { orientation, uploadType, isInitialized, detectedAspectRatio } = req.body;
      
      console.log('📝 Updating yearbook setup:', { yearbookId, orientation, uploadType, isInitialized, detectedAspectRatio });
      
      if (orientation && !["portrait", "landscape"].includes(orientation)) {
        return res.status(400).json({ message: "Invalid orientation. Must be 'portrait' or 'landscape'" });
      }
      
      if (uploadType && !["image", "pdf"].includes(uploadType)) {
        return res.status(400).json({ message: "Invalid upload type. Must be 'image' or 'pdf'" });
      }
      
      // Build update object
      const updates: any = {};
      if (orientation !== undefined) {
        updates.orientation = orientation;
      }
      if (uploadType !== undefined) {
        updates.uploadType = uploadType;
      }
      if (isInitialized !== undefined) {
        updates.isInitialized = isInitialized;
      }
      if (detectedAspectRatio !== undefined) {
        updates.detectedAspectRatio = detectedAspectRatio;
      }
      
      console.log('📦 Updates to apply:', updates);
      
      const updatedYearbook = await storage.updateYearbook(yearbookId, updates);
      if (!updatedYearbook) {
        console.error('❌ Yearbook not found:', yearbookId);
        return res.status(404).json({ message: "Yearbook not found" });
      }
      
      console.log('✅ Yearbook updated successfully:', { 
        id: updatedYearbook.id, 
        orientation: updatedYearbook.orientation, 
        uploadType: updatedYearbook.uploadType,
        isInitialized: updatedYearbook.isInitialized 
      });
      
      res.json(updatedYearbook);
    } catch (error) {
      console.error("❌ Error updating yearbook:", error);
      res.status(500).json({ message: "Failed to update yearbook" });
    }
  });

  // Update yearbook price
  app.patch("/api/yearbooks/:yearbookId/price", async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const { price, userId } = req.body;
      
      // Validate price
      const priceNum = parseFloat(price);
      if (isNaN(priceNum)) {
        return res.status(400).json({ message: "Invalid price format" });
      }
      
      if (priceNum < 1.99 || priceNum > 49.99) {
        return res.status(400).json({ message: "Price must be between $1.99 and $49.99" });
      }
      
      const result = await storage.updateYearbookPrice(yearbookId, price, userId);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error updating yearbook price:", error);
      res.status(500).json({ message: "Failed to update yearbook price" });
    }
  });

  // Get yearbook price history
  app.get("/api/yearbooks/:yearbookId/price-history", async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const history = await storage.getYearbookPriceHistory(yearbookId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching price history:", error);
      res.status(500).json({ message: "Failed to fetch price history" });
    }
  });

  // Check if can increase yearbook price
  app.get("/api/yearbooks/:yearbookId/can-increase-price", async (req, res) => {
    try {
      const { yearbookId} = req.params;
      const result = await storage.canChangeYearbookPrice(yearbookId);
      res.json(result);
    } catch (error) {
      console.error("Error checking price increase eligibility:", error);
      res.status(500).json({ message: "Failed to check price increase eligibility" });
    }
  });

  // Update yearbook free status
  app.patch("/api/yearbooks/:yearbookId/free-status", async (req, res) => {
    try {
      const { yearbookId } = req.params;
      const { isFree } = req.body;
      
      if (typeof isFree !== 'boolean') {
        return res.status(400).json({ message: "isFree must be a boolean value" });
      }
      
      const updatedYearbook = await storage.updateYearbook(yearbookId, { isFree });
      
      if (!updatedYearbook) {
        return res.status(404).json({ message: "Yearbook not found" });
      }
      
      res.json(updatedYearbook);
    } catch (error) {
      console.error("Error updating yearbook free status:", error);
      res.status(500).json({ message: "Failed to update yearbook free status" });
    }
  });

  // Super Admin API Routes - Protected by middleware
  
  // Get all users
  app.get("/api/super-admin/users", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get all schools
  app.get("/api/super-admin/schools", requireSuperAdmin, async (req, res) => {
    try {
      const schools = await storage.getAllSchools();
      
      // Fetch admin user for each school to get username
      const schoolsWithAdmin = await Promise.all(schools.map(async (school) => {
        const adminUser = await storage.getSchoolAdminUser(school.id);
        return {
          ...school,
          adminUsername: adminUser?.username || school.tempAdminCredentials?.username || null
        };
      }));
      
      res.json(schoolsWithAdmin);
    } catch (error) {
      console.error("Error fetching schools:", error);
      res.status(500).json({ message: "Failed to fetch schools" });
    }
  });

  // Get all alumni badges
  app.get("/api/super-admin/alumni-badges", requireSuperAdmin, async (req, res) => {
    try {
      const badges = await storage.getAllAlumniBadges();
      res.json(badges);
    } catch (error) {
      console.error("Error fetching alumni badges:", error);
      res.status(500).json({ message: "Failed to fetch alumni badges" });
    }
  });

  // Get all alumni requests
  app.get("/api/super-admin/alumni-requests", requireSuperAdmin, async (req, res) => {
    try {
      const requests = await storage.getAllAlumniRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching alumni requests:", error);
      res.status(500).json({ message: "Failed to fetch alumni requests" });
    }
  });

  // Delete user
  app.delete("/api/super-admin/users/:userId", requireSuperAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const success = await storage.deleteUser(userId);
      
      if (success) {
        // Log the admin action
        await storage.logAdminAction(
          req.superAdmin.id,
          'deleted_user',
          'user',
          userId,
          { username: req.body.username || 'unknown' }
        );
        res.json({ message: "User deleted successfully" });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Delete school
  app.delete("/api/super-admin/schools/:schoolId", requireSuperAdmin, async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      // Get school info before deletion for Cloudinary cleanup
      const school = await storage.getSchool(schoolId);
      
      const success = await storage.deleteSchool(schoolId);
      
      if (success) {
        // Asynchronously delete Cloudinary assets (don't wait for completion)
        if (school) {
          deleteSchoolAssets(school.name, school.schoolCode)
            .then(result => {
              if (result.success) {
                console.log(`✅ Cloudinary cleanup complete for ${school.name}: ${result.deletedCount} assets deleted`);
              } else {
                console.error(`⚠️ Cloudinary cleanup had errors for ${school.name}:`, result.errors);
              }
            })
            .catch(err => {
              console.error(`❌ Cloudinary cleanup failed for ${school.name}:`, err);
            });
        }
        
        // Log the admin action
        await storage.logAdminAction(
          req.superAdmin.id,
          'deleted_school',
          'school',
          schoolId,
          { schoolName: req.body.schoolName || school?.name || 'unknown' }
        );
        res.json({ message: "School deleted successfully" });
      } else {
        res.status(404).json({ message: "School not found" });
      }
    } catch (error) {
      console.error("Error deleting school:", error);
      res.status(500).json({ message: "Failed to delete school" });
    }
  });

  // Update user role
  app.patch("/api/super-admin/users/:userId/role", requireSuperAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { userType } = req.body;
      
      const validRoles = ['viewer', 'school', 'super_admin'];
      if (!validRoles.includes(userType)) {
        return res.status(400).json({ message: "Invalid user type" });
      }

      const updatedUser = await storage.updateUserRole(userId, userType);
      
      if (updatedUser) {
        // Log the admin action
        await storage.logAdminAction(
          req.superAdmin.id,
          'updated_user_role',
          'user',
          userId,
          { newRole: userType, previousRole: req.body.previousRole }
        );
        
        const { password, ...safeUser } = updatedUser;
        res.json(safeUser);
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Approve/Deny alumni badge
  app.patch("/api/super-admin/alumni-badges/:badgeId", requireSuperAdmin, async (req, res) => {
    try {
      const { badgeId } = req.params;
      const { status } = req.body;
      
      if (!['verified', 'pending'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updatedBadge = await storage.updateAlumniBadgeStatus(badgeId, status);
      
      if (updatedBadge) {
        // Log the admin action
        await storage.logAdminAction(
          req.superAdmin.id,
          status === 'verified' ? 'approved_alumni_badge' : 'revoked_alumni_badge',
          'alumni_badge',
          badgeId,
          { status, fullName: updatedBadge.fullName }
        );
        res.json(updatedBadge);
      } else {
        res.status(404).json({ message: "Alumni badge not found" });
      }
    } catch (error) {
      console.error("Error updating alumni badge:", error);
      res.status(500).json({ message: "Failed to update alumni badge" });
    }
  });

  // Delete alumni badge
  app.delete("/api/super-admin/alumni-badges/:badgeId", requireSuperAdmin, async (req, res) => {
    try {
      const { badgeId } = req.params;
      const success = await storage.deleteAlumniBadge(badgeId);
      
      if (success) {
        // Log the admin action
        await storage.logAdminAction(
          req.superAdmin.id,
          'deleted_alumni_badge',
          'alumni_badge',
          badgeId,
          { reason: 'admin_deletion' }
        );
        res.json({ message: "Alumni badge deleted successfully" });
      } else {
        res.status(404).json({ message: "Alumni badge not found" });
      }
    } catch (error) {
      console.error("Error deleting alumni badge:", error);
      res.status(500).json({ message: "Failed to delete alumni badge" });
    }
  });

  // Get admin logs
  app.get("/api/super-admin/logs", requireSuperAdmin, async (req, res) => {
    try {
      const logs = await storage.getAdminLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching admin logs:", error);
      res.status(500).json({ message: "Failed to fetch admin logs" });
    }
  });

  // Get login activity for super admin
  app.get("/api/super-admin/login-activity", requireSuperAdmin, async (req, res) => {
    try {
      const loginActivities = await storage.getLoginActivitiesByUser(req.superAdmin.id, 50);
      res.json(loginActivities);
    } catch (error) {
      console.error("Error fetching login activity:", error);
      res.status(500).json({ message: "Failed to fetch login activity" });
    }
  });

  // Get pending school requests
  app.get("/api/super-admin/pending-schools", requireSuperAdmin, async (req, res) => {
    try {
      const pendingSchools = await storage.getPendingSchools();
      res.json(pendingSchools);
    } catch (error) {
      console.error("Error fetching pending schools:", error);
      res.status(500).json({ message: "Failed to fetch pending schools" });
    }
  });

  // Approve school request - Creates the actual user account
  app.post("/api/super-admin/approve-school/:schoolId", requireSuperAdmin, async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      // Get the pending school request with admin credentials
      const pendingSchool = await storage.getSchoolById(schoolId);
      if (!pendingSchool || pendingSchool.approvalStatus !== 'pending') {
        return res.status(404).json({ message: "Pending school request not found" });
      }
      
      if (!pendingSchool.tempAdminCredentials) {
        return res.status(400).json({ message: "Admin credentials not found for this school" });
      }
      
      // Generate 12-character alphanumeric activation code
      const generateActivationCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 12; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      let activationCode = generateActivationCode();
      // Ensure activation code is unique
      while (await storage.getSchoolByActivationCode(activationCode)) {
        activationCode = generateActivationCode();
      }

      // First approve the school
      const school = await storage.approveSchool(schoolId, req.superAdmin.id, activationCode);
      
      if (school) {
        // NOW create the actual school admin user account
        const adminCredentials = pendingSchool.tempAdminCredentials as any;
        const user = await storage.createUser({
          username: adminCredentials.username,
          password: adminCredentials.password,
          userType: "school",
          firstName: adminCredentials.firstName,
          lastName: adminCredentials.lastName,
          dateOfBirth: "1970-01-01", // Default date for school admin accounts
          email: school.email,
          phoneNumber: school.phoneNumber, // Copy phone number from school record
          profileImage: null,
          schoolId: school.id, // Link the user to the school
        });
        
        // Clear the temporary credentials after creating the account
        await storage.clearTempAdminCredentials(schoolId);
        
        // Delete accreditation document after approval (save storage space)
        if (pendingSchool.accreditationDocument) {
          try {
            await fs.unlink(pendingSchool.accreditationDocument);
            console.log(`Deleted accreditation document: ${pendingSchool.accreditationDocument}`);
          } catch (error) {
            console.warn(`Failed to delete accreditation document: ${pendingSchool.accreditationDocument}`, error);
            // Don't fail the approval if file deletion fails
          }
        }
        
        // Log the admin action
        await storage.logAdminAction(
          req.superAdmin.id,
          'school_approval',
          'school',
          schoolId,
          { schoolName: school.name, activationCode, adminUsername: adminCredentials.username }
        );
        
        // Send approval email to the school with liquid glass template
        try {
          const domain = process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
          const protocol = process.env.REPLIT_DEV_DOMAIN ? 'https' : 'http';
          const loginUrl = `${protocol}://${domain}/login`;
          
          await sendEmail(
            school.email,
            `${school.name} - School Registration Approved`,
            createSchoolApprovalEmail(
              school.name,
              adminCredentials.username,
              '(password sent separately)',
              loginUrl
            )
          );
        } catch (emailError) {
          console.error("Failed to send approval email:", emailError);
          // Don't fail the approval if email sending fails
        }
        
        res.json({ 
          message: "School approved successfully and admin account created",
          school,
          activationCode, // Keep for internal purposes
          adminUsername: adminCredentials.username
        });
      } else {
        res.status(404).json({ message: "School not found" });
      }
    } catch (error) {
      console.error("Error approving school:", error);
      res.status(500).json({ message: "Failed to approve school" });
    }
  });

  // Reject school request
  app.post("/api/super-admin/reject-school/:schoolId", requireSuperAdmin, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { reason } = req.body;
      
      const school = await storage.rejectSchool(schoolId, req.superAdmin.id, reason);
      
      if (school) {
        // Log the admin action
        await storage.logAdminAction(
          req.superAdmin.id,
          'school_rejection',
          'school',
          schoolId,
          { schoolName: school.name, reason }
        );
        
        // Send rejection email to the school with liquid glass template
        try {
          await sendEmail(
            school.email,
            `${school.name} - School Registration Update`,
            createSchoolRejectionEmail(
              school.name,
              reason || 'Your registration does not meet our current requirements.'
            )
          );
        } catch (emailError) {
          console.error("Failed to send rejection email:", emailError);
          // Don't fail the rejection if email sending fails
        }
        
        res.json({ 
          message: "School request rejected",
          school
        });
      } else {
        res.status(404).json({ message: "School not found" });
      }
    } catch (error) {
      console.error("Error rejecting school:", error);
      res.status(500).json({ message: "Failed to reject school" });
    }
  });

  // Get analytics/statistics
  app.get("/api/super-admin/analytics", requireSuperAdmin, async (req, res) => {
    try {
      const [users, schools, alumniBadges, alumniRequests] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllSchools(),
        storage.getAllAlumniBadges(),
        storage.getAllAlumniRequests()
      ]);

      const analytics = {
        totalUsers: users.length,
        usersByType: {
          viewers: users.filter(u => u.userType === 'viewer').length,
          schools: users.filter(u => u.userType === 'school').length,
          superAdmins: users.filter(u => u.userType === 'super_admin').length,
        },
        totalSchools: schools.length,
        totalAlumniBadges: alumniBadges.length,
        alumniBadgesByStatus: {
          verified: alumniBadges.filter(b => b.status === 'verified').length,
          pending: alumniBadges.filter(b => b.status === 'pending').length,
        },
        totalAlumniRequests: alumniRequests.length,
        alumniRequestsByStatus: {
          pending: alumniRequests.filter(r => r.status === 'pending').length,
          approved: alumniRequests.filter(r => r.status === 'approved').length,
          denied: alumniRequests.filter(r => r.status === 'denied').length,
        }
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Super Admin Year Management Routes
  
  // Get year purchases for a specific school (for super admin)
  app.get("/api/super-admin/school-years/:schoolId", requireSuperAdmin, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const school = await storage.getSchoolById(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      const purchases = await storage.getYearPurchasesBySchool(schoolId);
      
      // Create a comprehensive list of years from school founding year to current year
      console.log(`Super Admin Year Management: Using CURRENT_YEAR = ${CURRENT_YEAR}`);
      const yearsList = [];
      
      for (let year = school.yearFounded; year <= CURRENT_YEAR; year++) {
        const existingPurchase = purchases.find(p => p.year === year);
        yearsList.push({
          year,
          id: existingPurchase?.id || null,
          purchased: existingPurchase?.purchased || false,
          purchaseDate: existingPurchase?.purchaseDate || null,
          price: existingPurchase?.price || "14.99",
          unlockedByAdmin: existingPurchase?.unlockedByAdmin || false
        });
      }
      
      res.json({
        school: {
          id: school.id,
          name: school.name,
          yearFounded: school.yearFounded
        },
        years: yearsList
      });
    } catch (error) {
      console.error("Error fetching school years:", error);
      res.status(500).json({ message: "Failed to fetch school years" });
    }
  });

  // Verify super admin password
  app.post("/api/super-admin/verify-password", requireSuperAdmin, async (req, res) => {
    try {
      const { password } = req.body;
      const user = req.superAdmin as any;
      
      // Get user with password from storage to verify
      const userWithPassword = await storage.getUserWithPassword(user.id);
      if (!userWithPassword) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Use bcrypt to compare the password with the stored hash
      const isPasswordValid = await comparePassword(password, userWithPassword.password);
      if (isPasswordValid) {
        res.json({ success: true });
      } else {
        res.status(401).json({ message: 'Invalid password' });
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      res.status(500).json({ message: 'Failed to verify password' });
    }
  });

  // Unlock/lock year for a school (super admin)
  app.post("/api/super-admin/unlock-year", requireSuperAdmin, async (req, res) => {
    try {
      const { schoolId, year, unlock, orientation, uploadType } = req.body;
      
      if (!schoolId || !year || typeof unlock !== 'boolean') {
        return res.status(400).json({ message: "School ID, year, and unlock status are required" });
      }

      // When unlocking, uploadType is required (orientation is no longer required)
      if (unlock && !uploadType) {
        return res.status(400).json({ 
          message: "Upload type is required when unlocking a year" 
        });
      }

      const school = await storage.getSchoolById(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      // Check if a purchase record exists for this school/year
      const purchases = await storage.getYearPurchasesBySchool(schoolId);
      let existingPurchase = purchases.find(p => p.year === year);
      
      if (existingPurchase) {
        // Update existing purchase record
        const updatedPurchase = await storage.updateYearPurchase(existingPurchase.id, unlock, unlock);
        
        // If unlocking, create or update yearbook with orientation and upload type
        if (unlock) {
          // Delete any cart items for this school and year
          const deletedCartItems = await storage.deleteCartItemsBySchoolAndYear(schoolId, year);
          
          // Check if yearbook exists
          const existingYearbook = await storage.getYearbookBySchoolAndYear(schoolId, year);
          
          if (existingYearbook) {
            // Update existing yearbook with orientation, uploadType, and isInitialized
            await storage.updateYearbook(existingYearbook.id, {
              orientation,
              uploadType,
              isInitialized: true
            });
          } else {
            // Create new yearbook
            await storage.createYearbook({
              schoolId,
              year,
              title: `${school.name} ${year}`,
              orientation,
              uploadType,
              isInitialized: true,
              isPublished: false
            });
          }
        }
        
        // Log the admin action
        await storage.logAdminAction(
          req.superAdmin.id,
          unlock ? 'unlocked_year' : 'locked_year',
          'year_purchase',
          existingPurchase.id,
          { 
            schoolName: school.name,
            schoolId,
            year,
            previousStatus: existingPurchase.purchased,
            newStatus: unlock,
            orientation: unlock ? orientation : undefined,
            uploadType: unlock ? uploadType : undefined,
            deletedCartItems: unlock ? await storage.deleteCartItemsBySchoolAndYear(schoolId, year) : 0
          }
        );
        
        res.json({ 
          message: `Year ${year} ${unlock ? 'unlocked' : 'locked'} for ${school.name}`,
          purchase: updatedPurchase,
          orientation: unlock ? orientation : undefined,
          uploadType: unlock ? uploadType : undefined
        });
      } else {
        // Create new purchase record
        const newPurchase = await storage.createYearPurchase({
          schoolId,
          year,
          purchased: unlock,
          purchaseDate: unlock ? new Date() : null,
          price: "14.99",
          unlockedByAdmin: unlock
        });
        
        // If unlocking, create yearbook with orientation and upload type
        if (unlock) {
          // Delete any cart items for this school and year
          const deletedCartItems = await storage.deleteCartItemsBySchoolAndYear(schoolId, year);
          
          // Check if yearbook exists
          const existingYearbook = await storage.getYearbookBySchoolAndYear(schoolId, year);
          
          if (existingYearbook) {
            // Update existing yearbook
            await storage.updateYearbook(existingYearbook.id, {
              orientation,
              uploadType,
              isInitialized: true
            });
          } else {
            // Create new yearbook
            await storage.createYearbook({
              schoolId,
              year,
              title: `${school.name} ${year}`,
              orientation,
              uploadType,
              isInitialized: true,
              isPublished: false
            });
          }
        }
        
        // Log the admin action
        await storage.logAdminAction(
          req.superAdmin.id,
          unlock ? 'unlocked_year' : 'locked_year',
          'year_purchase', 
          newPurchase.id,
          { 
            schoolName: school.name,
            schoolId,
            year,
            newStatus: unlock,
            orientation: unlock ? orientation : undefined,
            uploadType: unlock ? uploadType : undefined,
            deletedCartItems: unlock ? await storage.deleteCartItemsBySchoolAndYear(schoolId, year) : 0
          }
        );
        
        res.json({ 
          message: `Year ${year} ${unlock ? 'unlocked' : 'locked'} for ${school.name}`,
          purchase: newPurchase,
          orientation: unlock ? orientation : undefined,
          uploadType: unlock ? uploadType : undefined
        });
      }
    } catch (error) {
      console.error("Error toggling year lock:", error);
      res.status(500).json({ message: "Failed to update year status" });
    }
  });

  // Paystack Payment Integration Routes
  
  // Create subaccount for school (revenue sharing setup)
  app.post("/api/schools/:schoolId/create-subaccount", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { bankAccountNumber, bankCode } = req.body;
      
      // Validate required fields
      if (!bankAccountNumber || !bankCode) {
        return res.status(400).json({ 
          status: false, 
          message: "Bank account number and bank code are required" 
        });
      }

      // Get school details
      const school = await storage.getSchoolById(schoolId);
      if (!school) {
        return res.status(404).json({
          status: false,
          message: 'School not found'
        });
      }

      // First, verify the bank account with Paystack
      const bankVerificationResponse = await fetch(`https://api.paystack.co/bank/resolve?account_number=${bankAccountNumber}&bank_code=${bankCode}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      const bankVerificationResult = await bankVerificationResponse.json();

      if (!bankVerificationResult.status) {
        return res.status(400).json({
          status: false,
          message: 'Bank account verification failed',
          error: bankVerificationResult.message
        });
      }

      // Create subaccount with Paystack
      const subaccountData = {
        business_name: school.name,
        settlement_bank: bankCode,
        account_number: bankAccountNumber,
        percentage_charge: 80, // School gets 80%
        description: `Revenue sharing subaccount for ${school.name}`,
        primary_contact_email: school.email,
        primary_contact_name: school.name,
        primary_contact_phone: null,
        metadata: {
          school_id: schoolId,
          account_holder_name: bankVerificationResult.data.account_name
        }
      };

      const paystackResponse = await fetch('https://api.paystack.co/subaccount', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subaccountData)
      });

      const paystackResult = await paystackResponse.json();

      if (!paystackResult.status) {
        return res.status(400).json({
          status: false,
          message: 'Failed to create subaccount with Paystack',
          error: paystackResult.message
        });
      }

      // Update school with subaccount details
      const updatedSchool = await storage.updateSchoolSubaccount(
        schoolId,
        paystackResult.data.subaccount_code,
        bankAccountNumber,
        bankCode,
        'active'
      );

      res.json({
        status: true,
        message: 'Subaccount created successfully',
        data: {
          subaccount_code: paystackResult.data.subaccount_code,
          account_holder_name: bankVerificationResult.data.account_name,
          bank_name: bankVerificationResult.data.bank_name,
          revenue_share_percentage: 80
        }
      });
    } catch (error) {
      console.error('Error creating subaccount:', error);
      res.status(500).json({
        status: false,
        message: 'Internal server error while creating subaccount'
      });
    }
  });

  // Get available banks for subaccount setup
  app.get("/api/banks", async (req, res) => {
    try {
      const response = await fetch('https://api.paystack.co/bank', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (!result.status) {
        return res.status(400).json({
          status: false,
          message: 'Failed to fetch banks from Paystack',
          error: result.message
        });
      }

      res.json({
        status: true,
        data: result.data.map((bank: any) => ({
          name: bank.name,
          code: bank.code,
          slug: bank.slug
        }))
      });
    } catch (error) {
      console.error('Error fetching banks:', error);
      res.status(500).json({
        status: false,
        message: 'Internal server error while fetching banks'
      });
    }
  });

  // Verify bank account for preview (real-time verification)
  app.post("/api/banks/verify-preview", async (req, res) => {
    try {
      const { accountNumber, bankCode } = req.body;

      if (!accountNumber || !bankCode) {
        return res.status(400).json({
          status: false,
          message: 'Bank account number and bank code are required'
        });
      }

      // Verify bank account with Paystack
      const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (!result.status) {
        return res.status(400).json({
          status: false,
          message: result.message || 'Unable to verify bank account'
        });
      }

      res.json({
        status: true,
        data: {
          account_name: result.data.account_name,
          bank_name: result.data.bank_name,
          account_number: accountNumber
        }
      });
    } catch (error) {
      console.error('Error verifying bank account:', error);
      res.status(500).json({
        status: false,
        message: 'Internal server error while verifying bank account'
      });
    }
  });

  // Send 2FA code for bank account change
  app.post("/api/schools/:schoolId/send-bank-2fa", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          status: false,
          message: 'User ID is required'
        });
      }

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          status: false,
          message: 'User not found'
        });
      }

      // Verify user belongs to this school
      if (user.schoolId !== schoolId) {
        return res.status(403).json({
          status: false,
          message: 'Unauthorized access'
        });
      }

      // Check if user has an email
      if (!user.email) {
        return res.status(400).json({
          status: false,
          message: 'No email address on file. Please add an email to your profile first.'
        });
      }

      // Check cooldown (60 seconds)
      if (user.twoFactorCodeSentAt) {
        const now = new Date();
        const timeSinceLastSend = (now.getTime() - user.twoFactorCodeSentAt.getTime()) / 1000;
        if (timeSinceLastSend < 60) {
          const waitTime = Math.ceil(60 - timeSinceLastSend);
          return res.status(429).json({
            status: false,
            message: `Please wait ${waitTime} seconds before requesting another code.`
          });
        }
      }

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedCode = await hashPassword(code);

      // Set expiry (5 minutes)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      // Update user with 2FA code
      await db.update(users)
        .set({
          twoFactorCode: hashedCode,
          twoFactorCodeExpiresAt: expiresAt,
          twoFactorCodeSentAt: new Date()
        })
        .where(eq(users.id, user.id));

      // Send 2FA code via email
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">Bank Account Change Verification</h2>
          <p>Hello ${user.fullName},</p>
          <p>You have requested to change your bank account information. Please use the following verification code:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="color: #1e3a8a; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you did not request this change, please ignore this email and contact support immediately.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `;

      await sendEmail({
        to: user.email,
        subject: "Bank Account Change - Verification Code",
        text: `Your verification code is: ${code}. This code will expire in 5 minutes.`,
        html: emailHtml
      });

      res.json({
        status: true,
        message: 'Verification code sent to your email'
      });
    } catch (error) {
      console.error('Error sending bank 2FA code:', error);
      res.status(500).json({
        status: false,
        message: 'Failed to send verification code'
      });
    }
  });

  // Verify 2FA code for bank account change
  app.post("/api/schools/:schoolId/verify-bank-2fa", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { userId, code } = req.body;

      if (!userId || !code) {
        return res.status(400).json({
          status: false,
          message: 'User ID and verification code are required'
        });
      }

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          status: false,
          message: 'User not found'
        });
      }

      // Verify user belongs to this school
      if (user.schoolId !== schoolId) {
        return res.status(403).json({
          status: false,
          message: 'Unauthorized access'
        });
      }

      // Check if code exists and hasn't expired
      if (!user.twoFactorCode || !user.twoFactorCodeExpiresAt) {
        return res.status(400).json({
          status: false,
          message: 'No verification code found. Please request a new one.'
        });
      }

      const now = new Date();
      if (now > user.twoFactorCodeExpiresAt) {
        return res.status(400).json({
          status: false,
          message: 'Verification code has expired. Please request a new one.'
        });
      }

      // Verify code
      const isCodeValid = await comparePassword(code.trim(), user.twoFactorCode);
      if (!isCodeValid) {
        return res.status(401).json({
          status: false,
          message: 'Invalid verification code'
        });
      }

      // Don't clear the code yet - we'll clear it after successful bank account update
      // This prevents reuse but allows the update to proceed

      res.json({
        status: true,
        message: 'Verification code confirmed'
      });
    } catch (error) {
      console.error('Error verifying bank 2FA code:', error);
      res.status(500).json({
        status: false,
        message: 'Failed to verify code'
      });
    }
  });

  // Update school bank account (change existing account)
  app.post("/api/schools/:schoolId/update-account", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { bankAccountNumber, bankCode, userId } = req.body;

      if (!bankAccountNumber || !bankCode || !userId) {
        return res.status(400).json({
          status: false,
          message: 'Bank account number, bank code, and user ID are required'
        });
      }

      // Get current school to check restrictions
      const school = await storage.getSchool(schoolId);
      if (!school) {
        return res.status(404).json({
          status: false,
          message: 'School not found'
        });
      }

      if (!school.paystackSubaccountCode) {
        return res.status(400).json({
          status: false,
          message: 'No existing revenue sharing setup found. Please set up revenue sharing first.'
        });
      }

      // Check 30-day restriction
      if (school.lastBankAccountChange) {
        const now = new Date();
        const lastChange = new Date(school.lastBankAccountChange);
        const daysSinceLastChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastChange < 30) {
          const daysRemaining = Math.ceil(30 - daysSinceLastChange);
          return res.status(403).json({
            status: false,
            message: `You can only change your bank account once every 30 days. Please wait ${daysRemaining} more day${daysRemaining === 1 ? '' : 's'}.`,
            daysRemaining
          });
        }
      }

      // Get user and verify 2FA was completed
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          status: false,
          message: 'User not found'
        });
      }

      // Verify user belongs to this school
      if (user.schoolId !== schoolId) {
        return res.status(403).json({
          status: false,
          message: 'Unauthorized access'
        });
      }

      // Verify that 2FA code exists and is still valid (hasn't been cleared)
      if (!user.twoFactorCode || !user.twoFactorCodeExpiresAt) {
        return res.status(400).json({
          status: false,
          message: '2FA verification required. Please verify your code first.'
        });
      }

      const now = new Date();
      if (now > user.twoFactorCodeExpiresAt) {
        return res.status(400).json({
          status: false,
          message: '2FA verification expired. Please request a new code.'
        });
      }

      // Verify the new bank account with Paystack
      const bankVerificationResponse = await fetch(`https://api.paystack.co/bank/resolve?account_number=${bankAccountNumber}&bank_code=${bankCode}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      const bankVerificationResult = await bankVerificationResponse.json();

      if (!bankVerificationResult.status) {
        return res.status(400).json({
          status: false,
          message: 'Failed to verify bank account',
          error: bankVerificationResult.message
        });
      }

      // Update the existing subaccount with new bank details
      const updateResponse = await fetch(`https://api.paystack.co/subaccount/${school.paystackSubaccountCode}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bank_code: bankCode,
          account_number: bankAccountNumber
        })
      });

      const updateResult = await updateResponse.json();

      if (!updateResult.status) {
        return res.status(400).json({
          status: false,
          message: 'Failed to update account with Paystack',
          error: updateResult.message
        });
      }

      // Update school record with new bank details
      const updatedSchool = await storage.updateSchoolSubaccount(
        schoolId,
        school.paystackSubaccountCode,
        bankAccountNumber,
        bankCode,
        'active'
      );

      // Clear 2FA code after successful update
      await db.update(users)
        .set({
          twoFactorCode: null,
          twoFactorCodeExpiresAt: null,
          twoFactorCodeSentAt: null
        })
        .where(eq(users.id, userId));

      res.json({
        status: true,
        message: 'Bank account updated successfully',
        data: {
          account_holder_name: bankVerificationResult.data.account_name,
          bank_name: bankVerificationResult.data.bank_name,
          account_number: bankAccountNumber
        }
      });
    } catch (error) {
      console.error('Error updating bank account:', error);
      res.status(500).json({
        status: false,
        message: 'Internal server error while updating bank account'
      });
    }
  });

  // Initialize payment with Paystack (with revenue sharing)
  app.post("/api/payments/initialize", async (req, res) => {
    try {
      const { email, firstName, lastName, phone, amount, cartItems, userId } = req.body;
      
      // Validate required fields - lastName is optional for school accounts
      if (!email || !firstName || !phone || !amount || !cartItems || !userId) {
        return res.status(400).json({ 
          status: false, 
          message: "Missing required fields: email, firstName, phone, amount, cartItems, userId" 
        });
      }

      // Create a unique reference for this payment
      const reference = `yearbook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate total amount in kobo
      const totalAmountKobo = Math.round(amount * 100);
      
      // Determine if revenue sharing should apply
      // Revenue sharing (80% school, 20% platform) ONLY applies to YEARBOOK purchases by VIEWERS
      // Year purchases by schools: 100% to platform (NO subaccount)
      // Badge slot purchases: 100% to platform (NO subaccount)
      // Yearbook purchases by viewers: 80% to school, 20% to platform (USE subaccount)
      
      let platformAmount = 0;
      let schoolAmount = 0;
      let splitCode = null;
      let subaccountCode = null;
      
      // Check if this is a yearbook purchase (viewer buying yearbook from school)
      const hasYearbookPurchase = cartItems.some((item: any) => !item.itemType || item.itemType === 'yearbook');
      const hasYearPurchase = cartItems.some((item: any) => item.itemType === 'year');
      const hasBadgeSlotPurchase = cartItems.some((item: any) => item.itemType === 'badge_slot');
      
      // Get school ID from cart items for yearbook purchases only
      const schoolId = hasYearbookPurchase ? cartItems[0]?.schoolId : null;
      
      // Apply revenue sharing ONLY for yearbook purchases by viewers
      if (hasYearbookPurchase && !hasYearPurchase && !hasBadgeSlotPurchase && schoolId) {
        // This is a viewer buying a yearbook - apply 80/20 split
        const platformPercentage = 20;
        const schoolPercentage = 80;
        
        platformAmount = Math.round(totalAmountKobo * (platformPercentage / 100));
        schoolAmount = totalAmountKobo - platformAmount;
        
        const school = await storage.getSchoolById(schoolId);
        
        // Only use subaccount if it's properly configured and starts with ACCT_
        // Paystack subaccount codes always start with ACCT_
        if (school && school.paystackSubaccountCode && 
            school.paystackSubaccountCode.startsWith('ACCT_')) {
          subaccountCode = school.paystackSubaccountCode;
        } else {
          // If no valid subaccount, don't use revenue sharing
          // Platform gets 100% for now (school can set up subaccount later)
          platformAmount = totalAmountKobo;
          schoolAmount = 0;
          subaccountCode = null;
          
          if (process.env.NODE_ENV === 'development') {
            console.log('⚠️  No valid Paystack subaccount found for school. Platform receives 100%.');
          }
        }
      } else {
        // Year purchase, badge slot purchase, or mixed cart: 100% to platform
        platformAmount = totalAmountKobo;
        schoolAmount = 0;
        subaccountCode = null; // Do NOT use subaccount
      }
      
      // Helper function to format phone number for Paystack (Nigerian format)
      const formatPhoneForPaystack = (phoneNumber: string) => {
        if (!phoneNumber) return "";
        
        // Remove all non-digit characters except + at the start
        let cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, "");
        
        // Remove leading + if present
        if (cleaned.startsWith("+")) {
          cleaned = cleaned.substring(1);
        }
        
        // Convert to standard international format with +
        // Handle Nigerian numbers: if starts with 0, replace with 234
        if (cleaned.startsWith("0") && cleaned.length >= 10) {
          return "+234" + cleaned.substring(1);
        }
        // If starts with 234, add +
        if (cleaned.startsWith("234") && cleaned.length >= 13) {
          return "+" + cleaned;
        }
        // If it looks like a Nigerian number without code, add +234
        if (/^[789]/.test(cleaned) && cleaned.length >= 9 && cleaned.length <= 10) {
          return "+234" + cleaned;
        }
        
        // If none of the above work, return with + if not present
        return cleaned.startsWith("+") ? cleaned : "+" + cleaned;
      };

      // Initialize payment with Paystack (with revenue sharing if subaccount exists)
      // Fix: Ensure customer names are properly formatted for Paystack
      const cleanFirstName = (firstName || '').trim();
      const cleanLastName = (lastName || '').trim();
      
      // Paystack requires both first_name and last_name to be non-empty for customer data to show
      const paystackFirstName = cleanFirstName || 'Customer';
      const paystackLastName = cleanLastName || 'Account';
      
      // Determine the callback domain based on environment
      // Priority: APP_DOMAIN (universal) > REPLIT_DEV_DOMAIN (Replit) > localhost (fallback)
      const callbackDomain = process.env.APP_DOMAIN || process.env.REPLIT_DEV_DOMAIN || 'localhost';
      const callbackUrl = `https://${callbackDomain}/api/payments/verify/${reference}`;
      
      // Log payment initialization details in development
      if (process.env.NODE_ENV === 'development') {
        console.log('💰 Payment Initialization:', {
          reference,
          amount: totalAmountKobo / 100,
          hasYearbookPurchase,
          hasYearPurchase,
          hasBadgeSlotPurchase,
          usingSubaccount: !!subaccountCode,
          platformAmount: platformAmount / 100,
          schoolAmount: schoolAmount / 100,
          callbackDomain,
          callbackUrl
        });
      }
      
      console.log('🔗 Paystack callback URL:', callbackUrl);
      
      const paystackData = {
        email,
        first_name: paystackFirstName,
        last_name: paystackLastName,
        phone: formatPhoneForPaystack(phone),
        amount: totalAmountKobo,
        reference,
        currency: 'NGN',
        callback_url: callbackUrl,
        metadata: {
          cart_items: cartItems.length,
          user_id: userId,
          school_id: schoolId,
          platform_amount: platformAmount,
          school_amount: schoolAmount,
          items: cartItems.map((item: any) => ({
            school_id: item.schoolId,
            year: item.year,
            price: item.price
          }))
        },
        ...(subaccountCode && {
          subaccount: subaccountCode,
          transaction_charge: platformAmount,
          bearer: 'subaccount'
        })
      };

      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paystackData)
      });

      const paystackResult = await paystackResponse.json();

      if (!paystackResult.status) {
        return res.status(400).json({
          status: false,
          message: 'Failed to initialize payment with Paystack',
          error: paystackResult.message
        });
      }

      // Store payment record in database for tracking
      await storage.createPaymentRecord({
        reference,
        email,
        amount: totalAmountKobo,
        userId,
        status: 'pending',
        cartItems: JSON.stringify(cartItems),
        paystackData: JSON.stringify(paystackResult.data),
        schoolId,
        splitCode,
        platformAmount,
        schoolAmount,
        splitStatus: 'pending'
      });

      res.json({
        status: true,
        message: 'Payment initialized successfully',
        data: {
          authorization_url: paystackResult.data.authorization_url,
          access_code: paystackResult.data.access_code,
          reference: paystackResult.data.reference
        }
      });
    } catch (error) {
      console.error('Error initializing payment:', error);
      res.status(500).json({
        status: false,
        message: 'Internal server error while initializing payment'
      });
    }
  });

  // Verify payment with Paystack
  app.get("/api/payments/verify/:reference", async (req, res) => {
    try {
      const { reference } = req.params;

      if (!reference) {
        return res.status(400).json({
          status: false,
          message: 'Payment reference is required'
        });
      }

      // Verify payment with Paystack
      const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      const paystackResult = await paystackResponse.json();

      if (!paystackResult.status) {
        return res.status(400).json({
          status: false,
          message: 'Failed to verify payment with Paystack',
          error: paystackResult.message
        });
      }

      const paymentData = paystackResult.data;

      // Get payment record from database
      const paymentRecord = await storage.getPaymentByReference(reference);
      
      if (!paymentRecord) {
        return res.status(404).json({
          status: false,
          message: 'Payment record not found'
        });
      }

      // Determine redirect domain (same logic as callback_url)
      const redirectDomain = process.env.APP_DOMAIN || process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
      const redirectProtocol = redirectDomain.includes('localhost') ? 'http' : 'https';
      
      // Log payment verification details in development
      if (process.env.NODE_ENV === 'development') {
        console.log('💳 Payment Verification:', {
          reference,
          status: paymentData.status,
          gateway_response: paymentData.gateway_response,
          redirectDomain,
          redirectProtocol
        });
      }

      // Check if payment was successful
      // Paystack can return different success messages: "Successful", "Approved", "Payment authorized."
      if (paymentData.status === 'success') {
        // Update payment status in database
        await storage.updatePaymentStatus(reference, 'success');

        // Process the cart items and create purchases
        const cartItems = JSON.parse(paymentRecord.cartItems);
        const userId = paymentRecord.userId;

        // Determine user type to create appropriate purchase records
        const user = await storage.getUserById(userId);
        
        for (const item of cartItems) {
          // Check if this is a badge slot purchase
          if (item.itemType === 'badge_slot') {
            // Update user's badge slots
            const currentSlots = user?.badgeSlots || 4;
            const newSlots = currentSlots + (item.quantity || 1);
            await storage.updateUser(userId, { badgeSlots: newSlots });
            console.log(`✅ Added ${item.quantity} badge slot(s) to user ${userId}. Total: ${newSlots}`);
          } else if (user?.userType === "school") {
            // Create year purchase for school
            await storage.createYearPurchase({
              schoolId: item.schoolId,
              year: item.year,
              purchased: true,
              price: item.price || "4.99",
              purchaseDate: new Date(),
              paymentReference: reference
            });
            
            // Create or update yearbook with configuration from cart
            if (item.orientation && item.uploadType) {
              const existingYearbook = await storage.getYearbookBySchoolAndYear(item.schoolId, item.year);
              
              if (!existingYearbook) {
                // Create new yearbook with configuration
                await storage.createYearbook({
                  schoolId: item.schoolId,
                  year: item.year,
                  title: `${item.year} Yearbook`,
                  isPublished: false,
                  isInitialized: true, // Mark as initialized since config is set
                  orientation: item.orientation,
                  uploadType: item.uploadType
                });
              } else {
                // Update existing yearbook with new configuration
                await storage.updateYearbook(existingYearbook.id, {
                  orientation: item.orientation,
                  uploadType: item.uploadType,
                  isInitialized: true
                });
              }
            }
          } else {
            // Create viewer year purchase
            await storage.createViewerYearPurchase({
              userId: userId,
              schoolId: item.schoolId,
              year: item.year,
              purchased: true,
              price: item.price || "4.99",
              purchaseDate: new Date(),
              paymentReference: reference
            });
          }
        }

        // Clear the user's cart after successful payment
        await storage.clearUserCart(userId);

        // Redirect to success page
        const successUrl = `${redirectProtocol}://${redirectDomain}/cart?payment=success&reference=${reference}`;
        console.log('✅ Payment successful, redirecting to:', successUrl);
        res.redirect(successUrl);
      } else {
        // Payment failed - update status
        await storage.updatePaymentStatus(reference, 'failed');
        
        // Redirect to failure page
        const failureUrl = `${redirectProtocol}://${redirectDomain}/cart?payment=failed&reference=${reference}`;
        console.log('❌ Payment failed, redirecting to:', failureUrl);
        res.redirect(failureUrl);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      res.status(500).json({
        status: false,
        message: 'Internal server error while verifying payment'
      });
    }
  });

  // Get payment status (for frontend polling)
  app.get("/api/payments/status/:reference", async (req, res) => {
    try {
      const { reference } = req.params;
      
      const paymentRecord = await storage.getPaymentByReference(reference);
      
      if (!paymentRecord) {
        return res.status(404).json({
          status: false,
          message: 'Payment record not found'
        });
      }

      res.json({
        status: true,
        data: {
          reference: paymentRecord.reference,
          status: paymentRecord.status,
          amount: paymentRecord.amount,
          email: paymentRecord.email
        }
      });
    } catch (error) {
      console.error('Error getting payment status:', error);
      res.status(500).json({
        status: false,
        message: 'Internal server error while getting payment status'
      });
    }
  });

  // Yearbook codes routes
  
  // Create yearbook codes (for schools)
  app.post("/api/yearbook-codes/create", async (req, res) => {
    const { schoolId, year, count } = req.body;
    
    if (!schoolId || !year || !count) {
      return res.status(400).json({ message: "School ID, year, and count are required" });
    }
    
    if (count < 1 || count > 100) {
      return res.status(400).json({ message: "Count must be between 1 and 100" });
    }
    
    try {
      // Check if the yearbook exists and is published
      const yearbook = await storage.getPublishedYearbook(schoolId, year);
      if (!yearbook) {
        return res.status(400).json({ message: "Published yearbook not found for this year" });
      }
      
      const codes = await storage.createYearbookCodes(schoolId, year, count);
      res.json({ codes, message: `${count} codes generated successfully` });
    } catch (error) {
      console.error('Error creating yearbook codes:', error);
      res.status(500).json({ message: "Failed to generate codes" });
    }
  });

  // Get yearbook codes for a school
  app.get("/api/yearbook-codes/school/:schoolId", async (req, res) => {
    const { schoolId } = req.params;
    
    try {
      const codes = await storage.getYearbookCodesBySchool(schoolId);
      res.json(codes);
    } catch (error) {
      console.error('Error fetching yearbook codes:', error);
      res.status(500).json({ message: "Failed to fetch codes" });
    }
  });

  // Redeem yearbook code (for viewers)
  app.post("/api/yearbook-codes/redeem", async (req, res) => {
    const { code, userId } = req.body;
    
    if (!code || !userId) {
      return res.status(400).json({ message: "Code and user ID are required" });
    }
    
    try {
      const result = await storage.redeemYearbookCode(code, userId);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error redeeming yearbook code:', error);
      res.status(500).json({ message: "Failed to redeem code" });
    }
  });

  // Check user yearbook access
  app.get("/api/yearbook-access/:userId/:schoolId/:year", async (req, res) => {
    const { userId, schoolId, year } = req.params;
    
    const validYear = validateYear(year);
    if (validYear === null) {
      return res.status(400).json({ error: "Invalid or missing year parameter" });
    }
    
    // In beta mode all yearbooks are free — always grant access
    if (BETA_VERSION) {
      return res.json({ hasAccess: true });
    }
    
    try {
      const hasAccess = await storage.checkUserYearbookAccess(userId, schoolId, validYear);
      res.json({ hasAccess });
    } catch (error) {
      console.error('Error checking yearbook access:', error);
      res.status(500).json({ message: "Failed to check access" });
    }
  });

  // Secure Cloudinary Images - Get signed URLs for yearbook pages
  app.get("/api/yearbooks/:schoolId/:year/secure-images", requireAuth, checkYearbookAccess, async (req, res) => {
    try {
      const { schoolId, year } = req.params;
      
      // Get yearbook and pages
      const yearbook = await storage.getYearbookBySchoolAndYear(schoolId, parseInt(year));
      if (!yearbook) {
        return res.status(404).json({ message: "Yearbook not found" });
      }

      const pages = await storage.getYearbookPages(yearbook.id);
      
      // Filter content pages only (exclude front/back covers) and only show published pages for viewers
      const contentPages = pages.filter(page => 
        page.pageType === 'content' && page.status === 'published'
      );
      
      // Generate signed URLs for each page
      const signedPages = contentPages.map(page => ({
        id: page.id,
        pageNumber: page.pageNumber,
        title: page.title,
        signedUrl: page.cloudinaryPublicId 
          ? generateSignedUrl(page.cloudinaryPublicId)
          : page.imageUrl,
        pageType: page.pageType
      }));

      res.json({
        yearbookId: yearbook.id,
        schoolId: yearbook.schoolId,
        year: yearbook.year,
        title: yearbook.title,
        pages: signedPages
      });
    } catch (error) {
      console.error('Error fetching secure yearbook images:', error);
      res.status(500).json({ message: "Failed to fetch yearbook images" });
    }
  });

  // Public Front Cover - No authentication required
  app.get("/api/yearbooks/:schoolId/:year/front-cover", async (req, res) => {
    try {
      const { schoolId, year } = req.params;
      
      const yearbook = await storage.getYearbookBySchoolAndYear(schoolId, parseInt(year));
      if (!yearbook) {
        return res.status(404).json({ message: "Yearbook not found" });
      }

      // Front cover is public, no signed URL needed
      res.json({
        frontCoverUrl: yearbook.frontCoverUrl,
        title: yearbook.title,
        year: yearbook.year,
        schoolId: yearbook.schoolId
      });
    } catch (error) {
      console.error('Error fetching front cover:', error);
      res.status(500).json({ message: "Failed to fetch front cover" });
    }
  });

  // Delete a single yearbook code
  app.delete("/api/yearbook-codes/:codeId", async (req, res) => {
    const { codeId } = req.params;
    
    try {
      await storage.deleteYearbookCode(codeId);
      res.json({ message: "Code deleted successfully" });
    } catch (error) {
      console.error('Error deleting yearbook code:', error);
      res.status(500).json({ message: "Failed to delete code" });
    }
  });

  // Delete all codes for a school and year
  app.delete("/api/yearbook-codes/school/:schoolId/year/:year", async (req, res) => {
    const { schoolId, year } = req.params;
    
    const validYear = validateYear(year);
    if (validYear === null) {
      return res.status(400).json({ error: "Invalid or missing year parameter" });
    }
    
    try {
      await storage.deleteAllYearbookCodes(schoolId, validYear);
      res.json({ message: "All codes deleted successfully" });
    } catch (error) {
      console.error('Error deleting all yearbook codes:', error);
      res.status(500).json({ message: "Failed to delete codes" });
    }
  });

  // Get payment history for a viewer
  app.get("/api/payment-history/:userId", async (req, res) => {
    const { userId } = req.params;
    
    try {
      const paymentHistory = await storage.getViewerPaymentHistory(userId);
      res.json(paymentHistory);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  // Memories are freely accessible - no secure endpoint needed
  // Yearbook images remain secure with purchase verification

  // Secure endpoint for accreditation documents (super-admin only)

  app.get("/api/secure-image/accreditation/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const userId = req.headers['x-user-id'] as string || req.query.userId as string;
      
      console.log(`🔐 Secure accreditation document request: ${filename}, userId: ${userId}`);
      
      if (!userId) {
        console.log('❌ No userId provided for accreditation document access');
        return res.status(401).json({ message: "Authentication required to access accreditation documents" });
      }

      // Get the user to verify permissions
      const user = await storage.getUserById(userId);
      
      if (!user) {
        console.log(`❌ Invalid user ID: ${userId}`);
        return res.status(401).json({ message: "Invalid user" });
      }

      // Only super-admins can access accreditation documents
      if (user.userType !== "super_admin") {
        console.log(`❌ Access denied: ${user.email} (${user.userType}) is not a super-admin`);
        return res.status(403).json({ message: "Access denied. Super-admin privileges required." });
      }

      console.log(`✅ Super-admin access granted: ${user.email}`);
      
      // Serve the accreditation document
      const filePath = path.join(import.meta.dirname, "..", "public", "uploads", "accreditation", filename);
      
      if (!fsSync.existsSync(filePath)) {
        console.log(`❌ Accreditation document not found: ${filePath}`);
        return res.status(404).json({ message: "Accreditation document not found" });
      }

      console.log(`📄 Serving accreditation document: ${filename}`);
      res.sendFile(filePath);
      
    } catch (error) {
      console.error('❌ Error serving accreditation document:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/secure-image/yearbooks/:directory/:filename", async (req, res) => {
    try {
      const { directory, filename } = req.params;
      const userId = req.headers['x-user-id'] as string || req.query.userId as string;
      
      console.log(`🔐 Secure yearbook image request: ${directory}/${filename}, userId: ${userId}`);
      
      if (!userId) {
        console.log('❌ No userId provided for yearbook image access');
        return res.status(401).json({ message: "Authentication required to access images" });
      }

      // Security: Normalize and validate paths to prevent directory traversal
      const normalizedDirectory = path.normalize(directory).replace(/^(\.\.[\/\\])+/, '');
      const normalizedFilename = path.normalize(filename).replace(/^(\.\.[\/\\])+/, '');
      
      // Additional security check: ensure no traversal attempts
      if (normalizedDirectory.includes('..') || normalizedFilename.includes('..') || 
          normalizedDirectory.includes('/') || normalizedFilename.includes('/') ||
          normalizedDirectory.includes('\\') || normalizedFilename.includes('\\')) {
        console.log(`❌ Path traversal attempt blocked: ${directory}/${filename}`);
        return res.status(403).json({ message: "Invalid file path" });
      }

      // Build the file path for PDF pages within the secure uploads directory
      const uploadsDir = path.join(import.meta.dirname, "..", "public", "uploads", "yearbooks");
      const requestedPath = path.join(uploadsDir, normalizedDirectory, normalizedFilename);
      
      // Final security check: ensure resolved path is still within uploads directory
      const resolvedPath = path.resolve(requestedPath);
      const resolvedUploadsDir = path.resolve(uploadsDir);
      
      if (!resolvedPath.startsWith(resolvedUploadsDir)) {
        console.log(`❌ Path escape attempt blocked: ${resolvedPath} vs ${resolvedUploadsDir}`);
        return res.status(403).json({ message: "Access denied - path outside allowed directory" });
      }
      
      if (!fsSync.existsSync(resolvedPath)) {
        console.log(`❌ File not found: ${resolvedPath}`);
        return res.status(404).json({ message: "Image not found" });
      }

      // ✅ NEW: Verify user has permission to access this yearbook
      const user = await storage.getUserById(userId);
      if (!user) {
        console.log(`❌ Invalid user ID: ${userId}`);
        return res.status(401).json({ message: "Invalid user" });
      }

      // Find the yearbook page to determine which yearbook this belongs to
      let page = null;
      let yearbook = null;
      
      if (user.userType === "school" && user.schoolId) {
        const schoolYearbooks = await storage.getYearbooksBySchool(user.schoolId);
        outerLoop: for (const yb of schoolYearbooks) {
          const yearbookPages = await storage.getYearbookPages(yb.id);
          for (const p of yearbookPages) {
            if (p.imageUrl && p.imageUrl.includes(directory) && p.imageUrl.includes(filename)) {
              page = p;
              yearbook = yb;
              break outerLoop;
            }
          }
        }
      } else if (user.userType === "viewer" || user.userType === "super_admin") {
        const allSchools = await storage.getSchools();
        outerLoop: for (const school of allSchools) {
          const schoolYearbooks = await storage.getYearbooksBySchool(school.id);
          for (const yb of schoolYearbooks) {
            const yearbookPages = await storage.getYearbookPages(yb.id);
            for (const p of yearbookPages) {
              if (p.imageUrl && p.imageUrl.includes(directory) && p.imageUrl.includes(filename)) {
                page = p;
                yearbook = yb;
                break outerLoop;
              }
            }
          }
        }
      }

      if (!page || !yearbook) {
        console.log(`❌ Page or yearbook not found for: ${directory}/${filename}`);
        return res.status(404).json({ message: "Image not found" });
      }

      // Front covers are publicly accessible
      if (page.pageType === "front_cover") {
        console.log(`📖 Front cover is public - granting access to ${user.email}`);
        res.sendFile(resolvedPath);
        return;
      }

      // Super admins can access all content
      if (user.userType === "super_admin") {
        console.log(`✅ Super admin access granted for ${user.email}`);
        res.sendFile(resolvedPath);
        return;
      }

      // School admins can access their own content
      if (user.userType === "school" && user.schoolId === yearbook.schoolId) {
        console.log(`✅ School admin access granted for ${user.email}`);
        res.sendFile(resolvedPath);
        return;
      }

      // Viewers must have purchased the yearbook
      if (user.userType === "viewer") {
        const purchases = await storage.getAllViewerYearPurchases(userId);
        const hasPurchased = purchases.some(p => 
          p.schoolId === yearbook.schoolId && 
          p.year === yearbook.year && 
          p.purchased
        );
        
        if (!hasPurchased) {
          console.log(`❌ Viewer access denied - no purchase found for ${user.email}`);
          return res.status(403).json({ 
            message: "You must purchase this yearbook to access its pages" 
          });
        }
        
        console.log(`✅ Viewer access granted for ${user.email}`);
        res.sendFile(resolvedPath);
        return;
      }

      console.log(`❌ Access denied for user type: ${user.userType}`);
      return res.status(403).json({ message: "Access denied" });

    } catch (error) {
      console.error('❌ Error serving yearbook image:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Legacy endpoint for single filename (backward compatibility)
  app.get("/api/secure-image/yearbooks/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const userId = req.headers['x-user-id'] as string || req.query.userId as string;
      
      console.log(`🔐 Secure yearbook image request: ${filename}, userId: ${userId}`);
      
      if (!userId) {
        console.log('❌ No userId provided for yearbook image access');
        return res.status(401).json({ message: "Authentication required to access images" });
      }

      // Since we don't have a direct method to search all yearbook pages by filename,
      // we need to extract the yearbook and page info from the URL path
      // The filename should be in the format: yearbook-page-{timestamp}-{hash}.{ext}
      // We'll need to search through schools to find the matching page
      
      let page = null;
      let yearbook = null;
      
      // Get the user first to know which school they belong to (for efficiency)
      const user = await storage.getUserById(userId);
      
      if (!user) {
        console.log(`❌ Invalid user ID: ${userId}`);
        return res.status(401).json({ message: "Invalid user" });
      }

      console.log(`📋 User found: ${user.email} (${user.userType})`);
      
      // Search strategy: Look across all yearbooks if needed, but prioritize user's own content
      if (user.userType === "school" && user.schoolId) {
        // For school accounts, check their yearbooks first
        const schoolYearbooks = await storage.getYearbooksBySchool(user.schoolId);
        console.log(`🏫 School has ${schoolYearbooks.length} yearbooks`);
        
        for (const yb of schoolYearbooks) {
          const yearbookPages = await storage.getYearbookPages(yb.id);
          console.log(`📚 Yearbook ${yb.title} (${yb.year}) has ${yearbookPages.length} pages`);
          
          for (const p of yearbookPages) {
            console.log(`🔍 Checking page ${p.pageType}: ${p.imageUrl}`);
            if (p.imageUrl && p.imageUrl.includes(filename)) {
              console.log(`✅ MATCH FOUND!`);
              page = p;
              yearbook = yb;
              break;
            }
          }
          if (page) break;
        }
      } else if (user.userType === "viewer") {
        // For viewers, we need to search through all yearbooks to find the image
        // Then check if they have purchased access to that specific yearbook
        console.log(`👀 Viewer account - searching all yearbooks for ${filename}`);
        
        const allSchools = await storage.getSchools();
        console.log(`🔍 Searching across ${allSchools.length} schools for yearbook image`);
        
        outerLoop: for (const school of allSchools) {
          const schoolYearbooks = await storage.getYearbooksBySchool(school.id);
          console.log(`🏫 School ${school.name} has ${schoolYearbooks.length} yearbooks`);
          
          for (const yb of schoolYearbooks) {
            const yearbookPages = await storage.getYearbookPages(yb.id);
            console.log(`📚 Yearbook ${yb.title} (${yb.year}) has ${yearbookPages.length} pages`);
            
            for (const p of yearbookPages) {
              console.log(`🔍 Checking page ${p.pageType}: ${p.imageUrl}`);
              if (p.imageUrl && p.imageUrl.includes(filename)) {
                console.log(`✅ MATCH FOUND for viewer!`);
                page = p;
                yearbook = yb;
                break outerLoop;
              }
            }
          }
        }
      }
      
      if (!page) {
        console.log(`❌ Page not found for filename: ${filename}`);
        console.log(`📋 Debug info: user.userType=${user.userType}, user.schoolId=${user.schoolId}`);
        return res.status(404).json({ message: "Image not found" });
      }
      
      if (!yearbook) {
        console.log(`❌ Yearbook not found`);
        return res.status(404).json({ message: "Yearbook not found" });
      }

      // We already have the user from line 2427, no need to fetch again
      console.log(`📋 Authorization check for ${filename}:`);
      console.log(`   User: ${user.email} (${user.userType})`);
      console.log(`   User schoolId: ${user.schoolId}`);
      console.log(`   Yearbook schoolId: ${yearbook.schoolId}`);
      console.log(`   Yearbook: ${yearbook.title} (${yearbook.year})`);

      // Front covers are publicly accessible to all users (no authentication needed)
      if (page.pageType === "front_cover") {
        console.log(`📖 Front cover is public - granting access to ${user.email}`);
        return await serveSecureFile(res, `public/uploads/yearbooks/${filename}`);
      }

      // Super admins can access all media as moderators
      if (user.userType === "super_admin") {
        console.log(`✅ Super admin access granted for ${user.email}`);
        return await serveSecureFile(res, `public/uploads/yearbooks/${filename}`);
      }

      // School admins can always access their own content
      if (user.userType === "school" && user.schoolId === yearbook.schoolId) {
        console.log(`✅ School admin access granted for ${user.email}`);
        return await serveSecureFile(res, `public/uploads/yearbooks/${filename}`);
      }

      // Check if viewer has purchased this year
      if (user.userType === "viewer") {
        const purchases = await storage.getAllViewerYearPurchases(userId);
        const hasPurchased = purchases.some(p => 
          p.schoolId === yearbook.schoolId && 
          p.year === yearbook.year && 
          p.purchased
        );
        
        console.log(`📊 Viewer purchase check for ${user.email}:`);
        console.log(`   Has purchased: ${hasPurchased}`);
        console.log(`   Purchases: ${JSON.stringify(purchases.map(p => ({ schoolId: p.schoolId, year: p.year, purchased: p.purchased })))}`);
        
        if (!hasPurchased) {
          console.log(`❌ Viewer access denied - no purchase found`);
          return res.status(403).json({ 
            message: "You must purchase this yearbook to access its pages" 
          });
        }
        
        console.log(`✅ Viewer access granted for ${user.email}`);
        return await serveSecureFile(res, `public/uploads/yearbooks/${filename}`);
      }

      console.log(`❌ Access denied for user type: ${user.userType}`);
      return res.status(403).json({ message: "Access denied" });
    } catch (error) {
      console.error('Error serving secure yearbook image:', error);
      return res.status(500).json({ message: "Failed to serve image" });
    }
  });

  // Helper function to serve files securely
  async function serveSecureFile(res: any, filePath: string) {
    const fsSync = await import('fs');
    
    const fullPath = path.resolve(filePath);
    console.log(`📁 Serving secure file: ${fullPath}`);
    
    // Verify file exists and is within uploads directory (security check)
    if (!fsSync.existsSync(fullPath) || !fullPath.includes('uploads')) {
      console.log(`❌ File not found or not in uploads: ${fullPath}`);
      return res.status(404).json({ message: "File not found" });
    }
    
    // Set appropriate headers
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', 
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo'
    };
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
    
    console.log(`✅ Serving file with mime type: ${mimeType}`);
    
    // Stream the file
    const stream = fsSync.createReadStream(fullPath);
    stream.pipe(res);
    
    stream.on('error', (error) => {
      console.error('❌ File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to read file" });
      }
    });
  }

  // Payment & Sales History endpoints
  app.get("/api/schools/:schoolId/payment-history", async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Verify school access
      if (user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      // Get school's year purchases (what they paid for)
      const purchases = await storage.getYearPurchasesBySchool(schoolId);
      
      // Filter only purchased years (excluding admin-unlocked) and format for display
      const paymentHistory = purchases
        .filter(p => p.purchased && !p.unlockedByAdmin)
        .map(p => ({
          id: p.id,
          year: p.year,
          amount: parseFloat(p.price || "0"),
          currency: "USD", // Base currency
          date: p.purchaseDate,
          type: "purchase",
          description: `Year ${p.year} Access`,
          reference: p.paymentReference
        }))
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      res.json(paymentHistory);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  app.get("/api/schools/:schoolId/sales-history", async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      // Authentication check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = authHeader.substring(7);
      const user = await storage.getUser(userId);
      
      if (!user || (user.userType !== 'school' && user.userType !== 'super_admin')) {
        return res.status(403).json({ message: "School admin privileges required" });
      }

      // Verify school access
      if (user.userType === 'school') {
        const school = await storage.getSchoolByAdminUserId(userId);
        if (!school || school.id !== schoolId) {
          return res.status(403).json({ message: "Access denied for this school" });
        }
      }

      // Get payment records where this school received revenue
      const allPayments = await storage.getPaymentRecordsBySchool(schoolId);
      
      // Format sales for display
      const salesHistory = allPayments
        .filter(p => p.status === 'success' && p.schoolAmount)
        .map(p => ({
          id: p.id,
          amount: (p.schoolAmount || 0) / 100, // Convert from kobo to naira
          platformAmount: (p.platformAmount || 0) / 100,
          totalAmount: (p.amount || 0) / 100,
          currency: "NGN", // Paystack payments are in Nigerian Naira
          date: p.createdAt,
          type: "sale",
          description: "Yearbook Access Sale",
          reference: p.reference,
          buyerEmail: p.email,
          splitStatus: p.splitStatus
        }))
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      res.json(salesHistory);
    } catch (error) {
      console.error("Error fetching sales history:", error);
      res.status(500).json({ message: "Failed to fetch sales history" });
    }
  });

  // Test email endpoint
  app.post("/api/test-email", async (req, res) => {
    try {
      const { to } = req.body;
      
      if (!to) {
        return res.status(400).json({ message: "Email recipient (to) is required" });
      }

      const htmlContent = createTestEmail();

      const result = await sendEmail(
        to,
        "Yearbuk Email System Test",
        htmlContent
      );

      if (result.success) {
        res.json({ 
          success: true, 
          message: "Test email sent successfully",
          recipient: to
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to send test email",
          error: result.error
        });
      }
    } catch (error) {
      console.error("Test email endpoint error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
