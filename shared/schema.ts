import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer, boolean, date, bigint, PgTableWithColumns } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { VIEWER_YEAR_PRICE } from "./constants";

export const users: PgTableWithColumns<any> = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  userType: text("user_type").notNull(), // 'viewer', 'school', 'super_admin'
  role: text("role").notNull().default("viewer"), // 'viewer', 'super_admin' - used for access control
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"), // Optional
  lastName: text("last_name").notNull(),
  fullName: text("full_name").notNull(), // Computed from firstName + middleName + lastName
  dateOfBirth: date("date_of_birth").notNull(),
  email: text("email"),
  phoneNumber: text("phone_number"), // Format: (country code)(number)
  showPhoneToAlumni: boolean("show_phone_to_alumni").default(true), // Privacy setting for phone visibility
  preferredCurrency: text("preferred_currency").default("USD"), // User's preferred currency: USD or NGN
  profileImage: text("profile_image"),
  schoolId: varchar("school_id").references((): any => schools.id), // For school admin users
  badgeSlots: integer("badge_slots").default(4), // Number of alumni badge slots (default 4, can purchase more)
  isEmailVerified: boolean("is_email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationTokenExpiresAt: timestamp("email_verification_token_expires_at"),
  twoFactorCode: text("two_factor_code"), // Hashed 6-digit code for 2FA (super admin only)
  twoFactorCodeExpiresAt: timestamp("two_factor_code_expires_at"), // 2FA code expiry (5 minutes)
  twoFactorCodeSentAt: timestamp("two_factor_code_sent_at"), // Last time 2FA code was sent (for cooldown)
  lastUsernameChange: timestamp("last_username_change"), // Track when username was last changed (for 14-day restriction)
  createdAt: timestamp("created_at").defaultNow(),
});

export const schools: PgTableWithColumns<any> = pgTable("schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  address: text("address"),
  country: text("country").notNull(),
  state: text("state"),
  city: text("city").notNull(),
  email: text("email").notNull(),
  phoneNumber: text("phone_number").notNull(), // School phone number
  website: text("website"), // School website (optional)
  yearFounded: integer("year_founded").notNull(),
  registrationNumber: text("registration_number"), // School registration/license number
  accreditationDocument: text("accreditation_document"), // Path to uploaded accreditation document
  accreditationCloudinaryId: text("accreditation_cloudinary_id"), // Cloudinary public ID for accreditation
  logo: text("logo"), // Path to uploaded school logo (1:1 aspect ratio)
  logoCloudinaryId: text("logo_cloudinary_id"), // Cloudinary public ID for logo
  approvalStatus: text("approval_status").notNull().default("pending"), // 'pending', 'approved', 'rejected'
  isEmailVerified: boolean("is_email_verified").default(false), // Email verification status
  emailVerificationToken: text("email_verification_token"), // Token for email verification
  emailVerificationTokenExpiresAt: timestamp("email_verification_token_expires_at"), // Token expiry
  activationCode: varchar("activation_code", { length: 12 }), // Alphanumeric code for approved schools
  approvedBy: varchar("approved_by").references((): any => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  tempAdminCredentials: json("temp_admin_credentials"), // Temporary storage for admin credentials until approval
  // Paystack revenue sharing fields
  paystackSubaccountCode: text("paystack_subaccount_code"), // Paystack subaccount code for revenue sharing
  bankAccountNumber: text("bank_account_number"), // School's bank account number
  bankCode: text("bank_code"), // Bank code for the school's account
  subaccountStatus: text("subaccount_status").default("pending"), // 'pending', 'active', 'failed'
  revenueSharePercentage: integer("revenue_share_percentage").default(80), // School's share percentage (default 80%)
  lastBankAccountChange: timestamp("last_bank_account_change"), // Track when bank account was last changed (for 30-day restriction)
  lastSchoolNameChange: timestamp("last_school_name_change"), // Track when school name was last changed (for 30-day restriction)
  // School profile fields
  coverPhoto: text("cover_photo"), // Cover photo for school profile page
  coverPhotoCloudinaryId: text("cover_photo_cloudinary_id"), // Cloudinary public ID for cover photo
  motto: text("motto"), // School motto/slogan
  aboutDescription: text("about_description"), // About the school description for profile page
  createdAt: timestamp("created_at").defaultNow(),
});


