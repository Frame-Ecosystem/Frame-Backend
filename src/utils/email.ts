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
  return process.env.SMTP_FROM || 'noreply@framebeauty.com';
}

/* ------------------------------------------------------------------ */
/*  Template definitions                                               */
/* ------------------------------------------------------------------ */

interface EmailTemplate {
  subject: string;
  text: (token: string) => string;
  html: (token: string) => string;
}

const TEMPLATES: Record<string, EmailTemplate> = {
  verification: {
    subject: 'Frame Beauty - Your Email Verification Code',
    text: code => `Your Frame Beauty verification code is: ${code}`,
    html: code => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Frame Beauty</h2>
        <p>Your verification code is: <b>${code}</b></p>
        <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  },
  magicLink: {
    subject: 'Frame Beauty - Complete your registration',
    text: link =>
      `Welcome to Frame Beauty!\n\nClick the link below to complete your registration:\n\n${link}\n\nThis link will expire in 10 minutes.`,
    html: link => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Welcome to Frame Beauty!</h2>
        <p>Click the button below to complete your registration:</p>
        <a href="${link}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
          Complete Registration
        </a>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 10 minutes for security reasons.<br>
          If you didn't request this registration, please ignore this email.
        </p>
      </div>
    `,
  },
  passwordReset: {
    subject: 'Frame Beauty - Reset your password',
    text: link => `Click the link below to reset your Frame Beauty password:\n\n${link}\n\nThis link will expire in 10 minutes.`,
    html: link => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Frame Beauty - Password Reset</h2>
        <p>Click the button below to reset your password:</p>
        <a href="${link}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 10 minutes for security reasons.<br>
          If you didn't request this password reset, please ignore this email.
        </p>
      </div>
    `,
  },
};

/* ------------------------------------------------------------------ */
/*  Core send helper                                                   */
/* ------------------------------------------------------------------ */

async function sendEmail(to: string, templateName: keyof typeof TEMPLATES, token: string): Promise<void> {
  const tpl = TEMPLATES[templateName];
  await getTransporter().sendMail({
    from: getFromAddress(),
    to,
    subject: tpl.subject,
    text: tpl.text(token),
    html: tpl.html(token),
  });
}

/* ------------------------------------------------------------------ */
/*  Public API (unchanged signatures)                                  */
/* ------------------------------------------------------------------ */

export const sendVerificationEmail = (to: string, code: string) => sendEmail(to, 'verification', code);
export const sendMagicLinkEmail = (to: string, magicLink: string) => sendEmail(to, 'magicLink', magicLink);
export const sendPasswordResetEmail = (to: string, resetLink: string) => sendEmail(to, 'passwordReset', resetLink);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.includes(domain);
}
