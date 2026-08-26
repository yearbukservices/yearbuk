import { sql } from "drizzle-orm";
import { users, schools } from "@shared/schema";
import { eq } from "drizzle-orm";
import { testDatabaseConnection } from "./database-connection";
import { initializeDatabaseFallback } from "./render-fallback";
import { hashPassword } from "./password-utils";

/**
 * Create test accounts if they don't exist and environment allows
 */
async function createTestAccountsIfNeeded(db: any) {
  try {
    // Check if test accounts already exist
    const existingTestSchool = await db.select().from(users).where(eq(users.username, "test_school")).limit(1);
    const existingTestViewer = await db.select().from(users).where(eq(users.username, "test_viewer")).limit(1);
    
    if (existingTestSchool.length > 0 && existingTestViewer.length > 0) {
      console.log("✅ Test accounts already exist, skipping creation");
      return;
    }

    console.log("📝 Creating test accounts...");

    // Create test school first if it doesn't exist
    if (existingTestSchool.length === 0) {
      const testSchoolResult = await db.insert(schools).values({
        username: "test_school",
        name: "Albesta Academy",
        address: "123 Education Street",
        country: "United States",
        state: "California",
        city: "Test City",
        email: "contact@testschool.edu",
        phoneNumber: "+15551234567",
        website: "https://testschool.edu",
        yearFounded: 1985,
        registrationNumber: "REG-12345-TEST",
        approvalStatus: "approved",
        activationCode: "TEST-ACT-123",
        isEmailVerified: true, // Test school is pre-verified
      }).returning();

      const testSchoolId = testSchoolResult[0].id;

      // Create test school user with hashed password
      const plainPassword = process.env.TEST_SCHOOL_PASSWORD || "12345";
      const hashedPassword = await hashPassword(plainPassword);
      
      await db.insert(users).values({
        username: process.env.TEST_SCHOOL_USERNAME || "test_school",
        password: hashedPassword,
        userType: "school",
        firstName: "Test",
        lastName: "Administrator",
        fullName: "Test Administrator",
        dateOfBirth: "1980-01-01",
        email: "admin@testschool.edu",
        phoneNumber: "(1)5551234567",
        schoolId: testSchoolId,
        isEmailVerified: true, // Test accounts are pre-verified
      });
    }

    // Create test viewer user if it doesn't exist
    if (existingTestViewer.length === 0) {
      const plainPassword = process.env.TEST_VIEWER_PASSWORD || "12345";
      const hashedPassword = await hashPassword(plainPassword);
      
      await db.insert(users).values({
        username: process.env.TEST_VIEWER_USERNAME || "test_viewer",
        password: hashedPassword,
        userType: "viewer",
        firstName: "Test",
        lastName: "Viewer",
        fullName: "Test Viewer",
        dateOfBirth: "1995-01-01",
        email: "viewer@testuser.com",
        phoneNumber: "+15559876543",
        isEmailVerified: true, // Test accounts are pre-verified
      });
    }

    console.log("✅ Test accounts created:");
    console.log("   - School: test_school (password: [SECURED])");
    console.log("   - Viewer: test_viewer (password: [SECURED])");
  } catch (error) {
    console.error("❌ Failed to create test accounts:", error);
  }
}

/**
 * Initialize database tables and default data for production deployment
 * This ensures tables exist and creates a default super-admin account
 */
