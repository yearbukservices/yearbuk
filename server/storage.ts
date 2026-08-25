import { 
  type User, 
  type InsertUser, 
  type School, 
  type InsertSchool,
  type Memory,
  type InsertMemory,
  type PhotoTag,
  type InsertPhotoTag,
  type AlumniRequest,
  type InsertAlumniRequest,
  type Notification,
  type InsertNotification,
  type YearPurchase,
  type InsertYearPurchase,
  type ViewerYearPurchase,
  type InsertViewerYearPurchase,
  type CartItem,
  type InsertCartItem,
  type AlumniRequestBlock,
  type InsertAlumniRequestBlock,
  type Yearbook,
  type InsertYearbook,
  type YearbookPage,
  type InsertYearbookPage,
  type YearbookPriceHistory,
  type InsertYearbookPriceHistory,
  type TableOfContentsItem,
  type InsertTableOfContents,
  type AdminLog,
  type InsertAdminLog,
  type PaymentRecord,
  type InsertPaymentRecord,
  type YearbookCode,
  type InsertYearbookCode,
  type PublicUploadLink,
  type InsertPublicUploadLink,
  type SchoolGalleryImage,
  type InsertSchoolGalleryImage,
  type LoginActivity,
  type InsertLoginActivity,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  users,
  schools,
  memories,
  alumniRequests,
  notifications,
  yearPurchases,
  viewerYearPurchases,
  cartItems,
  alumniRequestBlocks,
  yearbooks,
  yearbookPages,
  yearbookPriceHistory,
  tableOfContents,
  alumniBadges,
  adminLogs,
  paymentRecords,
  yearbookCodes,
  publicUploadLinks,
  schoolGalleryImages,
  loginActivity,
  passwordResetTokens,
  photoTags
} from "../shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, or, sql, isNotNull, desc, inArray, ilike } from "drizzle-orm";
import { hashPassword, comparePassword, hashUploadCode, verifyUploadCode } from "./password-utils";

// Database connection - using PostgreSQL with connection pooling
const connectionString = process.env.DATABASE_URL!;

// Use Pool instead of Client for automatic reconnection and connection management
const pool = new pg.Pool({
  connectionString,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout for acquiring a connection
  allowExitOnIdle: false, // Keep pool alive even when idle
});

// Add error handler to prevent crashes when Neon closes idle connections
pool.on('error', (err) => {
  console.error('⚠️  Database pool error (handled):', err.message);
  // Pool will automatically remove bad connections and create new ones
});

// Log successful connections
pool.on('connect', () => {
  console.log('✅ New database connection established in pool');
});

const db = drizzle(pool);

// Import AlumniBadge from schema.ts instead of defining it here
type AlumniBadge = typeof alumniBadges.$inferSelect;
export type InsertAlumniBadge = Omit<AlumniBadge, "id" | "createdAt">;





