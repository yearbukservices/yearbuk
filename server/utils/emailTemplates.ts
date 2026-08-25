/**
 * Liquid Glass Email Template System
 * Beautiful, modern email templates matching the Waibuk app design
 */

interface EmailButton {
  text: string;
  url: string;
  color?: 'blue' | 'green' | 'purple';
}

interface EmailTemplateOptions {
  title: string;
  preheader?: string;
  greeting?: string;
  body: string;
  button?: EmailButton;
  footer?: string;
  showLogo?: boolean;
}

/**
 * Base email template with liquid glass theme
 */
export function createEmailTemplate(options: EmailTemplateOptions): string {
  const {
    title,
    preheader = '',
    greeting = '',
    body,
    button,
    footer = 'This is an automated message, please do not reply.',
    showLogo = true
  } = options;

  const buttonHtml = button ? `
    <div style="margin: 30px 0; text-align: center;">
      <a href="${button.url}" 
         style="
           display: inline-block;
           background: ${getButtonGradient(button.color || 'blue')};
           color: white;
           padding: 14px 32px;
           text-decoration: none;
           border-radius: 12px;
           font-weight: 600;
           font-size: 16px;
           box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5), 0 8px 10px -6px rgba(59, 130, 246, 0.5);
           transition: all 0.3s ease;
         ">
        ${button.text}
      </a>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${title}</title>
      ${preheader ? `<meta name="description" content="${preheader}">` : ''}
    </head>
    <body style="
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #312e81 100%);
      min-height: 100vh;
    ">
      <!-- Email Container -->
      <div style="
        max-width: 600px;
        margin: 40px auto;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      ">
        ${showLogo ? createLogoHeader() : ''}
        
        <!-- Main Content -->
        <div style="padding: 40px 32px;">
          ${greeting ? `<p style="color: #e0e7ff; font-size: 16px; margin-bottom: 24px;">${greeting}</p>` : ''}
          
          <div style="
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 28px;
            margin: 24px 0;
          ">
            ${body}
          </div>
          
          ${buttonHtml}
        </div>
        
        <!-- Footer -->
        <div style="
          padding: 24px 32px;
          background: rgba(0, 0, 0, 0.2);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        ">
          <p style="
            color: rgba(255, 255, 255, 0.6);
            font-size: 13px;
            line-height: 1.6;
            margin: 0;
            text-align: center;
          ">
            ${footer}
          </p>
          <p style="
            color: rgba(255, 255, 255, 0.4);
            font-size: 12px;
            margin: 12px 0 0 0;
            text-align: center;
          ">
            © ${new Date().getFullYear()} Yearbuk. Where School Memories Live Forever.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function createLogoHeader(): string {
  return `
    <!-- Header with Logo -->
    <div style="
      padding: 32px 32px 24px;
      text-align: center;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <h1 style="
        color: white;
        font-size: 32px;
        font-weight: 700;
        margin: 0;
        letter-spacing: -0.5px;
      ">
        Yearbuk
      </h1>
      <p style="
        color: #93c5fd;
        font-size: 14px;
        margin: 8px 0 0 0;
        font-weight: 500;
      ">
        Where School Memories Live Forever
      </p>
    </div>
  `;
}

function getButtonGradient(color: 'blue' | 'green' | 'purple'): string {
  const gradients = {
    blue: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    green: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    purple: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
  };
  return gradients[color];
}

/**
 * Password Reset Email Template
 */
export function createPasswordResetEmail(resetLink: string): string {
  return createEmailTemplate({
    title: 'Reset Your Yearbuk Password',
    preheader: 'Reset your password to regain access to your account',
    greeting: 'Hello,',
    body: `
      <p style="color: white; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        We received a request to reset your password for your Yearbuk account.
      </p>
      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
        Click the button below to create a new password:
      </p>
    `,
    button: {
      text: 'Reset Your Password',
      url: resetLink,
      color: 'blue'
    },
    footer: `
      <strong style="color: rgba(255, 255, 255, 0.8);">Security Note:</strong><br>
      • This link will expire in 30 minutes<br>
      • If you didn't request this, you can safely ignore this email<br>
      • Your password remains secure and unchanged
    `
  });
}

/**
 * Password Changed Confirmation Email Template
 */
export function createPasswordChangedEmail(): string {
  return createEmailTemplate({
    title: 'Password Changed Successfully',
    preheader: 'Your password has been updated',
    greeting: 'Hello,',
    body: `
      <div style="text-align: center; margin: 16px 0;">
        <div style="
          display: inline-block;
          width: 56px;
          height: 56px;
          background: rgba(16, 185, 129, 0.2);
          border-radius: 50%;
          padding: 12px;
          margin-bottom: 16px;
        ">
          <div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            border-radius: 50%;
            margin: 0 auto;
          "></div>
        </div>
      </div>
      <p style="color: white; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; text-align: center;">
        <strong>Your Yearbuk password was successfully changed.</strong>
      </p>
      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0; text-align: center;">
        If you didn't make this change, please contact our support team immediately.
      </p>
    `,
    footer: 'This is a security notification. Please do not reply to this email.'
  });
}

/**
 * Account Verification Email Template
 */
export function createVerificationEmail(verificationLink: string): string {
  return createEmailTemplate({
    title: 'Verify Your Yearbuk Account',
    preheader: 'Complete your registration by verifying your email',
    greeting: 'Welcome to Yearbuk!',
    body: `
      <p style="color: white; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        Thank you for creating your account. We're excited to have you join our community of schools and alumni!
      </p>
      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0;">
        To complete your registration and start exploring yearbooks and memories, please verify your email address:
      </p>
    `,
    button: {
      text: 'Verify My Email',
      url: verificationLink,
      color: 'blue'
    },
    footer: 'This verification link will expire in 24 hours. If you didn\'t create this account, you can safely ignore this email.'
  });
}

/**
 * School Registration Verification Email Template
 */
export function createSchoolVerificationEmail(verificationLink: string, schoolName: string): string {
  return createEmailTemplate({
    title: 'Verify Your School Registration',
    preheader: 'Complete your school registration',
    greeting: `Hello from ${schoolName}!`,
    body: `
      <p style="color: white; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        Thank you for registering <strong>${schoolName}</strong> with Yearbuk!
      </p>
      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
        To complete your school registration, please verify your email address:
      </p>
      <div style="
        background: rgba(59, 130, 246, 0.1);
        border-left: 3px solid #3b82f6;
        padding: 12px 16px;
        border-radius: 8px;
        margin: 16px 0;
      ">
        <p style="color: #93c5fd; font-size: 14px; margin: 0;">
          <strong>Next Steps:</strong><br>
          1. Verify your email<br>
          2. Your registration will be reviewed by our team<br>
          3. You'll receive approval notification within 24-48 hours
        </p>
      </div>
    `,
    button: {
      text: 'Verify School Email',
      url: verificationLink,
      color: 'purple'
    }
  });
}

/**
 * School Approval Email Template
 */
export function createSchoolApprovalEmail(
  schoolName: string,
  adminUsername: string,
  adminPassword: string,
  loginUrl: string
): string {
  return createEmailTemplate({
    title: 'School Registration Approved!',
    preheader: 'Your school has been approved on Yearbuk',
    greeting: 'Congratulations!',
    body: `
      <p style="color: white; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        <strong>${schoolName}</strong> has been approved and is now active on Yearbuk!
      </p>
      <div style="
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
      ">
        <p style="color: #93c5fd; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">
          YOUR ADMIN CREDENTIALS
        </p>
        <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 16px;">
          <p style="color: white; font-size: 14px; margin: 0 0 8px 0;">
            <strong>Username:</strong> <span style="color: #60a5fa;">${adminUsername}</span>
          </p>
          <p style="color: white; font-size: 14px; margin: 0;">
            <strong>Temporary Password:</strong> <span style="color: #60a5fa;">${adminPassword}</span>
          </p>
        </div>
        <p style="color: #fbbf24; font-size: 13px; margin: 12px 0 0 0;">
          ⚠️ Please change this password immediately after your first login
        </p>
      </div>
      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 16px 0 0 0;">
        You can now log in and start managing your yearbooks and memories!
      </p>
    `,
    button: {
      text: 'Log In to Dashboard',
      url: loginUrl,
      color: 'green'
    }
  });
}

/**
 * School Registration Update/Rejection Email Template
 */
export function createSchoolRejectionEmail(
  schoolName: string,
  rejectionReason: string
): string {
  return createEmailTemplate({
    title: 'School Registration Update',
    preheader: 'Update regarding your school registration',
    greeting: 'Hello,',
    body: `
      <p style="color: white; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        Thank you for your interest in registering <strong>${schoolName}</strong> with Yearbuk.
      </p>
      <div style="
        background: rgba(239, 68, 68, 0.1);
        border-left: 3px solid #ef4444;
        padding: 16px;
        border-radius: 8px;
        margin: 20px 0;
      ">
        <p style="color: #fca5a5; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
          Registration Status: Needs Review
        </p>
        <p style="color: #fecaca; font-size: 14px; margin: 0;">
          ${rejectionReason}
        </p>
      </div>
      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0;">
        If you have any questions or would like to discuss this further, please contact our support team.
      </p>
    `,
    footer: 'We appreciate your understanding. Our team is here to help if you need assistance.'
  });
}

/**
 * Test Email Template
 */
export function createTestEmail(): string {
  return createEmailTemplate({
    title: 'Yearbuk Email System Test',
    preheader: 'Testing email delivery',
    greeting: 'Email Test Successful!',
    body: `
      <p style="color: white; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        This is a test email from Yearbuk's automated email system.
      </p>
      <div style="
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
        text-align: center;
      ">
        <p style="color: #6ee7b7; font-size: 48px; margin: 0;">✅</p>
        <p style="color: #10b981; font-size: 18px; font-weight: 600; margin: 12px 0 0 0;">
          Email System Working Perfectly!
        </p>
      </div>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
        All email templates are using the liquid glass theme
      </p>
    `,
    footer: 'This is an automated test message.'
  });
}

/**
 * Two-Factor Authentication Code Email
 */
export function createTwoFactorAuthEmail(code: string): string {
  return createEmailTemplate({
    title: 'Your Security Code - Yearbuk',
    preheader: 'Your two-factor authentication code',
    greeting: 'Security Verification Required',
    body: `
      <p style="color: white; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        A login attempt to your super admin account requires verification. Use the code below to complete your sign-in:
      </p>
      <div style="
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%);
        border: 2px solid rgba(59, 130, 246, 0.3);
        border-radius: 16px;
        padding: 30px;
        margin: 30px 0;
        text-align: center;
      ">
        <p style="color: #93c5fd; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px;">
          Verification Code
        </p>
        <p style="color: white; font-size: 48px; font-weight: 700; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">
          ${code}
        </p>
        <p style="color: #cbd5e1; font-size: 14px; margin: 16px 0 0 0;">
          Code expires in 5 minutes
        </p>
      </div>
      <div style="
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 12px;
        padding: 16px;
        margin: 20px 0;
      ">
        <p style="color: #fcd34d; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
          🔒 Security Notice
        </p>
        <p style="color: #fde68a; font-size: 13px; margin: 0; line-height: 1.5;">
          If you didn't request this code, someone may be trying to access your account. Please secure your account immediately.
        </p>
      </div>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0;">
        This code can only be used once and will expire in 5 minutes for your security.
      </p>
    `,
    footer: 'This is an automated security message. Never share your verification codes with anyone.'
  });
}