export async function initializeDatabase() {
  try {
    console.log("🔄 Initializing database...");
    
    // Try the standard Neon HTTP approach first
    try {
      const db = await testDatabaseConnection();
      
      // Repair older databases that predate the logged-in memory uploader column.
      // This is idempotent and preserves all existing memory records.
      await db.execute(sql`
        ALTER TABLE IF EXISTS "memories"
        ADD COLUMN IF NOT EXISTS "user_id" varchar REFERENCES "users"("id")
      `);
      console.log("✅ Verified memories.user_id column");

      // Check if users table exists and has data
      const existingUsers = await db.select().from(users).limit(1);
      
      // If no users exist, create default super-admin
      if (existingUsers.length === 0) {
        console.log("📝 Creating default super-admin account...");
        
        const plainPassword = process.env.SUPER_ADMIN_PASSWORD;
        if (!plainPassword) {
          throw new Error('SUPER_ADMIN_PASSWORD environment variable is required for security. Please set it in your environment.');
        }
        const hashedPassword = await hashPassword(plainPassword);
        
        await db.insert(users).values({
          username: "admin",
          password: hashedPassword,
          userType: "super_admin",
          role: "super_admin",
          firstName: "Super",
          lastName: "Admin",
          fullName: "Super Admin", // Required field
          dateOfBirth: "1990-01-01",
          email: "netonwabuisi83@gmail.com",
        });
        
        console.log("✅ Default super-admin created:");
        console.log("   Username: admin");
        console.log("   Password: [SECURED - bcrypt hashed]");
        console.log("   ✅ Using secure password from environment variables");
      } else {
        console.log("✅ Users table already has data, skipping super-admin creation");
      }

      // The seeded admin account is the moderator account. Repair older
      // databases where it may have been created with the default user role.
      const seededAdmin = await db
        .select()
        .from(users)
        .where(eq(users.username, "admin"))
        .limit(1);

      if (
        seededAdmin.length > 0 &&
        (seededAdmin[0].userType !== "super_admin" ||
          seededAdmin[0].role !== "super_admin")
      ) {
        await db
          .update(users)
          .set({ userType: "super_admin", role: "super_admin" })
          .where(eq(users.username, "admin"));
        console.log("✅ Repaired admin account with super-admin moderator access");
      }

      // Create test accounts if environment variables are set
      if (process.env.NODE_ENV === "development" || process.env.CREATE_TEST_ACCOUNTS === "true") {
        await createTestAccountsIfNeeded(db);
      }
      
      console.log("✅ Database initialization complete");
      return;
      
    } catch (neonError) {
      console.warn("⚠️  Standard Neon connection failed, trying fallback approach...");
      console.warn("Neon error:", neonError instanceof Error ? neonError.message : neonError);
      
      // Try the fallback approach using basic PostgreSQL
      const fallbackSuccess = await initializeDatabaseFallback();
      
      if (fallbackSuccess) {
        console.log("✅ Database initialization completed using fallback method");
        return;
      } else {
        throw new Error("Both standard and fallback database initialization methods failed");
      }
    }
    
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    
    // If tables don't exist, they should be created via drizzle push
    if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log("💡 Tables don't exist. Run 'npm run db:push' to create them");
      console.log("💡 For Render deployment, ensure your build command includes 'npm run db:push'");
    }
    
    throw error;
  }
}

/**
 * Check if super-admin exists and create one if needed
 */
export async function ensureSuperAdminExists() {
  try {
    // Test database connection
    const db = await testDatabaseConnection();
    
    const superAdmin = await db.select().from(users).where(eq(users.userType, "super_admin")).limit(1);
    
    if (superAdmin.length === 0) {
      console.log("📝 No super-admin found, creating default account...");
      
      const plainPassword = process.env.SUPER_ADMIN_PASSWORD;
      if (!plainPassword) {
        throw new Error('SUPER_ADMIN_PASSWORD environment variable is required for security. Please set it in your environment.');
      }
      const hashedPassword = await hashPassword(plainPassword);
      
      await db.insert(users).values({
        username: "admin",
        password: hashedPassword,
        userType: "super_admin", 
        role: "super_admin",
        firstName: "Super",
        lastName: "Admin",
        fullName: "Super Admin", // Required field
        dateOfBirth: "1990-01-01",
        email: "netonwabuisi83@gmail.com",
      });
      
      console.log("✅ Default super-admin created (username: admin, password: [SECURED - bcrypt hashed])");
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("❌ Failed to check/create super-admin:", error);
    return false;
  }
}