export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserWithPassword(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getSuperAdmins(): Promise<User[]>;
  validateUser(username: string, password: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // School operations
  getSchools(): Promise<School[]>;
  getApprovedSchools(): Promise<School[]>;
  getSchool(id: string): Promise<School | undefined>;
  getSchoolByUsername(username: string): Promise<School | undefined>;
  getSchoolByActivationCode(activationCode: string): Promise<School | undefined>;
  getSchoolByAdminUserId(userId: string): Promise<School | undefined>;
  getSchoolByVerificationToken(token: string): Promise<School | undefined>;
  getSchoolAdminUser(schoolId: string): Promise<User | undefined>;
  searchSchools(query: string): Promise<School[]>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(schoolId: string, updates: Partial<School>): Promise<School | undefined>;
  updateSchoolProfile(schoolId: string, updates: Partial<Pick<School, 'address' | 'state' | 'email' | 'city'>>): Promise<School | undefined>;
  updateSchoolLogo(schoolId: string, logoPath: string, cloudinaryPublicId?: string | null): Promise<School | undefined>;
  updateSchoolBanner(schoolId: string, bannerPath: string, cloudinaryPublicId?: string | null): Promise<School | undefined>;
  getPendingSchools(): Promise<School[]>;
  approveSchool(schoolId: string, approvedBy: string, activationCode: string): Promise<School | undefined>;
  rejectSchool(schoolId: string, rejectedBy: string, reason: string): Promise<School | undefined>;
  getSchoolById(schoolId: string): Promise<School | undefined>;
  updateSchoolSubaccount(schoolId: string, subaccountCode: string, bankAccountNumber: string, bankCode: string, status: string): Promise<School | undefined>;

  // Memory operations
  getMemoriesBySchoolAndYear(schoolId: string, year: number): Promise<Memory[]>;
  getMemoriesBySchool(schoolId: string): Promise<Memory[]>;
  getMemoriesByUser(userId: string): Promise<Memory[]>;
  createMemory(memory: InsertMemory): Promise<Memory>;
  getPendingMemoriesBySchool(schoolId: string): Promise<Memory[]>;
  getMemoryById(memoryId: string): Promise<Memory | undefined>;
  approveMemory(memoryId: string, approvedBy: string): Promise<Memory | undefined>;
  deleteMemory(memoryId: string): Promise<boolean>;

  // Photo tag operations
  createPhotoTags(memoryId: string, taggedUserIds: string[]): Promise<PhotoTag[]>;
  getPhotoTagsByMemory(memoryId: string): Promise<PhotoTag[]>;
  getTaggedMemoriesByUser(userId: string): Promise<Memory[]>;
  deletePhotoTagsByMemory(memoryId: string): Promise<boolean>;
  searchUsersByName(query: string): Promise<User[]>;
  
  // Year purchase operations
  getYearPurchasesBySchool(schoolId: string): Promise<YearPurchase[]>;
  createYearPurchase(purchase: InsertYearPurchase): Promise<YearPurchase>;
  updateYearPurchase(purchaseId: string, purchased: boolean, unlockedByAdmin?: boolean): Promise<YearPurchase | undefined>;
  
  // Viewer year purchase operations
  getViewerYearPurchases(userId: string, schoolId: string): Promise<ViewerYearPurchase[]>;
  getAllViewerYearPurchases(userId: string): Promise<ViewerYearPurchase[]>;
  createViewerYearPurchase(purchase: InsertViewerYearPurchase): Promise<ViewerYearPurchase>;
  updateViewerYearPurchase(purchaseId: string, purchased: boolean): Promise<ViewerYearPurchase | undefined>;

  // Cart operations
  getCartItems(userId: string): Promise<CartItem[]>;
  addCartItem(cartItem: InsertCartItem): Promise<CartItem>;
  removeCartItem(cartItemId: string): Promise<boolean>;
  clearCart(userId: string): Promise<boolean>;
  deleteCartItemsBySchoolAndYear(schoolId: string, year: number): Promise<number>;
  getCartItem(userId: string, schoolId: string, year: number): Promise<CartItem | undefined>;
  
  // Alumni request blocking
  createAlumniRequestBlock(block: InsertAlumniRequestBlock): Promise<AlumniRequestBlock>;
  getAlumniRequestBlocks(userId: string, schoolId: string): Promise<AlumniRequestBlock[]>;
  
  // Alumni request rate limiting
  getAlumniRequestsInLastWeek(userId: string): Promise<AlumniRequest[]>;
  hasExistingAlumniRequest(userId: string, schoolId: string): Promise<boolean>;


  









  // Alumni badge operations
  getAlumniBadgesByUser(userId: string): Promise<AlumniBadge[]>;
  getAlumniBadgesBySchool(schoolId: string): Promise<AlumniBadge[]>;
  createAlumniBadge(badge: InsertAlumniBadge): Promise<AlumniBadge>;
  updateAlumniBadgeStatus(badgeId: string, status: "verified" | "pending"): Promise<AlumniBadge | undefined>;
  deleteAlumniBadge(badgeId: string): Promise<boolean>;
  
  // Alumni Requests
  getAlumniRequestsBySchool(schoolId: string): Promise<AlumniRequest[]>;
  getAlumniRequestById(requestId: string): Promise<AlumniRequest | undefined>;
  getAlumniRequest(requestId: string): Promise<AlumniRequest | undefined>;
  createAlumniRequest(request: InsertAlumniRequest): Promise<AlumniRequest>;
  updateAlumniRequestStatus(requestId: string, status: string, reviewedBy: string, reviewNotes?: string): Promise<AlumniRequest | undefined>;
  updateAlumniRequest(id: string, updates: Partial<AlumniRequest>): Promise<AlumniRequest | undefined>;
  
  // Notifications
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  getAllNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(notificationId: string): Promise<boolean>;
  deleteNotification(notificationId: string): Promise<boolean>;
  clearAllNotifications(userId: string): Promise<number>;
  deleteOldNotifications(daysOld: number): Promise<number>;
  
  // Yearbook operations
  getYearbook(schoolId: string, year: number): Promise<Yearbook | undefined>;
  getYearbookById(id: string): Promise<Yearbook | undefined>;
  getYearbookBySchoolAndYear(schoolId: string, year: number): Promise<Yearbook | undefined>;
  getPublishedYearbook(schoolId: string, year: number): Promise<Yearbook | undefined>;
  createYearbook(yearbook: InsertYearbook): Promise<Yearbook>;
  updateYearbook(yearbookId: string, updates: Partial<Yearbook>): Promise<Yearbook | undefined>;
  updateYearbookPublishStatus(yearbookId: string, isPublished: boolean): Promise<Yearbook | undefined>;
  updateYearbookPrice(yearbookId: string, newPrice: string, changedBy: string): Promise<{ success: boolean; message: string; yearbook?: Yearbook }>;
  getYearbookPriceHistory(yearbookId: string): Promise<YearbookPriceHistory[]>;
  canChangeYearbookPrice(yearbookId: string): Promise<{ canChange: boolean; message?: string; changesRemaining?: number }>;
  updateYearbookCovers(yearbookId: string, frontCoverUrl: string | null, backCoverUrl: string | null): Promise<Yearbook | undefined>;
  
  // Draft management operations
  publishDrafts(yearbookId: string): Promise<{ success: boolean; message: string }>;
  discardDrafts(yearbookId: string): Promise<{ success: boolean; message: string }>;
  updateDraftTimestamp(yearbookId: string, isAutoSave: boolean): Promise<Yearbook | undefined>;
  setDraftCovers(yearbookId: string, frontCoverUrl: string | null, backCoverUrl: string | null): Promise<Yearbook | undefined>;
  
  // Yearbook page operations
  createYearbookPage(page: InsertYearbookPage): Promise<YearbookPage>;
  getYearbookPageById(pageId: string): Promise<YearbookPage | undefined>;
  getPagesByBatchId(batchId: string): Promise<YearbookPage[]>;
  deleteYearbookPage(pageId: string): Promise<boolean>;
  updateYearbookPageOrder(pageId: string, newPageNumber: number): Promise<YearbookPage | undefined>;
  getNextPageNumber(yearbookId: string): Promise<number>;
  
  // Table of contents operations
  createTableOfContentsItem(item: InsertTableOfContents): Promise<TableOfContentsItem>;
  updateTableOfContentsItem(tocId: string, updates: Partial<TableOfContentsItem>): Promise<TableOfContentsItem | undefined>;
  deleteTableOfContentsItem(tocId: string): Promise<boolean>;
  
  // Yearbook page operations  
  getYearbookPages(yearbookId: string): Promise<YearbookPage[]>;
  
  // Super Admin operations
  getAllUsers(): Promise<User[]>;
  getAllSchools(): Promise<School[]>;
  getAllAlumniBadges(): Promise<AlumniBadge[]>;
  getAllAlumniRequests(): Promise<AlumniRequest[]>;
  getUserById(id: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  deleteSchool(id: string): Promise<boolean>;
  updateUserRole(id: string, userType: string): Promise<User | undefined>;
  updateUserPrivacySettings(userId: string, updateData: { showPhoneToAlumni?: boolean; phoneNumber?: string }): Promise<User | undefined>;
  updateUserProfile(userId: string, updateData: { email?: string; username?: string; fullName?: string; password?: string; preferredCurrency?: string; profileImage?: string }): Promise<User | undefined>;
  logAdminAction(adminUserId: string, action: string, targetType: string, targetId: string, details?: Record<string, any>): Promise<void>;
  getAdminLogs(): Promise<AdminLog[]>;

  // Payment operations
  createPaymentRecord(payment: InsertPaymentRecord): Promise<PaymentRecord>;
  getPaymentByReference(reference: string): Promise<PaymentRecord | undefined>;
  updatePaymentStatus(reference: string, status: string): Promise<PaymentRecord | undefined>;
  getPaymentRecordsBySchool(schoolId: string): Promise<PaymentRecord[]>;
  clearUserCart(userId: string): Promise<boolean>;

  // Yearbook code operations
  createYearbookCodes(schoolId: string, year: number, count: number): Promise<YearbookCode[]>;
  redeemYearbookCode(code: string, userId: string): Promise<{ success: boolean; message: string; year?: number }>;
  getYearbookCodesBySchool(schoolId: string): Promise<YearbookCode[]>;
  checkUserYearbookAccess(userId: string, schoolId: string, year: number): Promise<boolean>;
  deleteYearbookCode(codeId: string): Promise<void>;
  deleteAllYearbookCodes(schoolId: string, year: number): Promise<void>;
  getViewerPaymentHistory(userId: string): Promise<Array<ViewerYearPurchase & { schoolName: string }>>;
  
  // Public upload link operations
  createPublicUploadLink(linkData: { schoolId: string; year: number; category: string; expiresAt: Date; createdBy: string }): Promise<{ linkCode: string; id: string }>;
  getPublicUploadLinkByCode(linkCode: string): Promise<{ id: string; schoolId: string; year: number; category: string; expiresAt: Date; isActive: boolean; currentUploads: number; maxUploads: number } | undefined>;
  getPublicUploadLinksBySchoolAndYear(schoolId: string, year: number): Promise<PublicUploadLink[]>;
  getPublicUploadLinkById(linkId: string): Promise<PublicUploadLink | undefined>;
  updatePublicUploadLinkStatus(linkId: string, isActive: boolean): Promise<PublicUploadLink | undefined>;
  deletePublicUploadLink(linkId: string): Promise<boolean>;
  incrementUploadCount(linkId: string): Promise<boolean>;
  updateMemoryStatus(memoryId: string, status: 'pending' | 'approved' | 'rejected'): Promise<Memory | undefined>;

  // School gallery image operations
  getSchoolGalleryImages(schoolId: string): Promise<SchoolGalleryImage[]>;
  addSchoolGalleryImage(image: InsertSchoolGalleryImage): Promise<SchoolGalleryImage>;
  updateSchoolGalleryImage(imageId: string, schoolId: string, updates: Partial<Pick<InsertSchoolGalleryImage, 'title' | 'description' | 'displayOrder' | 'isActive'>>): Promise<SchoolGalleryImage | undefined>;
  deleteSchoolGalleryImage(imageId: string, schoolId: string): Promise<boolean>;
  reorderSchoolGalleryImages(schoolId: string, imageOrders: { id: string; displayOrder: number }[]): Promise<boolean>;

  // Login activity operations
  createLoginActivity(activity: InsertLoginActivity): Promise<LoginActivity>;
  getLoginActivitiesByUser(userId: string, limit?: number): Promise<LoginActivity[]>;
  getMostRecentLogin(userId: string): Promise<LoginActivity | undefined>;

  // Password reset operations
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(tokenId: string): Promise<boolean>;
  deleteExpiredPasswordResetTokens(): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private schools: Map<string, School>;
  private memories: Map<string, Memory>;
  private alumniBadges: Map<string, AlumniBadge>;
  private alumniRequests: Map<string, AlumniRequest>;
  private notifications: Map<string, Notification>;
  private yearPurchases: Map<string, YearPurchase>;
  private viewerYearPurchases: Map<string, ViewerYearPurchase>;
  private cartItems: Map<string, CartItem>;
  private alumniRequestBlocks: Map<string, AlumniRequestBlock>;
  private yearbooks: Map<string, Yearbook>;
  private yearbookPages: Map<string, YearbookPage>;
  private tableOfContents: Map<string, TableOfContentsItem>;
  private yearbookCodes: Map<string, YearbookCode>;
  private publicUploadLinks: Map<string, PublicUploadLink>;

  constructor() {
    this.users = new Map();
    this.schools = new Map();
    this.memories = new Map();
    this.alumniBadges = new Map();
    this.alumniRequests = new Map();
    this.notifications = new Map();
    this.yearPurchases = new Map();
    this.viewerYearPurchases = new Map();
    this.cartItems = new Map();
    this.alumniRequestBlocks = new Map();
    this.yearbooks = new Map();
    this.yearbookPages = new Map();
    this.tableOfContents = new Map();
    this.yearbookCodes = new Map();
    this.publicUploadLinks = new Map();
    
    // Initialize with seed data
    this.initializeSeedData();
  }

  private async initializeSeedData() {
    // Database initialized - no seed data
    console.log("Database initialized successfully");
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserWithPassword(id: string): Promise<User | undefined> {
    // Same as getUser for memory storage since it already includes password
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email && user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  // Helper function to normalize phone numbers for comparison
  private normalizePhoneNumber(phone: string): string {
    if (!phone) return "";
    
    // Remove all non-digit characters except + at the start
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
    
    // Remove leading + if present
    if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }
    
    // Convert to standard international format without +
    // Handle Nigerian numbers: if starts with 0, replace with 234
    if (cleaned.startsWith("0") && cleaned.length >= 10) {
      cleaned = "234" + cleaned.substring(1);
    }
    // If it doesn't start with 234 but looks like a Nigerian number, add 234
    else if (/^[789]/.test(cleaned) && cleaned.length >= 9 && cleaned.length <= 10) {
      cleaned = "234" + cleaned;
    }
    
    return cleaned;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    
    return Array.from(this.users.values()).find(
      (user) => {
        if (!user.phoneNumber) return false;
        const userNormalizedPhone = this.normalizePhoneNumber(user.phoneNumber);
        return userNormalizedPhone === normalizedPhone;
      }
    );
  }

  async validateUser(username: string, password: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(
      (user) => user.username === username && user.password === password,
    );
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    // Compute fullName from firstName, middleName, lastName
    const fullName = [insertUser.firstName, insertUser.middleName, insertUser.lastName]
      .filter(Boolean)
      .join(' ');
    
    const user: User = { 
      ...insertUser, 
      fullName,
      id, 
      createdAt: new Date(),
      email: insertUser.email ?? null,
      profileImage: insertUser.profileImage ?? null,
      schoolId: insertUser.schoolId ?? null,
      middleName: insertUser.middleName ?? null,
      phoneNumber: insertUser.phoneNumber ?? null
    };
    this.users.set(id, user);
    return user;
  }

  async getSchools(): Promise<School[]> {
    return Array.from(this.schools.values());
  }

  async getApprovedSchools(): Promise<School[]> {
    return Array.from(this.schools.values()).filter(
      (school) => school.approvalStatus === 'approved'
    );
  }

  async getSchool(id: string): Promise<School | undefined> {
    return this.schools.get(id);
  }

  async getSchoolByUsername(username: string): Promise<School | undefined> {
    return Array.from(this.schools.values()).find(school => school.username === username);
  }

  async searchSchools(query: string): Promise<School[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.schools.values())
      .filter(school => 
        school.approvalStatus === 'approved' &&
        (school.name.toLowerCase().includes(lowerQuery) || 
         school.username.toLowerCase().includes(lowerQuery))
      )
      .slice(0, 20);
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const id = randomUUID();
    const school: School = { 
      ...insertSchool, 
      id, 
      createdAt: new Date(),
      address: insertSchool.address ?? null,
      state: insertSchool.state ?? null
    };
    this.schools.set(id, school);
    return school;
  }

  async getSchoolByAdminUserId(userId: string): Promise<School | undefined> {
    // Find the user first
    const user = this.users.get(userId);
    
    if (!user || user.userType !== 'school') {
      return undefined;
    }
    
    // If user has schoolId, use that
    if (user.schoolId) {
      return this.schools.get(user.schoolId);
    }
    
    // If no schoolId, try to match by username pattern
    const username = user.username.toLowerCase();
    
    // Look for a school that matches the admin username pattern
    const schools = Array.from(this.schools.values());
    for (const school of schools) {
      const schoolName = school.name.toLowerCase();
      
      // Check if username contains part of the school name or admin pattern
      if (username.includes('frfr') && schoolName.includes('frfr')) {
        return school;
      }
      if (username.includes('admin') && schoolName.includes('test')) {
        return school;
      }
      if (username.includes('albesta') && schoolName.includes('albesta')) {
        return school;
      }
    }
    
    // Fallback to first school
    return Array.from(this.schools.values())[0];
  }

  async getSchoolByActivationCode(activationCode: string): Promise<School | undefined> {
    return Array.from(this.schools.values()).find(
      (school) => school.activationCode === activationCode,
    );
  }

  async getSchoolAdminUser(schoolId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.schoolId === schoolId && (user.userType === 'school' || user.userType === 'school_admin')
    );
  }

  async getPendingSchools(): Promise<School[]> {
    return Array.from(this.schools.values()).filter(
      (school) => school.approvalStatus === 'pending'
    );
  }

  async approveSchool(schoolId: string, approvedBy: string, activationCode: string): Promise<School | undefined> {
    const school = this.schools.get(schoolId);
    if (!school) {
      return undefined;
    }
    
    const updatedSchool = {
      ...school,
      approvalStatus: 'approved' as const,
      activationCode,
      approvedBy,
      approvedAt: new Date()
    };
    
    this.schools.set(schoolId, updatedSchool);
    return updatedSchool;
  }

  async rejectSchool(schoolId: string, rejectedBy: string, reason: string): Promise<School | undefined> {
    const school = this.schools.get(schoolId);
    if (!school) {
      return undefined;
    }
    
    const updatedSchool = {
      ...school,
      approvalStatus: 'rejected' as const,
      approvedBy: rejectedBy,
      approvedAt: new Date(),
      rejectionReason: reason
    };
    
    this.schools.set(schoolId, updatedSchool);
    return updatedSchool;
  }

  async updateSchoolProfile(schoolId: string, updates: Partial<Pick<School, 'address' | 'state' | 'email' | 'city'>>): Promise<School | undefined> {
    const school = this.schools.get(schoolId);
    if (!school) {
      return undefined;
    }
    
    const updatedSchool: School = {
      ...school,
      ...updates
    };
    
    this.schools.set(schoolId, updatedSchool);
    return updatedSchool;
  }

  async updateSchoolLogo(schoolId: string, logoPath: string, cloudinaryPublicId?: string | null): Promise<School | undefined> {
    const school = this.schools.get(schoolId);
    if (!school) {
      return undefined;
    }
    
    const updatedSchool: School = {
      ...school,
      logo: logoPath,
      logoCloudinaryId: cloudinaryPublicId || null
    };
    
    this.schools.set(schoolId, updatedSchool);
    return updatedSchool;
  }

  async updateSchoolBanner(schoolId: string, bannerPath: string, cloudinaryPublicId?: string | null): Promise<School | undefined> {
    const school = this.schools.get(schoolId);
    if (!school) {
      return undefined;
    }
    
    const updatedSchool: School = {
      ...school,
      coverPhoto: bannerPath,
      coverPhotoCloudinaryId: cloudinaryPublicId || null
    };
    
    this.schools.set(schoolId, updatedSchool);
    return updatedSchool;
  }

  async getMemoriesBySchoolAndYear(schoolId: string, year: number): Promise<Memory[]> {
    return Array.from(this.memories.values()).filter(
      (memory) => memory.schoolId === schoolId && memory.year === year,
    );
  }

  async getMemoriesBySchool(schoolId: string): Promise<Memory[]> {
    return Array.from(this.memories.values()).filter(
      (memory) => memory.schoolId === schoolId,
    );
  }

  async getMemoriesByUser(userId: string): Promise<Memory[]> {
    return Array.from(this.memories.values()).filter(
      (memory) => memory.userId === userId,
    );
  }

  async createMemory(insertMemory: InsertMemory): Promise<Memory> {
    const id = randomUUID();
    const memory: Memory = { 
      ...insertMemory, 
      id, 
      tags: insertMemory.tags ?? [],
      description: insertMemory.description ?? null,
      category: insertMemory.category ?? null,
      imageUrl: insertMemory.imageUrl ?? null,
      videoUrl: insertMemory.videoUrl ?? null,
      status: insertMemory.status ?? "pending",
      uploadedBy: insertMemory.uploadedBy ?? null,
      userId: insertMemory.userId ?? null,
      publicUploadLinkId: insertMemory.publicUploadLinkId ?? null,
      createdAt: new Date()
    };
    this.memories.set(id, memory);
    return memory;
  }

  async getPendingMemoriesBySchool(schoolId: string): Promise<Memory[]> {
    return Array.from(this.memories.values()).filter(
      (memory) => memory.schoolId === schoolId && memory.status === "pending",
    );
  }

  async getMemoryById(memoryId: string): Promise<Memory | undefined> {
    return this.memories.get(memoryId);
  }

  async approveMemory(memoryId: string, approvedBy: string): Promise<Memory | undefined> {
    const memory = this.memories.get(memoryId);
    if (memory) {
      const updatedMemory = {
        ...memory,
        status: "approved" as const,
        approvedBy,
        approvedAt: new Date()
      };
      this.memories.set(memoryId, updatedMemory);
      return updatedMemory;
    }
    return undefined;
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    return this.memories.delete(memoryId);
  }

  async createPhotoTags(_memoryId: string, _taggedUserIds: string[]): Promise<PhotoTag[]> { return []; }
  async getPhotoTagsByMemory(_memoryId: string): Promise<PhotoTag[]> { return []; }
  async getTaggedMemoriesByUser(_userId: string): Promise<Memory[]> { return []; }
  async deletePhotoTagsByMemory(_memoryId: string): Promise<boolean> { return true; }
  async searchUsersByName(_query: string): Promise<User[]> { return []; }

  // Year purchase operations
  async getYearPurchasesBySchool(schoolId: string): Promise<YearPurchase[]> {
    return Array.from(this.yearPurchases.values()).filter(
      (purchase) => purchase.schoolId === schoolId,
    );
  }

  async createYearPurchase(insertPurchase: InsertYearPurchase): Promise<YearPurchase> {
    const id = randomUUID();
    const purchase: YearPurchase = {
      ...insertPurchase,
      id,
      purchased: insertPurchase.purchased ?? false,
      createdAt: new Date(),
      purchaseDate: insertPurchase.purchaseDate ? new Date(insertPurchase.purchaseDate) : null,
      price: insertPurchase.price ?? null,
      paymentReference: insertPurchase.paymentReference ?? null,
    };
    this.yearPurchases.set(id, purchase);
    return purchase;
  }

  async updateYearPurchase(purchaseId: string, purchased: boolean, unlockedByAdmin?: boolean): Promise<YearPurchase | undefined> {
    const purchase = this.yearPurchases.get(purchaseId);
    if (!purchase) return undefined;
    
    const updatedPurchase = { 
      ...purchase, 
      purchased, 
      purchaseDate: purchased ? new Date() : null,
      unlockedByAdmin: unlockedByAdmin ?? purchase.unlockedByAdmin ?? false
    };
    this.yearPurchases.set(purchaseId, updatedPurchase);
    return updatedPurchase;
  }

  // Viewer year purchase operations
  async getViewerYearPurchases(userId: string, schoolId: string): Promise<ViewerYearPurchase[]> {
    return Array.from(this.viewerYearPurchases.values()).filter(
      (purchase) => purchase.userId === userId && purchase.schoolId === schoolId,
    );
  }

  async getAllViewerYearPurchases(userId: string): Promise<ViewerYearPurchase[]> {
    // Get all purchases for this user with school information
    const purchases = Array.from(this.viewerYearPurchases.values()).filter(
      (purchase) => purchase.userId === userId && purchase.purchased === true
    );
    
    // Add school information to each purchase for Library display
    const purchasesWithSchoolInfo = await Promise.all(
      purchases.map(async (purchase) => {
        const school = this.schools.get(purchase.schoolId);
        return {
          ...purchase,
          school: school || null,
        };
      })
    );
    
    return purchasesWithSchoolInfo;
  }

  async createViewerYearPurchase(insertPurchase: InsertViewerYearPurchase): Promise<ViewerYearPurchase> {
    const id = randomUUID();
    const purchase: ViewerYearPurchase = {
      ...insertPurchase,
      id,
      purchased: insertPurchase.purchased ?? false,
      createdAt: new Date(),
      purchaseDate: insertPurchase.purchaseDate ?? null,
      price: insertPurchase.price ?? "4.99",
      paymentReference: insertPurchase.paymentReference ?? null,
    };
    this.viewerYearPurchases.set(id, purchase);
    return purchase;
  }

  async updateViewerYearPurchase(purchaseId: string, purchased: boolean): Promise<ViewerYearPurchase | undefined> {
    const purchase = this.viewerYearPurchases.get(purchaseId);
    if (!purchase) return undefined;
    
    const updatedPurchase = { 
      ...purchase, 
      purchased, 
      purchaseDate: purchased ? new Date() : null 
    };
    this.viewerYearPurchases.set(purchaseId, updatedPurchase);
    return updatedPurchase;
  }

  // Cart operations
  async getCartItems(userId: string): Promise<CartItem[]> {
    return Array.from(this.cartItems.values()).filter(
      (item) => item.userId === userId,
    );
  }

  async addCartItem(insertCartItem: InsertCartItem): Promise<CartItem> {
    const id = randomUUID();
    const cartItem: CartItem = {
      ...insertCartItem,
      id,
      price: insertCartItem.price ?? "4.99",
      addedAt: new Date(),
    };
    this.cartItems.set(id, cartItem);
    return cartItem;
  }

  async removeCartItem(cartItemId: string): Promise<boolean> {
    return this.cartItems.delete(cartItemId);
  }

  async clearCart(userId: string): Promise<boolean> {
    const userCartItems = Array.from(this.cartItems.entries()).filter(
      ([, item]) => item.userId === userId
    );
    
    for (const [cartItemId] of userCartItems) {
      this.cartItems.delete(cartItemId);
    }
    
    return true;
  }

  // Additional required methods for MemStorage
  async getSchoolById(schoolId: string): Promise<School | undefined> {
    return this.schools.get(schoolId);
  }

  async updateSchoolSubaccount(schoolId: string, subaccountCode: string, bankAccountNumber: string, bankCode: string, status: string): Promise<School | undefined> {
    const school = this.schools.get(schoolId);
    if (!school) return undefined;
    
    const updatedSchool = {
      ...school,
      paystackSubaccountCode: subaccountCode,
      bankAccountNumber: bankAccountNumber,
      bankCode: bankCode,
      subaccountStatus: status
    };
    
    this.schools.set(schoolId, updatedSchool);
    return updatedSchool;
  }

  async deleteCartItemsBySchoolAndYear(schoolId: string, year: number): Promise<number> {
    const itemsToDelete = Array.from(this.cartItems.entries()).filter(
      ([, item]) => item.schoolId === schoolId && item.year === year
    );
    
    for (const [cartItemId] of itemsToDelete) {
      this.cartItems.delete(cartItemId);
    }
    
    return itemsToDelete.length;
  }

  async getCartItem(userId: string, schoolId: string, year: number): Promise<CartItem | undefined> {
    return Array.from(this.cartItems.values()).find(
      (item) => item.userId === userId && item.schoolId === schoolId && item.year === year
    );
  }

  // Alumni request blocking
  async createAlumniRequestBlock(insertBlock: InsertAlumniRequestBlock): Promise<AlumniRequestBlock> {
    const id = randomUUID();
    const block: AlumniRequestBlock = {
      ...insertBlock,
      id,
      createdAt: new Date(),
    };
    this.alumniRequestBlocks.set(id, block);
    return block;
  }

  async getAlumniRequestBlocks(userId: string, schoolId: string): Promise<AlumniRequestBlock[]> {
    return Array.from(this.alumniRequestBlocks.values()).filter(
      (block) => block.userId === userId && block.schoolId === schoolId && 
      new Date() < new Date(block.blockedUntil),
    );
  }

  // Alumni request rate limiting
  async getAlumniRequestsInLastWeek(userId: string): Promise<AlumniRequest[]> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return Array.from(this.alumniRequests.values()).filter(
      (request) => request.userId === userId && 
      new Date(request.createdAt || '') >= oneWeekAgo,
    );
  }

  async hasExistingAlumniRequest(userId: string, schoolId: string): Promise<boolean> {
    return Array.from(this.alumniRequests.values()).some(
      (request) => request.userId === userId && 
      request.schoolId === schoolId && 
      request.status === 'pending',
    );
  }

  async getAlumniBadgesByUser(userId: string): Promise<AlumniBadge[]> {
    return Array.from(this.alumniBadges.values()).filter(
      (badge) => badge.userId === userId,
    );
  }

  async getAlumniBadgesBySchool(schoolId: string): Promise<AlumniBadge[]> {
    // Find the school by ID to get the school name
    const school = this.schools.get(schoolId);
    if (!school) return [];
    
    return Array.from(this.alumniBadges.values()).filter(
      (badge) => badge.school === school.name,
    );
  }

  async createAlumniBadge(insertBadge: InsertAlumniBadge): Promise<AlumniBadge> {
    const id = randomUUID();
    
    // Accept the badge with fullName already provided by DatabaseStorage
    const badge: AlumniBadge = { 
      ...insertBadge, 
      id,
      fullName: insertBadge.fullName || 'Unknown User', // Use provided fullName or fallback
      createdAt: new Date(),
    };
    this.alumniBadges.set(id, badge);
    return badge;
  }

  async updateAlumniBadgeStatus(badgeId: string, status: "verified" | "pending"): Promise<AlumniBadge | undefined> {
    const badge = this.alumniBadges.get(badgeId);
    if (!badge) return undefined;
    
    const updatedBadge = { ...badge, status };
    this.alumniBadges.set(badgeId, updatedBadge);
    return updatedBadge;
  }

  async deleteAlumniBadge(badgeId: string): Promise<boolean> {
    return this.alumniBadges.delete(badgeId);
  }

  async getAlumniRequestsBySchool(schoolId: string): Promise<AlumniRequest[]> {
    return Array.from(this.alumniRequests.values()).filter(
      (request) => request.schoolId === schoolId,
    );
  }

  async getAlumniRequestById(requestId: string): Promise<AlumniRequest | undefined> {
    return this.alumniRequests.get(requestId);
  }

  async getAlumniRequest(requestId: string): Promise<AlumniRequest | undefined> {
    return this.alumniRequests.get(requestId);
  }

  async updateAlumniRequest(id: string, updates: Partial<AlumniRequest>): Promise<AlumniRequest | undefined> {
    const existing = this.alumniRequests.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.alumniRequests.set(id, updated);
    return updated;
  }

  async deleteAlumniRequest(id: string): Promise<boolean> {
    return this.alumniRequests.delete(id);
  }

  async getAlumniRequests(): Promise<AlumniRequest[]> {
    return Array.from(this.alumniRequests.values());
  }

  async getAlumniBadges(): Promise<AlumniBadge[]> {
    return Array.from(this.alumniBadges.values());
  }



  async getYearbookPages(yearbookId: string): Promise<YearbookPage[]> {
    return Array.from(this.yearbookPages.values()).filter(
      (page) => page.yearbookId === yearbookId
    ).sort((a, b) => a.pageNumber - b.pageNumber);
  }

  async updateYearbookPage(id: string, updates: Partial<YearbookPage>): Promise<YearbookPage | undefined> {
    const existing = this.yearbookPages.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.yearbookPages.set(id, updated);
    return updated;
  }

  async updateYearbookPageOrder(pageId: string, newPageNumber: number): Promise<YearbookPage | undefined> {
    const page = this.yearbookPages.get(pageId);
    if (!page) return undefined;
    
    const updatedPage = { ...page, pageNumber: newPageNumber };
    this.yearbookPages.set(pageId, updatedPage);
    return updatedPage;
  }

  async createAlumniRequest(insertRequest: InsertAlumniRequest): Promise<AlumniRequest> {
    const id = randomUUID();
    const request: AlumniRequest = {
      ...insertRequest,
      id,
      status: insertRequest.status || "pending",
      reviewedBy: insertRequest.reviewedBy || null,
      reviewedAt: null,
      reviewNotes: insertRequest.reviewNotes || null,
      postHeld: insertRequest.postHeld || null,
      studentName: insertRequest.studentName || null,
      studentAdmissionYear: insertRequest.studentAdmissionYear || null,
      additionalInfo: insertRequest.additionalInfo || null,
      createdAt: new Date(),
    };
    this.alumniRequests.set(id, request);
    return request;
  }

  async updateAlumniRequestStatus(
    requestId: string, 
    status: string, 
    reviewedBy: string, 
    reviewNotes?: string
  ): Promise<AlumniRequest | undefined> {
    const request = this.alumniRequests.get(requestId);
    if (!request) return undefined;

    const updatedRequest: AlumniRequest = {
      ...request,
      status,
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
    };
    
    this.alumniRequests.set(requestId, updatedRequest);
    return updatedRequest;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((notification) => notification.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getAllNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = {
      ...insertNotification,
      id,
      isRead: insertNotification.isRead ?? false,
      relatedId: insertNotification.relatedId ?? null,
      createdAt: new Date(),
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    const notification = this.notifications.get(notificationId);
    if (!notification) return false;

    const updatedNotification: Notification = {
      ...notification,
      isRead: true,
    };
    this.notifications.set(notificationId, updatedNotification);
    return true;
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    return this.notifications.delete(notificationId);
  }

  async clearAllNotifications(userId: string): Promise<number> {
    const userNotifications = Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId
    );
    
    userNotifications.forEach((notification) => {
      this.notifications.delete(notification.id);
    });
    
    return userNotifications.length;
  }

  async deleteOldNotifications(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const oldNotifications = Array.from(this.notifications.values()).filter(
      (notification) => {
        const createdAt = notification.createdAt;
        return createdAt && createdAt < cutoffDate;
      }
    );
    
    oldNotifications.forEach((notification) => {
      this.notifications.delete(notification.id);
    });
    
    return oldNotifications.length;
  }

  // Student operations (for Alumni Tab - returns verified alumni as "students")

  async createStudent(student: InsertStudent): Promise<Student> {
    const id = randomUUID();
    const newStudent: Student = {
      id,
      ...student,
      profileImage: student.profileImage || null,
      admissionYear: student.admissionYear || null,
      createdAt: new Date(),
    };
    this.students.set(id, newStudent);
    return newStudent;
  }
  
  // Yearbook operations
  async getYearbook(schoolId: string, year: number): Promise<Yearbook | undefined> {
    const yearbook = Array.from(this.yearbooks.values()).find(
      (yb) => yb.schoolId === schoolId && yb.year === year
    );
    
    if (!yearbook) return undefined;
    
    // Enrich with pages and table of contents
    const pages = Array.from(this.yearbookPages.values()).filter(
      (page) => page.yearbookId === yearbook.id
    ).sort((a, b) => a.pageNumber - b.pageNumber);
    
    const tableOfContents = Array.from(this.tableOfContents.values()).filter(
      (item) => item.yearbookId === yearbook.id
    ).sort((a, b) => a.pageNumber - b.pageNumber);
    
    return {
      ...yearbook,
      pages,
      tableOfContents
    } as any;
  }

  async getYearbookById(id: string): Promise<Yearbook | undefined> {
    return this.yearbooks.get(id);
  }

  async getPublishedYearbook(schoolId: string, year: number): Promise<Yearbook | undefined> {
    const yearbook = Array.from(this.yearbooks.values()).find(
      (yb) => yb.schoolId === schoolId && yb.year === year && yb.isPublished === true
    );
    
    if (!yearbook) return undefined;
    
    // Enrich with pages and table of contents
    const pages = Array.from(this.yearbookPages.values()).filter(
      (page) => page.yearbookId === yearbook.id
    ).sort((a, b) => a.pageNumber - b.pageNumber);
    
    const tableOfContents = Array.from(this.tableOfContents.values()).filter(
      (item) => item.yearbookId === yearbook.id
    ).sort((a, b) => a.pageNumber - b.pageNumber);
    
    return {
      ...yearbook,
      pages,
      tableOfContents
    } as any;
  }
  
  async createYearbook(insertYearbook: InsertYearbook): Promise<Yearbook> {
    const id = randomUUID();
    const yearbook: Yearbook = {
      ...insertYearbook,
      id,
      isPublished: insertYearbook.isPublished ?? false,
      isInitialized: insertYearbook.isInitialized ?? false,
      frontCoverUrl: insertYearbook.frontCoverUrl || null,
      backCoverUrl: insertYearbook.backCoverUrl || null,
      orientation: insertYearbook.orientation ?? null,
      createdAt: new Date(),
      publishedAt: null,
    };
    this.yearbooks.set(id, yearbook);
    return yearbook;
  }
  
  async updateYearbookPublishStatus(yearbookId: string, isPublished: boolean): Promise<Yearbook | undefined> {
    const yearbook = this.yearbooks.get(yearbookId);
    if (!yearbook) return undefined;
    
    const updatedYearbook = {
      ...yearbook,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    };
    this.yearbooks.set(yearbookId, updatedYearbook);
    return updatedYearbook;
  }

  async getYearbookBySchoolAndYear(schoolId: string, year: number): Promise<Yearbook | undefined> {
    return this.getYearbook(schoolId, year);
  }

  async updateYearbook(yearbookId: string, updates: Partial<Yearbook>): Promise<Yearbook | undefined> {
    const yearbook = this.yearbooks.get(yearbookId);
    if (!yearbook) return undefined;
    
    const updatedYearbook = {
      ...yearbook,
      ...updates,
    };
    this.yearbooks.set(yearbookId, updatedYearbook);
    return updatedYearbook;
  }

  async updateYearbookCovers(yearbookId: string, frontCoverUrl: string | null, backCoverUrl: string | null): Promise<Yearbook | undefined> {
    const yearbook = this.yearbooks.get(yearbookId);
    if (!yearbook) return undefined;
    
    const updatedYearbook = {
      ...yearbook,
      frontCoverUrl,
      backCoverUrl,
    };
    this.yearbooks.set(yearbookId, updatedYearbook);
    return updatedYearbook;
  }
  
  async createYearbookPage(insertPage: InsertYearbookPage): Promise<YearbookPage> {
    const id = randomUUID();
    const page: YearbookPage = {
      ...insertPage,
      id,
      createdAt: new Date(),
    };
    this.yearbookPages.set(id, page);
    return page;
  }
  
  async deleteYearbookPage(pageId: string): Promise<boolean> {
    return this.yearbookPages.delete(pageId);
  }
  
  async getNextPageNumber(yearbookId: string): Promise<number> {
    const pages = Array.from(this.yearbookPages.values()).filter(
      (page) => page.yearbookId === yearbookId && page.pageType === "content"
    );
    return Math.max(...pages.map(p => p.pageNumber), 0) + 1;
  }
  
  async createTableOfContentsItem(insertItem: InsertTableOfContents): Promise<TableOfContentsItem> {
    const id = randomUUID();
    const item: TableOfContentsItem = {
      ...insertItem,
      id,
      createdAt: new Date(),
      description: insertItem.description || null,
    };
    this.tableOfContents.set(id, item);
    return item;
  }

  async updateTableOfContentsItem(tocId: string, updates: Partial<TableOfContentsItem>): Promise<TableOfContentsItem | undefined> {
    const item = this.tableOfContents.get(tocId);
    if (!item) return undefined;
    
    const updatedItem = { ...item, ...updates };
    this.tableOfContents.set(tocId, updatedItem);
    return updatedItem;
  }

  async deleteTableOfContentsItem(tocId: string): Promise<boolean> {
    return this.tableOfContents.delete(tocId);
  }

  // Payment operations (MemStorage - for testing only)
  private paymentRecords: Map<string, PaymentRecord> = new Map();

  async createPaymentRecord(payment: InsertPaymentRecord): Promise<PaymentRecord> {
    const id = randomUUID();
    const record: PaymentRecord = {
      ...payment,
      id,
      status: payment.status || 'pending',
      schoolId: payment.schoolId || null,
      splitCode: payment.splitCode || null,
      platformAmount: payment.platformAmount || null,
      schoolAmount: payment.schoolAmount || null,
      splitStatus: payment.splitStatus || 'pending',
      paystackData: payment.paystackData || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.paymentRecords.set(id, record);
    return record;
  }

  async getPaymentByReference(reference: string): Promise<PaymentRecord | undefined> {
    return Array.from(this.paymentRecords.values()).find(p => p.reference === reference);
  }

  async updatePaymentStatus(reference: string, status: string): Promise<PaymentRecord | undefined> {
    const record = Array.from(this.paymentRecords.values()).find(p => p.reference === reference);
    if (!record) return undefined;
    
    record.status = status;
    record.updatedAt = new Date();
    this.paymentRecords.set(record.id, record);
    return record;
  }

  async getPaymentRecordsBySchool(schoolId: string): Promise<PaymentRecord[]> {
    return Array.from(this.paymentRecords.values()).filter(p => p.schoolId === schoolId);
  }

  async clearUserCart(userId: string): Promise<boolean> {
    // clearUserCart is an alias for clearCart
    return this.clearCart(userId);
  }

  // Helper function to generate 12-digit yearbook code in XXXX-XXXX-XXXX format
  private generateYearbookCode(): string {
    const part1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const part2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const part3 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${part1}-${part2}-${part3}`;
  }

  // Yearbook code operations
  async createYearbookCodes(schoolId: string, year: number, count: number): Promise<YearbookCode[]> {
    const codes: YearbookCode[] = [];
    
    for (let i = 0; i < count; i++) {
      let code: string;
      let attempts = 0;
      
      // Generate unique code (check both memory and database)
      do {
        code = this.generateYearbookCode();
        attempts++;
        if (attempts > 100) throw new Error('Unable to generate unique code after 100 attempts');
      } while (Array.from(this.yearbookCodes.values()).some(c => c.code === code));
      
      const id = randomUUID();
      const yearbookCode: YearbookCode = {
        id,
        schoolId,
        year,
        code,
        isUsed: false,
        usedBy: null,
        usedAt: null,
        createdAt: new Date(),
      };
      
      this.yearbookCodes.set(id, yearbookCode);
      codes.push(yearbookCode);
    }
    
    return codes;
  }

  async redeemYearbookCode(code: string, userId: string): Promise<{ success: boolean; message: string; year?: number }> {
    // Find the code
    const yearbookCode = Array.from(this.yearbookCodes.values()).find(c => c.code === code);
    
    if (!yearbookCode) {
      return { success: false, message: 'Invalid code' };
    }
    
    if (yearbookCode.isUsed) {
      return { success: false, message: 'Code has already been used' };
    }
    
    // Check if user already has access to this year for this school
    const hasAccess = await this.checkUserYearbookAccess(userId, yearbookCode.schoolId, yearbookCode.year);
    if (hasAccess) {
      const school = await this.getSchool(yearbookCode.schoolId);
      return { 
        success: false, 
        message: `${yearbookCode.year} yearbook is already unlocked` 
      };
    }
    
    // Mark code as used
    yearbookCode.isUsed = true;
    yearbookCode.usedBy = userId;
    yearbookCode.usedAt = new Date();
    this.yearbookCodes.set(yearbookCode.id, yearbookCode);
    
    // Create viewer year purchase record to grant access
    await this.createViewerYearPurchase({
      userId,
      schoolId: yearbookCode.schoolId,
      year: yearbookCode.year,
      purchased: true,
      price: "0.00" // Free access via code
    });
    
    return { success: true, message: 'Code redeemed successfully', year: yearbookCode.year };
  }

  async getYearbookCodesBySchool(schoolId: string): Promise<YearbookCode[]> {
    return Array.from(this.yearbookCodes.values()).filter(c => c.schoolId === schoolId);
  }

  async checkUserYearbookAccess(userId: string, schoolId: string, year: number): Promise<boolean> {
    // First check if the yearbook is free for all viewers
    const yearbook = await this.getYearbookBySchoolAndYear(schoolId, year);
    if (yearbook?.isFree) {
      return true; // Free yearbook, all logged-in users have access
    }
    
    // Check if user has purchased access to this year
    const purchase = Array.from(this.viewerYearPurchases.values()).find(
      p => p.userId === userId && p.schoolId === schoolId && p.year === year && p.purchased
    );
    return !!purchase;
  }

  async deleteYearbookCode(codeId: string): Promise<void> {
    this.yearbookCodes.delete(codeId);
  }

  async deleteAllYearbookCodes(schoolId: string, year: number): Promise<void> {
    const codesToDelete = Array.from(this.yearbookCodes.values())
      .filter(c => c.schoolId === schoolId && c.year === year);
    
    codesToDelete.forEach(code => {
      this.yearbookCodes.delete(code.id);
    });
  }

  async getViewerPaymentHistory(userId: string): Promise<Array<ViewerYearPurchase & { schoolName: string }>> {
    const purchases = Array.from(this.viewerYearPurchases.values())
      .filter(p => p.userId === userId && p.paymentReference);
    
    const purchasesWithSchool = await Promise.all(purchases.map(async (purchase) => {
      const school = await this.getSchool(purchase.schoolId);
      return {
        ...purchase,
        schoolName: school?.name || 'Unknown School'
      };
    }));
    
    return purchasesWithSchool.sort((a, b) => {
      const dateA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
      const dateB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
      return dateB - dateA;
    });
  }

  // Helper function to generate 16-character alphanumeric code in XXXX-XXXX-XXXX-XXXX format
  private generatePublicUploadCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const part1 = Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const part2 = Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const part3 = Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const part4 = Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return `${part1}-${part2}-${part3}-${part4}`;
  }

  // Public upload link operations
  async createPublicUploadLink(linkData: { schoolId: string; year: number; category: string; expiresAt: Date; createdBy: string }): Promise<{ linkCode: string; id: string }> {
    const id = randomUUID();
    const plainCode = this.generatePublicUploadCode();
    const hashedCode = await hashUploadCode(plainCode);

    const publicUploadLink: PublicUploadLink = {
      id,
      schoolId: linkData.schoolId,
      year: linkData.year,
      category: linkData.category,
      linkCode: plainCode,
      hashedCode: hashedCode,
      expiresAt: linkData.expiresAt,
      isActive: true,
      maxUploads: 50,
      currentUploads: 0,
      createdBy: linkData.createdBy,
      createdAt: new Date()
    };

    this.publicUploadLinks.set(id, publicUploadLink);
    return { linkCode: plainCode, id };
  }

  async getPublicUploadLinkByCode(linkCode: string): Promise<{ id: string; schoolId: string; year: number; category: string; expiresAt: Date; isActive: boolean; currentUploads: number; maxUploads: number } | undefined> {
    const allLinks = Array.from(this.publicUploadLinks.values());
    
    for (const link of allLinks) {
      const isMatch = await verifyUploadCode(linkCode, link.hashedCode);
      if (isMatch) {
        const now = new Date();
        const isExpired = now > link.expiresAt;
        
        if (isExpired) {
          return undefined;
        }
        
        return {
          id: link.id,
          schoolId: link.schoolId,
          year: link.year,
          category: link.category,
          expiresAt: link.expiresAt,
          isActive: link.isActive || true,
          currentUploads: link.currentUploads || 0,
          maxUploads: link.maxUploads || 50
        };
      }
    }
    
    return undefined;
  }

  async getPublicUploadLinksBySchoolAndYear(schoolId: string, year: number): Promise<PublicUploadLink[]> {
    return Array.from(this.publicUploadLinks.values()).filter(
      link => link.schoolId === schoolId && link.year === year
    );
  }

  async getPublicUploadLinkById(linkId: string): Promise<PublicUploadLink | undefined> {
    return this.publicUploadLinks.get(linkId);
  }

  async updatePublicUploadLinkStatus(linkId: string, isActive: boolean): Promise<PublicUploadLink | undefined> {
    const link = this.publicUploadLinks.get(linkId);
    if (!link) return undefined;
    
    const updatedLink = { ...link, isActive };
    this.publicUploadLinks.set(linkId, updatedLink);
    return updatedLink;
  }

  async deletePublicUploadLink(linkId: string): Promise<boolean> {
    return this.publicUploadLinks.delete(linkId);
  }

  async incrementUploadCount(linkId: string): Promise<boolean> {
    const link = this.publicUploadLinks.get(linkId);
    if (!link) return false;
    
    const updatedLink = { ...link, currentUploads: (link.currentUploads || 0) + 1 };
    this.publicUploadLinks.set(linkId, updatedLink);
    return true;
  }


  async updateMemoryStatus(memoryId: string, status: 'pending' | 'approved' | 'rejected'): Promise<Memory | undefined> {
    const memory = this.memories.get(memoryId);
    if (!memory) return undefined;
    
    const updatedMemory = { ...memory, status };
    this.memories.set(memoryId, updatedMemory);
    return updatedMemory;
  }

  // Super Admin methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getAllSchools(): Promise<School[]> {
    return Array.from(this.schools.values());
  }

  async getAllAlumniBadges(): Promise<AlumniBadge[]> {
    return Array.from(this.alumniBadges.values());
  }

  async getAllAlumniRequests(): Promise<AlumniRequest[]> {
    return Array.from(this.alumniRequests.values());
  }

  // School gallery image operations (stub implementations - not used since we use DatabaseStorage)
  async getSchoolGalleryImages(schoolId: string): Promise<SchoolGalleryImage[]> {
    return [];
  }

  async addSchoolGalleryImage(image: InsertSchoolGalleryImage): Promise<SchoolGalleryImage> {
    const id = randomUUID();
    const galleryImage: SchoolGalleryImage = {
      ...image,
      id,
      createdAt: new Date(),
      isActive: image.isActive ?? true,
      displayOrder: image.displayOrder ?? 0,
      title: image.title ?? null,
      description: image.description ?? null
    };
    return galleryImage;
  }

  async updateSchoolGalleryImage(imageId: string, schoolId: string, updates: Partial<Pick<InsertSchoolGalleryImage, 'title' | 'description' | 'displayOrder' | 'isActive'>>): Promise<SchoolGalleryImage | undefined> {
    return undefined;
  }

  async deleteSchoolGalleryImage(imageId: string, schoolId: string): Promise<boolean> {
    return false;
  }

  async reorderSchoolGalleryImages(schoolId: string, imageOrders: { id: string; displayOrder: number }[]): Promise<boolean> {
    return true;
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  // User operations - hybrid approach: try database first, then memory
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (result[0]) return result[0];
    // Fallback to memory storage for users created in memory
    return this.memStorage.getUser(id);
  }

  async getUserWithPassword(id: string): Promise<User | undefined> {
    // Same as getUser since database select already includes all fields including password
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (result[0]) return result[0];
    // Fallback to memory storage for users created in memory
    return this.memStorage.getUserWithPassword(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
    if (result[0]) return result[0];
    // Fallback to memory storage for users created in memory
    return this.memStorage.getUserByUsername(username.toLowerCase());
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (result[0]) return result[0];
    // Fallback to memory storage for users created in memory
    return this.memStorage.getUserByEmail(email.toLowerCase());
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.emailVerificationToken, token)).limit(1);
    return result[0];
  }

  async getSuperAdmins(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, 'super_admin'));
  }

  // Helper function to normalize phone numbers for comparison (database version)
  private normalizePhoneNumber(phone: string): string {
    if (!phone) return "";
    
    // Remove all non-digit characters except + at the start
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
    
    // Remove leading + if present
    if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }
    
    // Convert to standard international format without +
    // Handle Nigerian numbers: if starts with 0, replace with 234
    if (cleaned.startsWith("0") && cleaned.length >= 10) {
      cleaned = "234" + cleaned.substring(1);
    }
    // If it doesn't start with 234 but looks like a Nigerian number, add 234
    else if (/^[789]/.test(cleaned) && cleaned.length >= 9 && cleaned.length <= 10) {
      cleaned = "234" + cleaned;
    }
    
    return cleaned;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    
    // Get all users and normalize their phone numbers for comparison
    const allUsers = await db.select().from(users);
    
    const matchingUser = allUsers.find(user => {
      if (!user.phoneNumber) return false;
      const userNormalizedPhone = this.normalizePhoneNumber(user.phoneNumber);
      return userNormalizedPhone === normalizedPhone;
    });
    
    if (matchingUser) return matchingUser;
    
    // Fallback to memory storage for users created in memory
    return this.memStorage.getUserByPhoneNumber(phoneNumber);
  }

  async validateUser(username: string, password: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(
      and(eq(users.username, username), eq(users.password, password))
    ).limit(1);
    if (result[0]) return result[0];
    // Fallback to memory storage for users created in memory
    return this.memStorage.validateUser(username, password);
  }

  async createUser(user: InsertUser): Promise<User> {
    const fullName = `${user.firstName}${user.middleName ? ' ' + user.middleName : ''} ${user.lastName}`;
    const newUser = { ...user, fullName };
    const result = await db.insert(users).values(newUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  // School operations
  async getSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async getApprovedSchools(): Promise<School[]> {
    return await db.select().from(schools).where(eq(schools.approvalStatus, 'approved'));
  }

  async getSchool(id: string): Promise<School | undefined> {
    const result = await db.select().from(schools).where(eq(schools.id, id)).limit(1);
    return result[0];
  }

  async getSchoolByUsername(username: string): Promise<School | undefined> {
    const result = await db.select().from(schools).where(eq(schools.username, username)).limit(1);
    return result[0];
  }

  async searchSchools(query: string): Promise<School[]> {
    const lowerQuery = `%${query.toLowerCase()}%`;
    return await db.select()
      .from(schools)
      .where(
        and(
          eq(schools.approvalStatus, 'approved'),
          or(
            sql`LOWER(${schools.name}) LIKE ${lowerQuery}`,
            sql`LOWER(${schools.username}) LIKE ${lowerQuery}`
          )
        )
      )
      .limit(20);
  }

  async getSchoolByEmail(email: string): Promise<School | undefined> {
    const result = await db.select().from(schools).where(eq(schools.email, email)).limit(1);
    return result[0];
  }

  async getSchoolByVerificationToken(token: string): Promise<School | undefined> {
    const result = await db.select().from(schools).where(eq(schools.emailVerificationToken, token)).limit(1);
    return result[0];
  }

  async updateSchool(schoolId: string, updates: Partial<School>): Promise<School | undefined> {
    const result = await db.update(schools).set(updates).where(eq(schools.id, schoolId)).returning();
    return result[0];
  }

  async getSchoolById(schoolId: string): Promise<School | undefined> {
    const result = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
    return result[0];
  }

  async getSchoolByAdminUserId(userId: string): Promise<School | undefined> {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user[0]?.schoolId) return undefined;
    
    const result = await db.select().from(schools).where(eq(schools.id, user[0].schoolId)).limit(1);
    return result[0];
  }

  async createSchool(school: InsertSchool): Promise<School> {
    const result = await db.insert(schools).values(school).returning();
    return result[0];
  }

  async updateSchoolProfile(schoolId: string, updates: Partial<Pick<School, 'address' | 'state' | 'email' | 'city'>>): Promise<School | undefined> {
    const result = await db.update(schools).set(updates).where(eq(schools.id, schoolId)).returning();
    return result[0];
  }

  async updateSchoolLogo(schoolId: string, logoPath: string, cloudinaryPublicId?: string | null): Promise<School | undefined> {
    const result = await db.update(schools).set({ 
      logo: logoPath,
      logoCloudinaryId: cloudinaryPublicId || null 
    }).where(eq(schools.id, schoolId)).returning();
    return result[0];
  }

  async updateSchoolBanner(schoolId: string, bannerPath: string, cloudinaryPublicId?: string | null): Promise<School | undefined> {
    const result = await db.update(schools).set({ 
      coverPhoto: bannerPath,
      coverPhotoCloudinaryId: cloudinaryPublicId || null 
    }).where(eq(schools.id, schoolId)).returning();
    return result[0];
  }

  async getSchoolByActivationCode(activationCode: string): Promise<School | undefined> {
    const result = await db.select().from(schools).where(eq(schools.activationCode, activationCode)).limit(1);
    return result[0];
  }

  async getSchoolAdminUser(schoolId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(
      and(
        eq(users.schoolId, schoolId),
        or(eq(users.userType, 'school'), eq(users.userType, 'school_admin'))
      )
    ).limit(1);
    return result[0];
  }

  async getPendingSchools(): Promise<School[]> {
    return await db.select().from(schools).where(eq(schools.approvalStatus, 'pending'));
  }

  async approveSchool(schoolId: string, approvedBy: string, activationCode: string): Promise<School | undefined> {
    const result = await db.update(schools)
      .set({
        approvalStatus: 'approved',
        activationCode,
        approvedBy,
        approvedAt: new Date()
      })
      .where(eq(schools.id, schoolId))
      .returning();
    return result[0];
  }

  async rejectSchool(schoolId: string, rejectedBy: string, reason: string): Promise<School | undefined> {
    const result = await db.update(schools)
      .set({
        approvalStatus: 'rejected',
        approvedBy: rejectedBy,
        approvedAt: new Date(),
        rejectionReason: reason
      })
      .where(eq(schools.id, schoolId))
      .returning();
    return result[0];
  }

  async updateSchoolSubaccount(schoolId: string, subaccountCode: string, bankAccountNumber: string, bankCode: string, status: string): Promise<School | undefined> {
    const result = await db.update(schools)
      .set({ 
        paystackSubaccountCode: subaccountCode,
        bankAccountNumber: bankAccountNumber,
        bankCode: bankCode,
        subaccountStatus: status,
        lastBankAccountChange: new Date()
      })
      .where(eq(schools.id, schoolId))
      .returning();
    return result[0];
  }

  async clearTempAdminCredentials(schoolId: string): Promise<void> {
    await db.update(schools)
      .set({ tempAdminCredentials: null })
      .where(eq(schools.id, schoolId));
  }

  // Memory operations
  async getMemoriesBySchoolAndYear(schoolId: string, year: number): Promise<Memory[]> {
    return await db.select().from(memories).where(
      and(eq(memories.schoolId, schoolId), eq(memories.year, year))
    );
  }

  async getMemoriesBySchool(schoolId: string): Promise<Memory[]> {
    return await db.select().from(memories).where(
      eq(memories.schoolId, schoolId)
    );
  }

  async getMemoriesByUser(userId: string): Promise<Memory[]> {
    return await db.select().from(memories).where(
      eq(memories.userId, userId)
    );
  }

  async createMemory(memory: InsertMemory): Promise<Memory> {
    const result = await db.insert(memories).values(memory).returning();
    return result[0];
  }

  async getPendingMemoriesBySchool(schoolId: string): Promise<Memory[]> {
    try {
      // Use direct SQL query that works perfectly
      const result = await db.execute(sql`
        SELECT id, title, description, image_url, media_type, event_date, year, category, status, uploaded_by, created_at 
        FROM memories 
        WHERE school_id = ${schoolId} AND status = 'pending' 
        ORDER BY created_at DESC
      `);
      return result.rows as Memory[];
    } catch (error) {
      console.error("Failed to get pending memories:", error);
      throw error;
    }
  }

  async getMemoryById(memoryId: string): Promise<Memory | undefined> {
    const result = await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1);
    return result[0];
  }

  async approveMemory(memoryId: string, approvedBy: string): Promise<Memory | undefined> {
    const result = await db.update(memories)
      .set({ 
        status: 'approved'
      })
      .where(eq(memories.id, memoryId))
      .returning();
    return result[0];
  }

  async updateMemoryTitle(memoryId: string, title: string, category?: string): Promise<Memory | undefined> {
    const updateData: any = { title };
    if (category) {
      updateData.category = category;
    }
    
    const result = await db.update(memories)
      .set(updateData)
      .where(eq(memories.id, memoryId))
      .returning();
    
    return result[0];
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      await db.delete(memories).where(eq(memories.id, memoryId));
      return true;
    } catch (error) {
      return false;
    }
  }

  // Year purchase operations
  async getYearPurchasesBySchool(schoolId: string): Promise<YearPurchase[]> {
    return await db.select().from(yearPurchases).where(
      eq(yearPurchases.schoolId, schoolId)
    );
  }

  async createYearPurchase(purchase: InsertYearPurchase): Promise<YearPurchase> {
    const result = await db.insert(yearPurchases).values(purchase).returning();
    return result[0];
  }

  async updateYearPurchase(purchaseId: string, purchased: boolean, unlockedByAdmin?: boolean): Promise<YearPurchase | undefined> {
    const updates: any = { purchased };
    if (purchased) {
      updates.purchaseDate = new Date();
    }
    if (unlockedByAdmin !== undefined) {
      updates.unlockedByAdmin = unlockedByAdmin;
    }
    const result = await db.update(yearPurchases).set(updates).where(eq(yearPurchases.id, purchaseId)).returning();
    return result[0];
  }

  // Continue with other methods following the same pattern...
  // For brevity, I'll implement the key yearbook methods needed for the orientation feature
  
  // Yearbook operations
  async getYearbooksBySchool(schoolId: string): Promise<Yearbook[]> {
    return await db.select().from(yearbooks).where(eq(yearbooks.schoolId, schoolId));
  }

  async getYearbookById(id: string): Promise<Yearbook | undefined> {
    const result = await db.select().from(yearbooks).where(eq(yearbooks.id, id)).limit(1);
    return result[0];
  }

  async getYearbook(schoolId: string, year: number): Promise<Yearbook | undefined> {
    return this.getYearbookBySchoolAndYear(schoolId, year);
  }

  async getYearbookBySchoolAndYear(schoolId: string, year: number): Promise<Yearbook | undefined> {
    const result = await db.select().from(yearbooks).where(
      and(eq(yearbooks.schoolId, schoolId), eq(yearbooks.year, year))
    ).limit(1);
    
    const yearbook = result[0];
    if (!yearbook) return undefined;
    
    // Fetch related pages and table of contents
    const pages = await db.select().from(yearbookPages).where(eq(yearbookPages.yearbookId, yearbook.id));
    const tocItems = await db.select().from(tableOfContents).where(eq(tableOfContents.yearbookId, yearbook.id));
    
    return {
      ...yearbook,
      pages: pages.sort((a, b) => a.pageNumber - b.pageNumber),
      tableOfContents: tocItems.sort((a, b) => a.pageNumber - b.pageNumber)
    } as any;
  }

  async createYearbook(yearbook: InsertYearbook): Promise<Yearbook> {
    const result = await db.insert(yearbooks).values(yearbook).returning();
    return result[0];
  }

  async updateYearbook(id: string, updates: Partial<Yearbook>): Promise<Yearbook | undefined> {
    const result = await db.update(yearbooks).set(updates).where(eq(yearbooks.id, id)).returning();
    return result[0];
  }

  async getAllYearbooksForSchool(schoolId: string): Promise<{ year: number; price: string | null; isFree: boolean }[]> {
    const result = await db.select({
      year: yearbooks.year,
      price: yearbooks.price,
      isFree: yearbooks.isFree
    }).from(yearbooks).where(eq(yearbooks.schoolId, schoolId));
    
    return result.map(yb => ({
      year: yb.year,
      price: yb.price,
      isFree: yb.isFree || false
    }));
  }

  async getPublishedYearbook(schoolId: string, year: number): Promise<Yearbook | undefined> {
    const result = await db.select().from(yearbooks).where(
      and(eq(yearbooks.schoolId, schoolId), eq(yearbooks.year, year), eq(yearbooks.isPublished, true))
    ).limit(1);
    
    const yearbook = result[0];
    if (!yearbook) return undefined;
    
    // Fetch related pages and table of contents
    const pages = await db.select().from(yearbookPages).where(eq(yearbookPages.yearbookId, yearbook.id));
    const tocItems = await db.select().from(tableOfContents).where(eq(tableOfContents.yearbookId, yearbook.id));
    
    return {
      ...yearbook,
      pages: pages.sort((a, b) => a.pageNumber - b.pageNumber),
      tableOfContents: tocItems.sort((a, b) => a.pageNumber - b.pageNumber)
    } as any;
  }

  async updateYearbookPublishStatus(yearbookId: string, isPublished: boolean): Promise<Yearbook | undefined> {
    const updates: any = { isPublished };
    if (isPublished) {
      updates.publishedAt = new Date();
    }
    const result = await db.update(yearbooks).set(updates).where(eq(yearbooks.id, yearbookId)).returning();
    return result[0];
  }

  async updateYearbookCovers(yearbookId: string, frontCoverUrl: string | null, backCoverUrl: string | null): Promise<Yearbook | undefined> {
    const result = await db.update(yearbooks)
      .set({ frontCoverUrl, backCoverUrl })
      .where(eq(yearbooks.id, yearbookId))
      .returning();
    return result[0];
  }

  async setDraftCovers(yearbookId: string, frontCoverUrl: string | null, backCoverUrl: string | null): Promise<Yearbook | undefined> {
    const result = await db.update(yearbooks)
      .set({ 
        draftFrontCoverUrl: frontCoverUrl, 
        draftBackCoverUrl: backCoverUrl,
        hasUnsavedDrafts: true
      })
      .where(eq(yearbooks.id, yearbookId))
      .returning();
    return result[0];
  }

  async publishDrafts(yearbookId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get the yearbook to check for drafts
      const [yearbook] = await db.select().from(yearbooks).where(eq(yearbooks.id, yearbookId)).limit(1);
      if (!yearbook) {
        return { success: false, message: "Yearbook not found" };
      }

      // Update yearbook covers from drafts
      if (yearbook.draftFrontCoverUrl || yearbook.draftBackCoverUrl) {
        await db.update(yearbooks)
          .set({
            frontCoverUrl: yearbook.draftFrontCoverUrl || yearbook.frontCoverUrl,
            backCoverUrl: yearbook.draftBackCoverUrl || yearbook.backCoverUrl,
            draftFrontCoverUrl: null,
            draftBackCoverUrl: null,
            draftFrontCoverCloudinaryId: null,
            draftBackCoverCloudinaryId: null
          })
          .where(eq(yearbooks.id, yearbookId));
      }

      // Delete all draft_deleted pages permanently
      await db.delete(yearbookPages)
        .where(and(eq(yearbookPages.yearbookId, yearbookId), eq(yearbookPages.status, 'draft_deleted')));

      // Publish all draft pages (change status from 'draft' to 'published')
      await db.update(yearbookPages)
        .set({ status: 'published' })
        .where(and(eq(yearbookPages.yearbookId, yearbookId), eq(yearbookPages.status, 'draft')));

      // Publish all draft TOC items (update isDraft=false)
      await db.update(tableOfContents)
        .set({ isDraft: false })
        .where(and(eq(tableOfContents.yearbookId, yearbookId), eq(tableOfContents.isDraft, true)));

      // Update yearbook draft status
      await db.update(yearbooks)
        .set({
          hasUnsavedDrafts: false,
          lastDraftSaved: new Date()
        })
        .where(eq(yearbooks.id, yearbookId));

      return { success: true, message: "All changes saved successfully!" };
    } catch (error) {
      console.error("Error publishing drafts:", error);
      return { success: false, message: "Failed to save changes" };
    }
  }

  async discardDrafts(yearbookId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Delete all newly created draft pages
      await db.delete(yearbookPages)
        .where(and(eq(yearbookPages.yearbookId, yearbookId), eq(yearbookPages.status, 'draft')));

      // Restore pages marked as draft_deleted back to published
      await db.update(yearbookPages)
        .set({ status: 'published' })
        .where(and(eq(yearbookPages.yearbookId, yearbookId), eq(yearbookPages.status, 'draft_deleted')));

      // Delete all draft TOC items
      await db.delete(tableOfContents)
        .where(and(eq(tableOfContents.yearbookId, yearbookId), eq(tableOfContents.isDraft, true)));

      // Clear draft covers and reset draft status
      await db.update(yearbooks)
        .set({
          draftFrontCoverUrl: null,
          draftBackCoverUrl: null,
          draftFrontCoverCloudinaryId: null,
          draftBackCoverCloudinaryId: null,
          hasUnsavedDrafts: false,
          lastAutoSaved: null
        })
        .where(eq(yearbooks.id, yearbookId));

      return { success: true, message: "All unsaved changes discarded" };
    } catch (error) {
      console.error("Error discarding drafts:", error);
      return { success: false, message: "Failed to discard changes" };
    }
  }

  async updateDraftTimestamp(yearbookId: string, isAutoSave: boolean): Promise<Yearbook | undefined> {
    const updates: any = { hasUnsavedDrafts: true };
    if (isAutoSave) {
      updates.lastAutoSaved = new Date();
    } else {
      updates.lastDraftSaved = new Date();
    }
    const result = await db.update(yearbooks)
      .set(updates)
      .where(eq(yearbooks.id, yearbookId))
      .returning();
    return result[0];
  }

  async updateYearbookPrice(yearbookId: string, newPrice: string, changedBy: string): Promise<{ success: boolean; message: string; yearbook?: Yearbook }> {
    const priceNum = parseFloat(newPrice);
    
    // Validate price range
    if (priceNum < 1.99 || priceNum > 49.99) {
      return { 
        success: false, 
        message: 'Price must be between $1.99 and $49.99' 
      };
    }

    // Get current yearbook
    const [yearbook] = await db.select().from(yearbooks).where(eq(yearbooks.id, yearbookId)).limit(1);
    if (!yearbook) {
      return { success: false, message: 'Yearbook not found' };
    }

    const oldPrice = yearbook.price;
    const isFirstTimePrice = !oldPrice;
    
    // Check if price is actually changing
    if (!isFirstTimePrice && oldPrice === newPrice) {
      return { 
        success: false, 
        message: 'New price is the same as current price' 
      };
    }
    
    // Check price change cooldown (3 changes per 48 hours) - only if updating existing price
    if (!isFirstTimePrice) {
      const canChange = await this.canChangeYearbookPrice(yearbookId);
      if (!canChange.canChange) {
        return { 
          success: false, 
          message: canChange.message || "You've reached the maximum number of price changes. Please wait 48 hours before making another update."
        };
      }
    }
    
    // Update price
    await db.update(yearbooks)
      .set({ price: newPrice })
      .where(eq(yearbooks.id, yearbookId));

    // Log price change in history (this creates the timestamp for cooldown tracking)
    await db.insert(yearbookPriceHistory).values({
      yearbookId,
      oldPrice: oldPrice || "0.00",
      newPrice,
      changedBy
    });

    // Create notification for school with appropriate message
    const notificationMessage = isFirstTimePrice 
      ? `${yearbook.title} price set to $${newPrice}`
      : `${yearbook.title} price updated from $${oldPrice} to $${newPrice}`;

    await this.createNotification({
      userId: changedBy,
      type: 'price_updated',
      title: 'Yearbook Price Updated',
      message: notificationMessage,
      relatedId: yearbookId
    });

    const [updatedYearbook] = await db.select().from(yearbooks).where(eq(yearbooks.id, yearbookId)).limit(1);
    
    const changesRemaining = isFirstTimePrice ? 3 : (await this.canChangeYearbookPrice(yearbookId)).changesRemaining;
    
    return { 
      success: true, 
      message: isFirstTimePrice 
        ? 'Price set successfully.' 
        : `Price updated successfully. You have ${changesRemaining! - 1} price change(s) remaining in the next 48 hours.`, 
      yearbook: updatedYearbook 
    };
  }

  async getYearbookPriceHistory(yearbookId: string): Promise<YearbookPriceHistory[]> {
    return await db.select()
      .from(yearbookPriceHistory)
      .where(eq(yearbookPriceHistory.yearbookId, yearbookId))
      .orderBy(yearbookPriceHistory.changedAt);
  }

  async canChangeYearbookPrice(yearbookId: string): Promise<{ canChange: boolean; message?: string; changesRemaining?: number }> {
    // Get all price changes for this yearbook in the last 48 hours
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
    
    const recentChanges = await db.select()
      .from(yearbookPriceHistory)
      .where(
        and(
          eq(yearbookPriceHistory.yearbookId, yearbookId),
          sql`${yearbookPriceHistory.changedAt} > ${fortyEightHoursAgo}`
        )
      );
    
    const changeCount = recentChanges.length;
    
    // Maximum 3 changes per 48 hours
    if (changeCount >= 3) {
      return { 
        canChange: false, 
        message: "You've reached the maximum number of price changes. Please wait 48 hours before making another update.",
        changesRemaining: 0
      };
    }
    
    return { 
      canChange: true,
      changesRemaining: 3 - changeCount
    };
  }

  async getAllPublishedYearbooks(schoolId: string): Promise<{ id: string; year: number; title: string | null; isPublished: boolean; price: string; isFree: boolean; frontCoverUrl: string | null }[]> {
    const result = await db.select({
      id: yearbooks.id,
      year: yearbooks.year,
      title: yearbooks.title,
      isPublished: yearbooks.isPublished,
      price: yearbooks.price,
      isFree: yearbooks.isFree
    }).from(yearbooks).where(
      and(eq(yearbooks.schoolId, schoolId), eq(yearbooks.isPublished, true))
    );
    
    // Fetch front cover URLs for all yearbooks
    const yearbookIds = result.map(y => y.id);
    const frontCovers = yearbookIds.length > 0 ? await db.select({
      yearbookId: yearbookPages.yearbookId,
      imageUrl: yearbookPages.imageUrl
    }).from(yearbookPages).where(
      and(
        inArray(yearbookPages.yearbookId, yearbookIds),
        eq(yearbookPages.pageType, 'front_cover')
      )
    ) : [];
    
    // Create a map for easy lookup
    const frontCoverMap = new Map(frontCovers.map(fc => [fc.yearbookId, fc.imageUrl]));
    
    return result.map(yearbook => ({ 
      id: yearbook.id,
      year: yearbook.year,
      title: yearbook.title,
      isPublished: true,
      price: yearbook.price || "14.99",
      isFree: yearbook.isFree || false,
      frontCoverUrl: frontCoverMap.get(yearbook.id) || null
    }));
  }

  // For the remaining methods, let's keep using MemStorage temporarily 
  // This is a hybrid approach until we fully migrate
  private memStorage = new MemStorage();

  // Delegate remaining methods to MemStorage for now
  async getViewerYearPurchases(userId: string, schoolId: string): Promise<ViewerYearPurchase[]> {
    const result = await db.select().from(viewerYearPurchases).where(
      and(
        eq(viewerYearPurchases.userId, userId),
        eq(viewerYearPurchases.schoolId, schoolId)
      )
    );
    return result;
  }

  async getAllViewerYearPurchases(userId: string): Promise<ViewerYearPurchase[]> {
    // Get all purchases for this user with school information
    const purchases = await db.select().from(viewerYearPurchases).where(
      and(
        eq(viewerYearPurchases.userId, userId),
        eq(viewerYearPurchases.purchased, true)
      )
    );
    
    // Add school information to each purchase for Library display
    const purchasesWithSchoolInfo = await Promise.all(
      purchases.map(async (purchase) => {
        const schoolResults = await db.select().from(schools).where(eq(schools.id, purchase.schoolId));
        const school = schoolResults[0] || null;
        return {
          ...purchase,
          school: school,
        };
      })
    );
    
    return purchasesWithSchoolInfo;
  }

  async createViewerYearPurchase(purchase: InsertViewerYearPurchase): Promise<ViewerYearPurchase> {
    const result = await db.insert(viewerYearPurchases).values(purchase).returning();
    return result[0];
  }

  async updateViewerYearPurchase(purchaseId: string, purchased: boolean): Promise<ViewerYearPurchase | undefined> {
    const result = await db.update(viewerYearPurchases)
      .set({ 
        purchased, 
        purchaseDate: purchased ? new Date() : null 
      })
      .where(eq(viewerYearPurchases.id, purchaseId))
      .returning();
    return result[0];
  }

  // Cart operations
  async getCartItems(userId: string): Promise<CartItem[]> {
    const result = await db.select().from(cartItems).where(eq(cartItems.userId, userId));
    return result;
  }

  async addCartItem(cartItem: InsertCartItem): Promise<CartItem> {
    const result = await db.insert(cartItems).values(cartItem).returning();
    return result[0];
  }

  async removeCartItem(cartItemId: string): Promise<boolean> {
    const result = await db.delete(cartItems).where(eq(cartItems.id, cartItemId)).returning();
    return result.length > 0;
  }

  async clearCart(userId: string): Promise<boolean> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
    return true;
  }

  async deleteCartItemsBySchoolAndYear(schoolId: string, year: number): Promise<number> {
    const result = await db.delete(cartItems)
      .where(and(eq(cartItems.schoolId, schoolId), eq(cartItems.year, year)))
      .returning();
    return result.length;
  }

  async getCartItem(userId: string, schoolId: string, year: number): Promise<CartItem | undefined> {
    const result = await db.select().from(cartItems).where(
      and(
        eq(cartItems.userId, userId),
        eq(cartItems.schoolId, schoolId),
        eq(cartItems.year, year)
      )
    ).limit(1);
    return result[0];
  }

  async createAlumniRequestBlock(block: InsertAlumniRequestBlock): Promise<AlumniRequestBlock> {
    return this.memStorage.createAlumniRequestBlock(block);
  }

  async getAlumniRequestBlocks(userId: string, schoolId: string): Promise<AlumniRequestBlock[]> {
    return this.memStorage.getAlumniRequestBlocks(userId, schoolId);
  }

  async getAlumniRequests(): Promise<AlumniRequest[]> {
    return await db.select().from(alumniRequests);
  }

  async getYearbookPages(yearbookId: string): Promise<YearbookPage[]> {
    // Query database first for pages stored in database
    const result = await db.select().from(yearbookPages).where(eq(yearbookPages.yearbookId, yearbookId));
    if (result.length > 0) {
      return result.sort((a, b) => a.pageNumber - b.pageNumber);
    }
    // Fallback to memory storage for pages created in memory
    return this.memStorage.getYearbookPages(yearbookId);
  }

  async updateYearbookPage(id: string, updates: Partial<YearbookPage>): Promise<YearbookPage | undefined> {
    return this.memStorage.updateYearbookPage(id, updates);
  }

  async getAlumniRequestsBySchool(schoolId: string): Promise<AlumniRequest[]> {
    const result = await db.select().from(alumniRequests).where(eq(alumniRequests.schoolId, schoolId));
    return result;
  }

  async getAlumniRequest(id: string): Promise<AlumniRequest | undefined> {
    const result = await db.select().from(alumniRequests).where(eq(alumniRequests.id, id)).limit(1);
    return result[0];
  }

  async getAlumniRequestById(requestId: string): Promise<AlumniRequest | undefined> {
    const result = await db.select().from(alumniRequests).where(eq(alumniRequests.id, requestId)).limit(1);
    return result[0];
  }

  async updateAlumniRequestStatus(requestId: string, status: string, reviewedBy: string, reviewNotes?: string): Promise<AlumniRequest | undefined> {
    const result = await db.update(alumniRequests)
      .set({
        status,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null
      })
      .where(eq(alumniRequests.id, requestId))
      .returning();
    return result[0];
  }

  async hasExistingAlumniRequest(userId: string, schoolId: string): Promise<boolean> {
    const result = await db.select().from(alumniRequests)
      .where(
        and(
          eq(alumniRequests.userId, userId),
          eq(alumniRequests.schoolId, schoolId)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  async getAlumniRequestsInLastWeek(userId: string): Promise<AlumniRequest[]> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const result = await db.select().from(alumniRequests)
      .where(
        and(
          eq(alumniRequests.userId, userId),
          sql`${alumniRequests.createdAt} >= ${oneWeekAgo}`
        )
      );
    return result;
  }

  async createAlumniRequest(request: InsertAlumniRequest): Promise<AlumniRequest> {
    const result = await db.insert(alumniRequests).values(request).returning();
    return result[0];
  }

  async updateAlumniRequest(id: string, updates: Partial<AlumniRequest>): Promise<AlumniRequest | undefined> {
    const result = await db.update(alumniRequests)
      .set(updates)
      .where(eq(alumniRequests.id, id))
      .returning();
    return result[0];
  }

  async deleteAlumniRequest(id: string): Promise<boolean> {
    const result = await db.delete(alumniRequests).where(eq(alumniRequests.id, id));
    return true;
  }

  async getAlumniBadges(): Promise<AlumniBadge[]> {
    return await db.select().from(alumniBadges);
  }

  async getAlumniBadgesByUser(userId: string): Promise<AlumniBadge[]> {
    const result = await db
      .select({
        id: alumniBadges.id,
        userId: alumniBadges.userId,
        school: alumniBadges.school,
        fullName: alumniBadges.fullName,
        graduationYear: alumniBadges.graduationYear,
        admissionYear: alumniBadges.admissionYear,
        status: alumniBadges.status,
        createdAt: alumniBadges.createdAt,
        alumniRequestId: alumniBadges.alumniRequestId,
        email: users.email,
        phoneNumber: users.phoneNumber,
        profileImage: users.profileImage,
        showPhoneToAlumni: users.showPhoneToAlumni,
      })
      .from(alumniBadges)
      .innerJoin(users, eq(alumniBadges.userId, users.id))
      .where(eq(alumniBadges.userId, userId));
    
    return result as AlumniBadge[];
  }

  async getAlumniBadgesBySchool(schoolId: string): Promise<AlumniBadge[]> {
    const school = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
    if (!school[0]) return [];
    
    const result = await db
      .select({
        id: alumniBadges.id,
        userId: alumniBadges.userId,
        school: alumniBadges.school,
        fullName: alumniBadges.fullName,
        graduationYear: alumniBadges.graduationYear,
        admissionYear: alumniBadges.admissionYear,
        status: alumniBadges.status,
        createdAt: alumniBadges.createdAt,
        alumniRequestId: alumniBadges.alumniRequestId,
        email: users.email,
        phoneNumber: users.phoneNumber,
        profileImage: users.profileImage,
        showPhoneToAlumni: users.showPhoneToAlumni,
      })
      .from(alumniBadges)
      .innerJoin(users, eq(alumniBadges.userId, users.id))
      .where(eq(alumniBadges.school, school[0].name));
    
    return result as AlumniBadge[];
  }

  async updateAlumniBadgeStatus(badgeId: string, status: "verified" | "pending"): Promise<AlumniBadge | undefined> {
    const result = await db.update(alumniBadges).set({ status }).where(eq(alumniBadges.id, badgeId)).returning();
    return result[0];
  }

  async createAlumniBadge(badge: InsertAlumniBadge): Promise<AlumniBadge> {
    const result = await db.insert(alumniBadges).values(badge).returning();
    return result[0];
  }

  async deleteAlumniBadge(id: string): Promise<boolean> {
    const result = await db.delete(alumniBadges).where(eq(alumniBadges.id, id)).returning();
    return result.length > 0;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return this.memStorage.getNotificationsByUser(userId);
  }

  async getAllNotifications(): Promise<Notification[]> {
    return this.memStorage.getAllNotifications();
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    return this.memStorage.createNotification(notification);
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const result = await this.memStorage.markNotificationAsRead(id);
    return result !== undefined;
  }

  async deleteNotification(id: string): Promise<boolean> {
    return this.memStorage.deleteNotification(id);
  }

  async clearAllNotifications(userId: string): Promise<number> {
    return this.memStorage.clearAllNotifications(userId);
  }

  async deleteOldNotifications(daysOld: number): Promise<number> {
    return this.memStorage.deleteOldNotifications(daysOld);
  }

  // Notify verified alumni when upload code is created
  async notifyAlumniOfUploadCode(
    schoolId: string, 
    graduationYear: string, 
    uploadCode: string, 
    expiresAt: Date,
    linkId: string
  ): Promise<number> {
    try {
      // Get school info
      const school = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
      if (!school[0]) return 0;

      // Get all verified alumni for this school (all graduation years)
      const verifiedAlumni = await db
        .select()
        .from(alumniBadges)
        .where(
          and(
            eq(alumniBadges.school, school[0].name),
            eq(alumniBadges.status, 'verified')
          )
        );

      if (verifiedAlumni.length === 0) return 0;

      // Create notification for each verified alumni
      const notifications: InsertNotification[] = verifiedAlumni.map(alumni => ({
        userId: alumni.userId,
        type: 'upload_code_created',
        title: `Upload Code from ${school[0].name}`,
        message: `Graduation ${graduationYear} — ${uploadCode}`,
        isRead: false,
        relatedId: linkId,
        link: '/alumni/uploads',
        uploadCode: uploadCode,
        expiresAt: expiresAt
      }));

      // Bulk insert notifications using memory storage (which handles both DB and mem)
      for (const notification of notifications) {
        await this.createNotification(notification);
      }

      return notifications.length;
    } catch (error) {
      console.error('Error notifying alumni of upload code:', error);
      return 0;
    }
  }

  // Delete upload code notifications when code is deleted
  async deleteUploadCodeNotifications(linkId: string): Promise<number> {
    try {
      // Get all notifications related to this upload link
      const allNotifications = await this.memStorage.getAllNotifications();
      const relatedNotifications = allNotifications.filter(
        notif => notif.relatedId === linkId && notif.type === 'upload_code_created'
      );

      // Delete each notification
      for (const notif of relatedNotifications) {
        await this.deleteNotification(notif.id);
      }

      return relatedNotifications.length;
    } catch (error) {
      console.error('Error deleting upload code notifications:', error);
      return 0;
    }
  }

  async createYearbookPage(page: InsertYearbookPage): Promise<YearbookPage> {
    const result = await db.insert(yearbookPages).values(page).returning();
    return result[0];
  }

  async getYearbookPageById(pageId: string): Promise<YearbookPage | undefined> {
    const result = await db.select().from(yearbookPages).where(eq(yearbookPages.id, pageId)).limit(1);
    return result[0];
  }

  async getPagesByBatchId(batchId: string): Promise<YearbookPage[]> {
    const result = await db.select().from(yearbookPages).where(eq(yearbookPages.pdfUploadBatchId, batchId));
    return result;
  }

  async deleteYearbookPage(pageId: string): Promise<boolean> {
    const result = await db.delete(yearbookPages).where(eq(yearbookPages.id, pageId)).returning();
    return result.length > 0;
  }

  async getNextPageNumber(yearbookId: string): Promise<number> {
    const pages = await db.select().from(yearbookPages).where(
      and(eq(yearbookPages.yearbookId, yearbookId), eq(yearbookPages.pageType, "content"))
    );
    const maxPageNumber = pages.length > 0 ? Math.max(...pages.map(p => p.pageNumber)) : 0;
    return maxPageNumber + 1;
  }

  async updateYearbookPageOrder(pageId: string, newPageNumber: number): Promise<YearbookPage | undefined> {
    const result = await db.update(yearbookPages)
      .set({ pageNumber: newPageNumber })
      .where(eq(yearbookPages.id, pageId))
      .returning();
    return result[0];
  }

  async createTableOfContentsItem(insertItem: InsertTableOfContents): Promise<TableOfContentsItem> {
    const result = await db.insert(tableOfContents).values(insertItem).returning();
    return result[0];
  }

  async updateTableOfContentsItem(tocId: string, updates: Partial<TableOfContentsItem>): Promise<TableOfContentsItem | undefined> {
    const result = await db.update(tableOfContents)
      .set(updates)
      .where(eq(tableOfContents.id, tocId))
      .returning();
    return result[0];
  }

  async deleteTableOfContentsItem(tocId: string): Promise<boolean> {
    const result = await db.delete(tableOfContents).where(eq(tableOfContents.id, tocId)).returning();
    return result.length > 0;
  }

  // Super Admin methods
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async getAllAlumniBadges(): Promise<AlumniBadge[]> {
    return await db.select().from(alumniBadges);
  }

  async getAllAlumniRequests(): Promise<AlumniRequest[]> {
    return await db.select().from(alumniRequests);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (result[0]) return result[0];
    // Fallback to memory storage for users created in memory
    return this.memStorage.getUser(id);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return Array.isArray(result) && result.length > 0;
  }

  async deleteSchool(id: string): Promise<boolean> {
    const result = await db.delete(schools).where(eq(schools.id, id)).returning();
    return Array.isArray(result) && result.length > 0;
  }

  async updateUserRole(id: string, userType: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ userType })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateUserPrivacySettings(userId: string, updateData: { showPhoneToAlumni?: boolean; phoneNumber?: string }): Promise<User | undefined> {
    const result = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async updateUserProfile(userId: string, updateData: { email?: string; username?: string; fullName?: string; password?: string; preferredCurrency?: string; profileImage?: string }): Promise<User | undefined> {
    const result = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async logAdminAction(adminUserId: string, action: string, targetType: string, targetId: string, details?: Record<string, any>): Promise<void> {
    await db.insert(adminLogs).values({
      adminUserId,
      action,
      targetType,
      targetId,
      details: details || {}
    });
  }

  async getAdminLogs(): Promise<AdminLog[]> {
    return await db.select().from(adminLogs);
  }

  // Payment operations
  async createPaymentRecord(payment: InsertPaymentRecord): Promise<PaymentRecord> {
    const result = await db.insert(paymentRecords).values(payment).returning();
    return result[0];
  }

  async getPaymentByReference(reference: string): Promise<PaymentRecord | undefined> {
    const result = await db.select().from(paymentRecords).where(eq(paymentRecords.reference, reference)).limit(1);
    return result[0];
  }

  async updatePaymentStatus(reference: string, status: string): Promise<PaymentRecord | undefined> {
    const result = await db.update(paymentRecords)
      .set({ status, updatedAt: new Date() })
      .where(eq(paymentRecords.reference, reference))
      .returning();
    return result[0];
  }

  async getPaymentRecordsBySchool(schoolId: string): Promise<PaymentRecord[]> {
    return await db.select().from(paymentRecords).where(eq(paymentRecords.schoolId, schoolId));
  }

  async clearUserCart(userId: string): Promise<boolean> {
    const result = await db.delete(cartItems).where(eq(cartItems.userId, userId)).returning();
    return result.length > 0;
  }

  // Helper function to generate 12-digit yearbook code in XXXX-XXXX-XXXX format
  private generateYearbookCode(): string {
    const part1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const part2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const part3 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${part1}-${part2}-${part3}`;
  }

  // Yearbook code operations
  async createYearbookCodes(schoolId: string, year: number, count: number): Promise<YearbookCode[]> {
    const codes: YearbookCode[] = [];
    
    for (let i = 0; i < count; i++) {
      let code: string;
      let attempts = 0;
      
      // Generate unique code
      do {
        code = this.generateYearbookCode();
        attempts++;
        if (attempts > 100) throw new Error('Unable to generate unique code after 100 attempts');
        
        // Check if code exists in database
        const existing = await db.select().from(yearbookCodes).where(eq(yearbookCodes.code, code)).limit(1);
        if (existing.length === 0) break;
      } while (true);
      
      const result = await db.insert(yearbookCodes).values({
        schoolId,
        year,
        code,
      }).returning();
      
      codes.push(result[0]);
    }
    
    return codes;
  }

  async redeemYearbookCode(code: string, userId: string): Promise<{ success: boolean; message: string; year?: number }> {
    // Find the code
    const result = await db.select().from(yearbookCodes).where(eq(yearbookCodes.code, code)).limit(1);
    const yearbookCode = result[0];
    
    if (!yearbookCode) {
      return { success: false, message: 'Invalid code' };
    }
    
    if (yearbookCode.isUsed) {
      return { success: false, message: 'Code has already been used' };
    }
    
    // Check if user already has access to this year for this school
    const hasAccess = await this.checkUserYearbookAccess(userId, yearbookCode.schoolId, yearbookCode.year);
    if (hasAccess) {
      return { 
        success: false, 
        message: `${yearbookCode.year} yearbook is already unlocked` 
      };
    }
    
    // Mark code as used
    await db.update(yearbookCodes)
      .set({ 
        isUsed: true, 
        usedBy: userId, 
        usedAt: new Date() 
      })
      .where(eq(yearbookCodes.id, yearbookCode.id));
    
    // Create viewer year purchase record to grant access
    await db.insert(viewerYearPurchases).values({
      userId,
      schoolId: yearbookCode.schoolId,
      year: yearbookCode.year,
      purchased: true,
      price: "0.00", // Free access via code
      purchaseDate: new Date()
    });
    
    return { success: true, message: 'Code redeemed successfully', year: yearbookCode.year };
  }

  async getYearbookCodesBySchool(schoolId: string): Promise<YearbookCode[]> {
    return await db.select().from(yearbookCodes).where(eq(yearbookCodes.schoolId, schoolId));
  }

  async checkUserYearbookAccess(userId: string, schoolId: string, year: number): Promise<boolean> {
    // First check if the yearbook is free for all viewers
    const yearbook = await this.getYearbookBySchoolAndYear(schoolId, year);
    if (yearbook?.isFree) {
      return true; // Free yearbook, all logged-in users have access
    }
    
    // Check if user has purchased access to this year
    const result = await db.select().from(viewerYearPurchases).where(
      and(
        eq(viewerYearPurchases.userId, userId),
        eq(viewerYearPurchases.schoolId, schoolId),
        eq(viewerYearPurchases.year, year),
        eq(viewerYearPurchases.purchased, true)
      )
    ).limit(1);
    
    return result.length > 0;
  }

  async deleteYearbookCode(codeId: string): Promise<void> {
    await db.delete(yearbookCodes).where(eq(yearbookCodes.id, codeId));
  }

  async deleteAllYearbookCodes(schoolId: string, year: number): Promise<void> {
    await db.delete(yearbookCodes).where(
      and(
        eq(yearbookCodes.schoolId, schoolId),
        eq(yearbookCodes.year, year)
      )
    );
  }

  async getViewerPaymentHistory(userId: string): Promise<Array<ViewerYearPurchase & { schoolName: string }>> {
    const purchases = await db
      .select({
        purchase: viewerYearPurchases,
        schoolName: schools.name
      })
      .from(viewerYearPurchases)
      .leftJoin(schools, eq(viewerYearPurchases.schoolId, schools.id))
      .where(
        and(
          eq(viewerYearPurchases.userId, userId),
          isNotNull(viewerYearPurchases.paymentReference)
        )
      )
      .orderBy(desc(viewerYearPurchases.purchaseDate));

    return purchases.map(p => ({
      ...p.purchase,
      schoolName: p.schoolName || 'Unknown School'
    }));
  }

  // Helper function to generate 16-character alphanumeric code in XXXX-XXXX-XXXX-XXXX format
  private generatePublicUploadCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const part1 = Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const part2 = Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const part3 = Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const part4 = Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return `${part1}-${part2}-${part3}-${part4}`;
  }

  // Public upload link operations
  async createPublicUploadLink(linkData: { schoolId: string; year: number; category: string; expiresAt: Date; createdBy: string }): Promise<{ linkCode: string; id: string }> {
    const plainCode = this.generatePublicUploadCode();
    const hashedCode = await hashUploadCode(plainCode);

    const result = await db.insert(publicUploadLinks).values({
      schoolId: linkData.schoolId,
      year: linkData.year,
      category: linkData.category,
      linkCode: plainCode,
      hashedCode: hashedCode,
      expiresAt: linkData.expiresAt,
      createdBy: linkData.createdBy
    }).returning();

    return { linkCode: plainCode, id: result[0].id };
  }

  async getPublicUploadLinkByCode(linkCode: string): Promise<{ id: string; schoolId: string; year: number; category: string; expiresAt: Date; isActive: boolean; currentUploads: number; maxUploads: number } | undefined> {
    const allLinks = await db.select().from(publicUploadLinks);
    
    for (const link of allLinks) {
      const isMatch = await verifyUploadCode(linkCode, link.hashedCode);
      
      if (isMatch) {
        const now = new Date();
        const isExpired = now > link.expiresAt;
        
        if (isExpired) {
          return undefined;
        }
        
        return {
          id: link.id,
          schoolId: link.schoolId,
          year: link.year,
          category: link.category,
          expiresAt: link.expiresAt,
          isActive: link.isActive || true,
          currentUploads: link.currentUploads || 0,
          maxUploads: link.maxUploads || 50
        };
      }
    }
    
    return undefined;
  }

  async incrementUploadCount(linkId: string): Promise<boolean> {
    const result = await db.update(publicUploadLinks)
      .set({ currentUploads: sql`current_uploads + 1` })
      .where(eq(publicUploadLinks.id, linkId))
      .returning();
    
    return result.length > 0;
  }

  async updateMemoryStatus(memoryId: string, status: 'pending' | 'approved' | 'rejected'): Promise<Memory | undefined> {
    const result = await db.update(memories)
      .set({ status })
      .where(eq(memories.id, memoryId))
      .returning();
    
    return result[0];
  }

  async getPublicUploadLinksBySchoolAndYear(schoolId: string, year: number): Promise<PublicUploadLink[]> {
    const result = await db.select().from(publicUploadLinks).where(
      and(
        eq(publicUploadLinks.schoolId, schoolId),
        eq(publicUploadLinks.year, year)
      )
    );
    return result;
  }

  async getPublicUploadLinkById(linkId: string): Promise<PublicUploadLink | undefined> {
    const result = await db.select().from(publicUploadLinks).where(eq(publicUploadLinks.id, linkId)).limit(1);
    return result[0];
  }

  async updatePublicUploadLinkStatus(linkId: string, isActive: boolean): Promise<PublicUploadLink | undefined> {
    const result = await db.update(publicUploadLinks)
      .set({ isActive })
      .where(eq(publicUploadLinks.id, linkId))
      .returning();
    
    return result[0];
  }

  async deletePublicUploadLink(linkId: string): Promise<boolean> {
    const result = await db.delete(publicUploadLinks)
      .where(eq(publicUploadLinks.id, linkId))
      .returning();
    
    return result.length > 0;
  }

  // School gallery image operations
  async getSchoolGalleryImages(schoolId: string): Promise<SchoolGalleryImage[]> {
    const result = await db.select()
      .from(schoolGalleryImages)
      .where(and(
        eq(schoolGalleryImages.schoolId, schoolId),
        eq(schoolGalleryImages.isActive, true)
      ))
      .orderBy(schoolGalleryImages.displayOrder);
    
    return result;
  }

  async addSchoolGalleryImage(image: InsertSchoolGalleryImage): Promise<SchoolGalleryImage> {
    const result = await db.insert(schoolGalleryImages)
      .values(image)
      .returning();
    
    return result[0];
  }

  async updateSchoolGalleryImage(imageId: string, schoolId: string, updates: Partial<Pick<InsertSchoolGalleryImage, 'title' | 'description' | 'displayOrder' | 'isActive'>>): Promise<SchoolGalleryImage | undefined> {
    // Security: Only update images that belong to the specified school
    const result = await db.update(schoolGalleryImages)
      .set(updates)
      .where(and(
        eq(schoolGalleryImages.id, imageId),
        eq(schoolGalleryImages.schoolId, schoolId)
      ))
      .returning();
    
    return result[0];
  }

  async deleteSchoolGalleryImage(imageId: string, schoolId: string): Promise<boolean> {
    // Security: Only delete images that belong to the specified school
    const result = await db.delete(schoolGalleryImages)
      .where(and(
        eq(schoolGalleryImages.id, imageId),
        eq(schoolGalleryImages.schoolId, schoolId)
      ))
      .returning();
    
    return result.length > 0;
  }

  async reorderSchoolGalleryImages(schoolId: string, imageOrders: { id: string; displayOrder: number }[]): Promise<boolean> {
    try {
      for (const { id, displayOrder } of imageOrders) {
        await db.update(schoolGalleryImages)
          .set({ displayOrder })
          .where(and(
            eq(schoolGalleryImages.id, id),
            eq(schoolGalleryImages.schoolId, schoolId)
          ));
      }
      return true;
    } catch (error) {
      console.error('Error reordering school gallery images:', error);
      return false;
    }
  }

  // Login activity operations
  async createLoginActivity(activity: InsertLoginActivity): Promise<LoginActivity> {
    const result = await db.insert(loginActivity)
      .values(activity)
      .returning();
    
    return result[0];
  }

  async getLoginActivitiesByUser(userId: string, limit: number = 10): Promise<LoginActivity[]> {
    const result = await db.select()
      .from(loginActivity)
      .where(eq(loginActivity.userId, userId))
      .orderBy(sql`${loginActivity.createdAt} DESC`)
      .limit(limit);
    
    return result;
  }

  async getMostRecentLogin(userId: string): Promise<LoginActivity | undefined> {
    const result = await db.select()
      .from(loginActivity)
      .where(eq(loginActivity.userId, userId))
      .orderBy(sql`${loginActivity.createdAt} DESC`)
      .limit(1);
    
    return result[0];
  }

  // Password reset operations
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const result = await db.insert(passwordResetTokens)
      .values(token)
      .returning();
    
    return result[0];
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const result = await db.select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    
    return result[0];
  }

  async deletePasswordResetToken(tokenId: string): Promise<boolean> {
    const result = await db.delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenId))
      .returning();
    
    return result.length > 0;
  }

  async deleteExpiredPasswordResetTokens(): Promise<number> {
    const result = await db.delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < NOW()`)
      .returning();
    
    return result.length;
  }

  async createPhotoTags(memoryId: string, taggedUserIds: string[]): Promise<PhotoTag[]> {
    if (!taggedUserIds.length) return [];
    const values = taggedUserIds.map(userId => ({ memoryId, taggedUserId: userId }));
    const result = await db.insert(photoTags).values(values).returning();
    return result;
  }

  async getPhotoTagsByMemory(memoryId: string): Promise<PhotoTag[]> {
    return await db.select().from(photoTags).where(eq(photoTags.memoryId, memoryId));
  }

  async getTaggedMemoriesByUser(userId: string): Promise<Memory[]> {
    const result = await db
      .select({ memory: memories })
      .from(photoTags)
      .innerJoin(memories, eq(photoTags.memoryId, memories.id))
      .where(and(eq(photoTags.taggedUserId, userId), eq(memories.status, 'approved')));
    return result.map(r => r.memory);
  }

  async deletePhotoTagsByMemory(memoryId: string): Promise<boolean> {
    try {
      await db.delete(photoTags).where(eq(photoTags.memoryId, memoryId));
      return true;
    } catch {
      return false;
    }
  }

  async searchUsersByName(query: string): Promise<User[]> {
    if (!query || query.trim().length < 1) return [];
    const q = `%${query.trim().toLowerCase()}%`;
    return await db
      .select()
      .from(users)
      .where(
        and(
          or(
            eq(users.userType, 'viewer'),
            eq(users.userType, 'school')
          ),
          or(
            ilike(users.fullName, q),
            ilike(users.username, q)
          )
        )
      )
      .limit(10);
  }
}

export const storage = new DatabaseStorage();
