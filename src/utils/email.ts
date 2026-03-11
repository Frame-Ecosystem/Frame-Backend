import nodemailer from 'nodemailer';
import disposableDomains from 'disposable-email-domains';

/**
 * Lazily-initialized reusable SMTP transporter.
 * Created once on first use instead of per-email call.
 */
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });
  }
  return transporter;
}

function getFromAddress(): string {
  return process.env.SMTP_FROM || 'noreply@yourdomain.com';
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  await getTransporter().sendMail({
    from: getFromAddress(),
    to,
    subject: 'Your Email Verification Code',
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is: <b>${code}</b></p>`,
  });
}

export async function sendMagicLinkEmail(to: string, magicLink: string): Promise<void> {
  await getTransporter().sendMail({
    from: getFromAddress(),
    to,
    subject: 'Complete your registration',
    text: `Click the link below to complete your registration:\n\n${magicLink}\n\nThis link will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome!</h2>
        <p>Click the button below to complete your registration:</p>
        <a href="${magicLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
          Complete Registration
        </a>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 10 minutes for security reasons.<br>
          If you didn't request this registration, please ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  await getTransporter().sendMail({
    from: getFromAddress(),
    to,
    subject: 'Reset your password',
    text: `Click the link below to reset your password:\n\n${resetLink}\n\nThis link will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>Click the button below to reset your password:</p>
        <a href="${resetLink}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 10 minutes for security reasons.<br>
          If you didn't request this password reset, please ignore this email.
        </p>
      </div>
    `,
  });
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.includes(domain);
}