export interface AlumniBadge {
  id: string;
  userId: string;        // the user this badge belongs to
  school: string;        // name of the school
  fullName: string;      // full name of the alumni
  graduationYear: string;
  admissionYear: string;
  status: "verified" | "pending";
  createdAt: Date | null;
  alumniRequestId: string | null;
  email?: string | null;        // user email
  phoneNumber?: string | null;  // user phone number
  profileImage?: string | null;  // user profile image (from join)
  showPhoneToAlumni?: boolean | null;  // whether to show phone to alumni (from join)
}

export const alumniRequests = pgTable("alumni_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  schoolId: varchar("school_id").references(() => schools.id).notNull(),
  fullName: text("full_name").notNull(),
  admissionYear: text("admission_year").notNull(),
  graduationYear: text("graduation_year").notNull(),
  postHeld: text("post_held"),
  studentName: text("student_name"),
  studentAdmissionYear: text("student_admission_year"),
  additionalInfo: text("additional_info"),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'denied'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Yearbook tables
export const yearbooks = pgTable("yearbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").references(() => schools.id).notNull(),
  year: integer("year").notNull(),
  title: text("title").notNull(),
  isPublished: boolean("is_published").default(false),
  isInitialized: boolean("is_initialized").default(false),
  isFree: boolean("is_free").default(false), // Whether yearbook is free for all viewers
  frontCoverUrl: text("front_cover_url"),
  backCoverUrl: text("back_cover_url"),
  draftFrontCoverUrl: text("draft_front_cover_url"), // Draft version of front cover
  draftBackCoverUrl: text("draft_back_cover_url"), // Draft version of back cover
  draftFrontCoverCloudinaryId: text("draft_front_cover_cloudinary_id"), // Cloudinary ID for draft front cover
  draftBackCoverCloudinaryId: text("draft_back_cover_cloudinary_id"), // Cloudinary ID for draft back cover
  orientation: text("orientation"), // 'portrait', 'landscape', null (not selected)
  uploadType: text("upload_type"), // 'image', 'pdf', null (not selected)
  detectedAspectRatio: text("detected_aspect_ratio"), // Auto-detected aspect ratio from front cover (e.g., "3/4", "9/16")
  price: text("price"), // School-set price, min: $1.99, max: $49.99 (must be set by school before publishing)
  lastPriceIncrease: timestamp("last_price_increase"), // Track when price was last increased (for 30-day cooldown)
  hasUnsavedDrafts: boolean("has_unsaved_drafts").default(false), // Track if there are unsaved draft changes
  lastDraftSaved: timestamp("last_draft_saved"), // Last time draft was manually saved
  lastAutoSaved: timestamp("last_auto_saved"), // Last time draft was auto-saved
  createdAt: timestamp("created_at").defaultNow(),
  publishedAt: timestamp("published_at"),
});

export const yearbookPriceHistory = pgTable("yearbook_price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  yearbookId: varchar("yearbook_id").references(() => yearbooks.id).notNull(),
  oldPrice: text("old_price").notNull(),
  newPrice: text("new_price").notNull(),
  changedBy: varchar("changed_by").references(() => users.id).notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
});

export const yearbookPages = pgTable("yearbook_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  yearbookId: varchar("yearbook_id").references(() => yearbooks.id).notNull(),
  pageNumber: integer("page_number").notNull(),
  draftOrder: integer("draft_order"), // Order in draft mode (can differ from pageNumber)
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  cloudinaryPublicId: text("cloudinary_public_id"), // Cloudinary public ID for transformation
  pageType: text("page_type").notNull(), // 'front_cover', 'back_cover', 'content'
  status: text("status").notNull().default("published"), // 'published', 'draft', 'draft_deleted'
  pdfUploadBatchId: varchar("pdf_upload_batch_id"), // Track pages from same PDF upload
  isDraft: boolean("is_draft").default(false), // Deprecated - use status instead
  publishedPageId: varchar("published_page_id"), // Reference to published version if this is a draft
  originalPageId: varchar("original_page_id"), // Original page ID when creating a draft edit
  createdAt: timestamp("created_at").defaultNow(),
});

