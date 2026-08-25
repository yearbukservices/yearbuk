## Yearbuk setup

This repository is a complete production application. Use pnpm because
`pnpm-lock.yaml` is the source of truth for dependencies.

The `Start application` workflow runs `pnpm run start:replit`, which pushes
the Drizzle schema before building and starting the server. This makes a
fresh Replit environment self-initialize after its database is provisioned.

When moving the source to another environment:
1. Upload the repository, including `pnpm-lock.yaml` and `attached_assets/`.
2. Provision a PostgreSQL database and set `DATABASE_URL`.
3. Restore the environment values listed in `env.example` using that
   environment's secrets manager. Secrets cannot be embedded in downloads.
4. Start the `Start application` workflow.

Do not create a second lockfile with npm. If dependencies are restored
manually, run `pnpm install --frozen-lockfile`.

---

# Yearbuk - Digital Yearbook Platform

## Setup Instructions for AI Agents

### Setup steps
1. Install dependencies with `pnpm install --frozen-lockfile`.
2. Provision PostgreSQL and configure `DATABASE_URL`.
3. Configure the required service values in `env.example`.
4. Start the `Start application` workflow; schema sync runs automatically.

### Complete File List (DO NOT MODIFY):
- ✅ `client/src/App.tsx` - Full routing configuration with 40+ routes
- ✅ `client/src/lib/utils.ts` - Complete with currency conversion functions
- ✅ `shared/schema.ts` - Full database schema with 15+ tables
- ✅ All 30+ page components in `client/src/pages/`
- ✅ All 50+ UI components in `client/src/components/`
- ✅ `server/routes.ts` - Complete API implementation
- ✅ `server/storage.ts` - Full database operations

---

## Overview
Yearbuk is a comprehensive digital yearbook web application designed to allow schools to create and manage yearbooks. It also provides a platform for alumni and viewers to access, purchase, and upload memories and photos, aiming to digitize and enrich the traditional yearbook experience.

## User Preferences
- **Optimization**: Minimize agent usage due to trial account limits
- **Focus**: Complete features with testing before moving to next tasks

## System Architecture

### UI/UX Decisions
- Consistent Glassmorphism design aesthetic.
- Mobile-first responsive design approach using Tailwind CSS breakpoints across key pages (e.g., signup, viewer-signup, school-signup, yearbook-viewer).
- Notification bell system with unread counts, detailed dropdowns, and auto-refresh on key management pages.
- **Custom Page Titles**: Specific browser tab titles for enhanced navigation:
  - School Settings: "Settings - Yearbuk"
  - Viewer Settings: "Settings - Yearbuk"
  - Shopping Cart: "Cart - Yearbuk"
  - Guest Upload: "Upload - Yearbuk"

### Technical Implementations
- **Frontend**: React, Wouter for routing, TanStack Query for data fetching, Tailwind CSS for styling, and shadcn/ui for UI components.
- **Backend**: Node.js with Express.
- **Database**: PostgreSQL, managed with Drizzle ORM. Schema defined in `shared/schema.ts`.
- **Authentication**: Session-based authentication using `express-session` with distinct user roles (viewer, school, super-admin). Email verification system implemented for both viewer and school registration.
- **Two-Factor Authentication (2FA)**: Enhanced security for super admin login with email-based 6-digit verification codes:
  - **Code Generation**: 6-digit codes generated and hashed using bcrypt for secure storage
  - **Expiry**: Codes expire after 5 minutes for security
  - **Smart Code Detection**: New codes only sent if no valid code exists or previous code expired (prevents duplicate codes on repeated login attempts)
  - **Cooldown**: 50-second cooldown enforced between code resend requests
  - **Email Delivery**: Codes sent to super admin email (netonwabuisi83@gmail.com) using Resend
  - **Login Tracking**: All 2FA attempts (success, failure, pending) logged in login activity
  - **Code Lifecycle**: Codes cleared after successful use; resend button invalidates old code and generates fresh one
  - **UI**: Dedicated 2FA verification page (`/two-factor-auth`) with code input, resend button, and countdown timer
