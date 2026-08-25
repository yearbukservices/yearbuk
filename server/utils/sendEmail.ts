import { Resend } from 'resend';

function getCredentials() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Resend API key not configured. Please set RESEND_API_KEY environment variable.');
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error('Resend sender address not configured. Please set RESEND_FROM_EMAIL to a verified sender.');
  }

  return { apiKey, fromEmail };
}

function getResendClient() {
  const { apiKey, fromEmail } = getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: fromEmail
  };
}

/**
 * Send an email using Resend
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param htmlContent - HTML content of the email
 * @returns Promise that resolves when email is sent
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = getResendClient();

    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: subject,
      html: htmlContent,
    });

    if (result.error) {
      const providerError =
        result.error.message || 'Resend rejected the email request';

      console.error('❌ Resend rejected email:', {
        to,
        subject,
        error: providerError,
      });

      return {
        success: false,
        error: providerError,
      };
    }

    const emailId = result.data?.id;
    if (!emailId) {
      console.error('❌ Resend returned no email ID:', {
        to,
        subject,
      });

      return {
        success: false,
        error: 'Email provider returned no delivery ID',
      };
    }

    console.log('✅ Email sent successfully:', {
      to,
      subject,
      from: fromEmail,
      emailId,
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send email:', {
      to,
      subject,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