export const tableOfContents = pgTable("table_of_contents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  yearbookId: varchar("yearbook_id").references(() => yearbooks.id).notNull(),
  title: text("title").notNull(),
  pageNumber: integer("page_number").notNull(),
  description: text("description"),
  isDraft: boolean("is_draft").default(false), // True if this is a draft version not yet published
  publishedTocId: varchar("published_toc_id"), // Reference to published version if this is a draft
  createdAt: timestamp("created_at").defaultNow(),
});

export const alumniBadges = pgTable("alumni_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  alumniRequestId: varchar("alumni_request_id").references(() => alumniRequests.id), // Link to alumni request for sync deletion
  school: text("school").notNull(), // name of the school
  fullName: text("full_name").notNull(), // full name of the alumni
  graduationYear: text("graduation_year").notNull(),
  admissionYear: text("admission_year").notNull(),
  status: text("status").notNull().default("pending"), // 'verified', 'pending'
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // 'alumni_approved', 'alumni_denied', 'yearbook_purchase', 'upload_approved', 'system_announcement', 'upload_code_created'
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  relatedId: varchar("related_id"), // ID of related entity (alumni request, yearbook purchase, upload, etc.)
  link: text("link"), // Direct link for the notification (e.g., '/alumni/uploads')
  uploadCode: text("upload_code"), // Upload code for upload_code_created notifications
  expiresAt: timestamp("expires_at"), // Expiration timestamp for upload codes
  createdAt: timestamp("created_at").defaultNow(),
});






export const yearPurchases = pgTable("year_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").references(() => schools.id).notNull(),
  year: integer("year").notNull(), // e.g., 2024
  purchased: boolean("purchased").default(false),
  purchaseDate: timestamp("purchase_date"),
  price: text("price"), // "14.99" or "0.00" for free
  paymentReference: text("payment_reference"), // Reference to payment record
  unlockedByAdmin: boolean("unlocked_by_admin").default(false), // True if unlocked by admin, false if purchased
  createdAt: timestamp("created_at").defaultNow(),
});

export const viewerYearPurchases = pgTable("viewer_year_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  schoolId: varchar("school_id").references(() => schools.id).notNull(),
  year: integer("year").notNull(),
  purchased: boolean("purchased").default(false),
  purchaseDate: timestamp("purchase_date"),
  price: text("price").default(VIEWER_YEAR_PRICE.toString()),
  paymentReference: text("payment_reference"), // Reference to payment record
  createdAt: timestamp("created_at").defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  itemType: text("item_type").notNull().default("yearbook"), // 'yearbook' or 'badge_slot'
  schoolId: varchar("school_id").references(() => schools.id), // Required for yearbooks, null for badge slots
  year: integer("year"), // Required for yearbooks, null for badge slots
  quantity: integer("quantity").default(1), // For badge slots (number of slots), always 1 for yearbooks
  price: text("price").default(VIEWER_YEAR_PRICE.toString()),
  orientation: text("orientation"), // 'portrait', 'landscape' - for yearbooks only
  uploadType: text("upload_type"), // 'image', 'pdf' - for yearbooks only
  addedAt: timestamp("added_at").defaultNow(),
});

export const publicUploadLinks = pgTable("public_upload_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").references(() => schools.id).notNull(),
  year: integer("year").notNull(),
  category: text("category").notNull(), // 'graduation', 'sports', 'arts', 'field_trips', 'academic'
  linkCode: varchar("link_code", { length: 19 }).notNull().unique(), // Plain text format: XXXX-XXXX-XXXX-XXXX (visible to school only)
  hashedCode: text("hashed_code").notNull(), // Bcrypt hash for secure verification
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true),
  maxUploads: integer("max_uploads").default(50), // Limit uploads per link
  currentUploads: integer("current_uploads").default(0),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memories = pgTable("memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").references(() => schools.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  cloudinaryPublicId: text("cloudinary_public_id"), // Cloudinary public ID for transformation
  mediaType: text("media_type").notNull().default('image'), // Only 'image' supported
  eventDate: text("event_date").notNull(),
  year: integer("year").notNull(), // Changed from academicYear to year
  category: text("category"), // 'graduation', 'sports', 'arts', 'field_trips', 'academic'
  tags: json("tags").$type<string[]>(),
  status: text("status").notNull().default("approved"), // 'pending', 'approved', 'rejected'
  uploadedBy: text("uploaded_by"), // For guest uploads - name of person who uploaded
  userId: varchar("user_id").references(() => users.id), // Logged-in user who uploaded (nullable)
  publicUploadLinkId: varchar("public_upload_link_id").references(() => publicUploadLinks.id), // Link to public upload if applicable
  createdAt: timestamp("created_at").defaultNow(),
});