- **Environment Variables**: Price constants converted to environment variables for security and flexibility:
  - `SCHOOL_YEAR_PRICE` (default: 16.99 USD)
  - `VIEWER_YEAR_PRICE` (default: 6.99 USD)
  - `BADGE_SLOT_PRICE` (default: 0.99 USD)
  - Fallback values ensure system stability if environment variables are not set
- **School Approval Workflow**: Multi-step approval process with email verification, super-admin review, and automated notifications.
- **PDF Handling**: Complete PDF-to-image conversion system for yearbook uploads:
  - **Multi-Page Extraction**: All pages automatically extracted from uploaded PDFs (not just the first page)
  - **Conversion Strategy**: Temporary public upload enables transformation, then pages re-uploaded as authenticated assets
  - **Page Storage**: Each page stored as separate authenticated image in Cloudinary (`yearbooks/{year}/page_*.jpg`)
  - **Auto-Cleanup**: Temporary PDF deleted after successful page extraction
  - **Error Handling**: Automatic cleanup of temp PDF on conversion failure
  - **Batch Tracking**: PDF uploads tracked via `pdfUploadBatchId` for organized deletion
  - **Batch Deletion**: Schools can delete entire PDF batches (all pages + source) and re-upload
  - **Cover Assignment**: Automatic front (page 1) and back (last page) cover assignment
  - **Secure URLs**: All page images use `secure_url` with authenticated access mode
  - **Security Note**: Small residual risk if process crashes before temp cleanup (consider periodic background cleanup)
- **Price Management**: UI for schools to manage yearbook pricing, including viewing history, setting prices within a valid range, and enforcing a 30-day cooldown for price increases.
- **Deployment Fixes**: Path alias resolution for TypeScript via `esbuild-plugin-path-alias` and `esbuild.config.js` to ensure consistent builds across development (Replit/Vite) and production (Render/Node.js) environments.
- **Validation**: Robust year parameter validation to prevent database errors from invalid inputs.
- **Yearbook Security**: Comprehensive anti-download protection system to prevent unauthorized image saving:
  - **Backend Security**: All yearbook images served through protected routes (`/api/secure-image/yearbooks/*`) with authentication and purchase verification
  - **Permission Checks**: Multi-layered authorization (super-admin access, school ownership, viewer purchase verification)
  - **Frontend Protection**: Global event listeners blocking right-click, long-press (iOS/Android), and drag-and-drop on yearbook images
  - **CSS Anti-Download**: Classes `.protected-image` and `.yearbook-page-image` with disabled pointer events, user-select, and touch-callout
  - **Alternative Rendering**: `YearbookPageImage` component supports background-image mode for enhanced security vs traditional `<img>` tags
  - **Global Component**: `YearbookProtection` component in App.tsx provides app-wide event listener coverage
- **Cloudinary Upload Organization**: Structured folder management for all school assets:
  - **Folder Structure**: `yearbuk_uploads/{schoolName}_{schoolCode}/{category}/{year}/`
  - **Categories**: yearbooks, memories, logo, accreditation
  - **Name Sanitization**: School names sanitized (spaces and special characters removed) for clean folder paths
  - **Examples**: 
    - `yearbuk_uploads/BrightFutureHighSchool_ABC123/yearbooks/2025/page1.png`
    - `yearbuk_uploads/BrightFutureHighSchool_ABC123/memories/2024/memory1.jpg`
    - `yearbuk_uploads/BrightFutureHighSchool_ABC123/logo/school_logo.png`
  - **Backward Compatibility**: Existing uploads remain functional; new structure applies only to new uploads
  - **Auto-Cleanup**: When a school is deleted, all associated Cloudinary assets are automatically removed asynchronously
  - **Super Admin Visibility**: Cloudinary folder paths displayed in Super Admin dashboard for transparency and verification
- **Dynamic Watermarking**: Cloudinary-powered watermarking for viewer accounts:
  - **Viewer-Only Watermarks**: "© Yearbuk" watermark applied dynamically to yearbook images for viewer accounts
  - **School/Admin Access**: School administrators and super-admins see original unwatermarked images
  - **Server-Side Processing**: Watermarks applied via Cloudinary transformations; original files never modified
  - **Transformation Details**: Semi-transparent white text, bottom-right corner, 24px Arial Bold font
- **Authenticated Cloudinary Access** (Implemented October 2025):
  - **Upload Security**: All new yearbook pages uploaded with `type: 'authenticated'` mode to Cloudinary
  - **Signed URLs**: Server generates time-limited signed URLs (1-hour expiry) for all yearbook image access
  - **URL Expiration**: Signed URLs automatically expire after 1 hour, preventing long-term unauthorized access
  - **Watermark Integration**: Signed URLs include URL-encoded watermark transformations for viewer accounts, original for school/admin
  - **Backward Compatibility**: Existing public uploads continue to work; new security applies to all future uploads
  - **No Client Changes**: Frontend unchanged - authenticated access is handled entirely server-side
  - **Re-upload Note**: For maximum security, schools can re-upload existing yearbooks to apply authenticated access
  - **Canvas CORS**: Added `crossOrigin="anonymous"` to yearbook photo selection for proper canvas rendering with CORS-enabled images
  - **Known Limitation**: PDF conversion process requires temporary public access for Cloudinary transformations; temp files are deleted immediately after conversion completes

### Feature Specifications
- **Core Functionality**: Yearbook creation, management, viewing, purchasing, and memory/photo uploads.
- **User Management**: Email verification flow for new registrations, with token expiration and resend functionality.
- **School Management**: Complete school approval workflow with the following steps:
  1. School registers with admin credentials (stored temporarily)
  2. School receives email verification link (24-hour expiry)
  3. After email verification, super-admin receives notification
  4. Super-admin can approve or reject with password confirmation
  5. Approved schools receive login credentials via email
  6. Rejected schools receive rejection email with reason
  7. Schools can only log in after email verification and approval
- **Public Uploads**: Guest upload functionality via `/memory-upload` or direct links (`/upload/:code`), protected by Google reCAPTCHA v2 (checkbox) verification for guest users. Logged-in users bypass reCAPTCHA verification.
- **Alumni Upload Code Notifications**: Automatic notification system for verified alumni when schools create upload codes:
  - **Auto-Notification**: When a school creates an upload code, all verified alumni for that graduation year automatically receive a notification
  - **Notification UI**: Special notification display with upload code (copy button), live expiry countdown timer, and school/year details
  - **Auto-Cleanup**: Background job runs every 30 minutes to remove expired upload code notifications
  - **Auto-Delete**: Notifications are automatically deleted when schools remove upload codes
  - **Database Fields**: Added `uploadCode`, `expiresAt`, and `link` fields to notifications table for upload code tracking

### System Design Choices
- In-memory storage (`MemStorage` in `server/storage.ts`) is used for all CRUD operations, abstracting data persistence details.
- Deployment is targeted for Render, with specific build and start commands, and environment variable configurations.

## External Dependencies
- **Database**: PostgreSQL (Neon-backed).
- **Email Service**: Resend API for sending verification, password reset, and notification emails. Supports sandbox mode for testing without domain verification.
- **Session Management**: `express-session` for server-side sessions.
- **Google reCAPTCHA**: Integrated reCAPTCHA v2 (checkbox) for guest upload verification. Requires RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY environment variables.

## Email Configuration (Resend)
- Configure `RESEND_API_KEY` in the environment's secrets manager.
- Configure `RESEND_FROM_EMAIL` with a sender on a verified Resend domain.
- Sandbox mode is not used; all account, reset-password, notification, and
  two-factor emails use the configured production sender.

**Test Accounts** (Pre-verified):
- Test school account: `test_school` (email verified by default)
- Test viewer account: `test_viewer` (email verified by default)