export const alumniRequestBlocks = pgTable("alumni_request_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  schoolId: varchar("school_id").references(() => schools.id).notNull(),
  blockedUntil: timestamp("blocked_until").notNull(),
  reason: text("reason").notNull(), // 'badge_deleted'
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminLogs = pgTable("admin_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // 'deleted_school', 'approved_alumni', 'blocked_user', etc.
  targetType: text("target_type").notNull(), // 'user', 'school', 'alumni_badge'
  targetId: varchar("target_id").notNull(), // ID of the affected entity
  details: json("details").$type<Record<string, any>>(), // Additional action details
  createdAt: timestamp("created_at").defaultNow(),
});

export const paymentRecords = pgTable("payment_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reference: text("reference").notNull().unique(),
  email: text("email").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(), // Amount in kobo (smallest currency unit)
  userId: varchar("user_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'success', 'failed'
  cartItems: text("cart_items").notNull(), // JSON string of cart items
  paystackData: text("paystack_data"), // JSON string of Paystack response data
  // Revenue sharing fields
  schoolId: varchar("school_id").references(() => schools.id), // School involved in the transaction
  splitCode: text("split_code"), // Paystack split code used for revenue sharing
  platformAmount: bigint("platform_amount", { mode: "number" }), // Platform's share in kobo
  schoolAmount: bigint("school_amount", { mode: "number" }), // School's share in kobo
  splitStatus: text("split_status").default("pending"), // 'pending', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const yearbookCodes = pgTable("yearbook_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").references(() => schools.id).notNull(),
  year: integer("year").notNull(), // Academic year this code unlocks
  code: varchar("code", { length: 14 }).notNull().unique(), // 12-digit code in XXXX-XXXX-XXXX format
  isUsed: boolean("is_used").default(false),
  usedBy: varchar("used_by").references(() => users.id), // User who redeemed the code
  usedAt: timestamp("used_at"), // When the code was redeemed
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  fullName: true, // This will be computed from firstName + middleName + lastName
  isEmailVerified: true, // Set programmatically
  emailVerificationToken: true, // Set programmatically
}).extend({
  phoneNumber: z.string().regex(/^\([1-9]\d{0,3}\)\d{4,15}$/, "Phone number must be in format (country code)(number)").optional(),
});

export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
  createdAt: true,
});


export const insertMemorySchema = createInsertSchema(memories).omit({
  id: true,
  createdAt: true,
}).extend({
  category: z.enum(['graduation', 'sports', 'arts', 'field_trips', 'academic']).optional(),
  mediaType: z.literal('image'),
});

export const insertAlumniRequestSchema = createInsertSchema(alumniRequests).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});

export const insertAlumniBadgeSchema = createInsertSchema(alumniBadges).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schools.$inferSelect;
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Memory = typeof memories.$inferSelect;

export type InsertAlumniRequest = z.infer<typeof insertAlumniRequestSchema>;
export type AlumniRequest = typeof alumniRequests.$inferSelect;

export type InsertAlumniBadge = z.infer<typeof insertAlumniBadgeSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export const insertYearPurchaseSchema = createInsertSchema(yearPurchases).omit({
  id: true,
  createdAt: true,
});

export const insertViewerYearPurchaseSchema = createInsertSchema(viewerYearPurchases).omit({
  id: true,
  createdAt: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  addedAt: true,
});

export const insertAlumniRequestBlockSchema = createInsertSchema(alumniRequestBlocks).omit({
  id: true,
  createdAt: true,
});

export const insertAdminLogSchema = createInsertSchema(adminLogs).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentRecordSchema = createInsertSchema(paymentRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertYearbookCodeSchema = createInsertSchema(yearbookCodes).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export const insertPublicUploadLinkSchema = createInsertSchema(publicUploadLinks).omit({
  id: true,
  createdAt: true,
  currentUploads: true,
}).extend({
  category: z.enum(['graduation', 'sports', 'arts', 'field_trips', 'academic']),
  expiresAt: z.date(),
});

export type InsertYearPurchase = z.infer<typeof insertYearPurchaseSchema>;
export type YearPurchase = typeof yearPurchases.$inferSelect;
export type InsertViewerYearPurchase = z.infer<typeof insertViewerYearPurchaseSchema>;
export type ViewerYearPurchase = typeof viewerYearPurchases.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItem = typeof cartItems.$inferSelect;
export type InsertAlumniRequestBlock = z.infer<typeof insertAlumniRequestBlockSchema>;
export type AlumniRequestBlock = typeof alumniRequestBlocks.$inferSelect;
export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;
export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertPaymentRecord = z.infer<typeof insertPaymentRecordSchema>;
export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertYearbookCode = z.infer<typeof insertYearbookCodeSchema>;
export type YearbookCode = typeof yearbookCodes.$inferSelect;
export type InsertPublicUploadLink = z.infer<typeof insertPublicUploadLinkSchema>;
export type PublicUploadLink = typeof publicUploadLinks.$inferSelect;

// Yearbook schema exports
export const insertYearbookSchema = createInsertSchema(yearbooks).omit({
  id: true,
  createdAt: true,
  publishedAt: true,
});

export const insertYearbookPageSchema = createInsertSchema(yearbookPages).omit({
  id: true,
  createdAt: true,
});

export const insertYearbookPriceHistorySchema = createInsertSchema(yearbookPriceHistory).omit({
  id: true,
  changedAt: true,
});

export const insertTableOfContentsSchema = createInsertSchema(tableOfContents).omit({
  id: true,
  createdAt: true,
});

// School gallery images for display in the school profile gallery wheel
export const schoolGalleryImages = pgTable("school_gallery_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").references(() => schools.id).notNull(),
  imageUrl: text("image_url").notNull(),
  title: text("title"),
  description: text("description"),
  displayOrder: integer("display_order").default(0), // For ordering images in gallery
  isActive: boolean("is_active").default(true), // Allow hiding images without deleting
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSchoolGalleryImageSchema = createInsertSchema(schoolGalleryImages).omit({
  id: true,
  createdAt: true,
});

// Login activity tracking for security
export const loginActivity = pgTable("login_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"), // Browser and OS information
  deviceType: text("device_type"), // 'desktop', 'mobile', 'tablet'
  browser: text("browser"), // Browser name
  os: text("os"), // Operating system
  city: text("city"), // Approximate location city
  region: text("region"), // State/region
  country: text("country"), // Country
  loginStatus: text("login_status").notNull().default("success"), // 'success', 'failed'
  failureReason: text("failure_reason"), // Reason for failed login
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(), // Hashed token for security
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const photoTags = pgTable("photo_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memoryId: varchar("memory_id").references(() => memories.id).notNull(),
  taggedUserId: varchar("tagged_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLoginActivitySchema = createInsertSchema(loginActivity).omit({
  id: true,
  createdAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export const insertPhotoTagSchema = createInsertSchema(photoTags).omit({
  id: true,
  createdAt: true,
});

export type InsertPhotoTag = z.infer<typeof insertPhotoTagSchema>;
export type PhotoTag = typeof photoTags.$inferSelect;

export type InsertYearbook = z.infer<typeof insertYearbookSchema>;
export type Yearbook = typeof yearbooks.$inferSelect;
export type InsertYearbookPage = z.infer<typeof insertYearbookPageSchema>;
export type YearbookPage = typeof yearbookPages.$inferSelect;
export type InsertYearbookPriceHistory = z.infer<typeof insertYearbookPriceHistorySchema>;
export type YearbookPriceHistory = typeof yearbookPriceHistory.$inferSelect;
export type InsertTableOfContents = z.infer<typeof insertTableOfContentsSchema>;
export type TableOfContentsItem = typeof tableOfContents.$inferSelect;
export type InsertSchoolGalleryImage = z.infer<typeof insertSchoolGalleryImageSchema>;
export type SchoolGalleryImage = typeof schoolGalleryImages.$inferSelect;
export type InsertLoginActivity = z.infer<typeof insertLoginActivitySchema>;
export type LoginActivity = typeof loginActivity.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
