import nodemailer from 'nodemailer';
import disposableDomains from 'disposable-email-domains';
import { FRONTEND_BASE_URL } from '@config';

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
  return process.env.SMTP_FROM || 'Frame Beauty <noreply@framebeauty.com>';
}

/* ------------------------------------------------------------------ */
/*  Brand constants                                                    */
/* ------------------------------------------------------------------ */

/** Public URL for the brand logo shown in email headers (PNG recommended, ~120px tall). */
const LOGO_URL = process.env.EMAIL_LOGO_URL || `${FRONTEND_BASE_URL}/assets/logo.png`;

/** Fallback wordmark when the logo image is blocked by the email client. */
const BRAND_NAME = 'FRAME BEAUTY';

/** Marketing site URL (footer). */
const BRAND_URL = process.env.BRAND_URL || FRONTEND_BASE_URL;

/** Support email shown in the footer. */
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@framebeauty.com';

/* ------------------------------------------------------------------ */
/*  Shared HTML layout                                                  */
/* ------------------------------------------------------------------ */

interface LayoutOptions {
  preheader: string;
  heading: string;
  intro: string;
  /** The main content block — usually a code box or CTA button. */
  contentBlock: string;
  /** Helper text shown below the content block (expiry, security note, etc.). */
  footnote?: string;
}

/**
 * Renders a modern, mobile-responsive HTML email shell.
 *
 * Design notes:
 *  - Table-based layout for Outlook / Gmail / Apple Mail compatibility
 *  - All visual styles inlined (no external stylesheets)
 *  - Brand palette: ink #0F0F10, accent #1a1a1a, soft #F5F4F1, muted #767576
 *  - Logo image loaded from CDN with text-fallback for blocked images
 *  - Responsive at 480px breakpoint via embedded <style>
 */
function renderLayout({ preheader, heading, intro, contentBlock, footnote }: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${heading}</title>
    <style>
      /* Reset */
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
      img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; height: auto; line-height: 100%; }
      body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #F5F4F1; }

      /* Mobile */
      @media only screen and (max-width: 480px) {
        .container { width: 100% !important; padding: 0 16px !important; }
        .card { padding: 32px 24px !important; }
        .heading { font-size: 24px !important; line-height: 32px !important; }
        .code-box { font-size: 32px !important; letter-spacing: 8px !important; }
        .cta-button { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F4F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <!-- Preheader (hidden inbox preview) -->
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:transparent;">
      ${preheader}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F4F1;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <!-- Brand header -->
          <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr>
              <td align="center" style="padding:0 0 28px 0;">
                <a href="${BRAND_URL}" style="text-decoration:none;color:#0F0F10;">
                  <img src="${LOGO_URL}" alt="${BRAND_NAME}" width="44" height="44" style="display:block;border-radius:10px;" />
                </a>
                <div style="margin-top:12px;font-size:13px;letter-spacing:3px;font-weight:600;color:#0F0F10;text-transform:uppercase;">
                  ${BRAND_NAME}
                </div>
              </td>
            </tr>
          </table>

          <!-- Main card -->
          <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#FFFFFF;border-radius:16px;box-shadow:0 4px 24px rgba(15,15,16,0.06);overflow:hidden;">
            <tr>
              <td class="card" style="padding:48px 48px 40px 48px;">
                <h1 class="heading" style="margin:0 0 16px 0;font-size:28px;line-height:36px;font-weight:700;color:#0F0F10;letter-spacing:-0.5px;">
                  ${heading}
                </h1>
                <p style="margin:0 0 28px 0;font-size:15px;line-height:24px;color:#3a3a3c;">
                  ${intro}
                </p>

                ${contentBlock}

                ${
                  footnote
                    ? `<p style="margin:28px 0 0 0;padding-top:24px;border-top:1px solid #EFEEEA;font-size:13px;line-height:20px;color:#767576;">${footnote}</p>`
                    : ''
                }
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr>
              <td align="center" style="padding:24px 16px 0 16px;">
                <p style="margin:0;font-size:12px;line-height:18px;color:#A1A0A2;">
                  Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:#0F0F10;text-decoration:underline;">${SUPPORT_EMAIL}</a>
                </p>
                <p style="margin:8px 0 0 0;font-size:12px;line-height:18px;color:#A1A0A2;">
                  &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Content block builders                                              */
/* ------------------------------------------------------------------ */

/** Large, letter-spaced verification code box. */
function verificationCodeBlock(code: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:8px 0 0 0;">
          <div class="code-box" style="display:inline-block;padding:24px 36px;background:linear-gradient(180deg,#FAF9F6 0%,#F5F4F1 100%);border:1px solid #EFEEEA;border-radius:12px;font-family:'SF Mono','Menlo','Consolas',monospace;font-size:38px;font-weight:700;letter-spacing:12px;color:#0F0F10;">
            ${code}
          </div>
        </td>
      </tr>
    </table>`;
}

/** Primary call-to-action button (bulletproof for Outlook). */
function ctaButtonBlock(label: string, href: string, color = '#0F0F10'): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:8px 0 0 0;">
          <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="20%" stroke="f" fillcolor="${color}">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">${label}</center>
            </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${href}" class="cta-button" style="display:inline-block;background-color:${color};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;line-height:52px;padding:0 36px;border-radius:10px;letter-spacing:0.2px;">
            ${label}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:#767576;text-align:center;">
      Or copy and paste this URL into your browser:<br/>
      <a href="${href}" style="color:#0F0F10;text-decoration:underline;word-break:break-all;">${href}</a>
    </p>`;
}

/* ------------------------------------------------------------------ */
/*  Template definitions                                                */
/* ------------------------------------------------------------------ */

interface EmailTemplate {
  subject: string;
  text: (token: string) => string;
  html: (token: string) => string;
}

const TEMPLATES: Record<string, EmailTemplate> = {
  verification: {
    subject: 'Your Frame Beauty verification code',
    text: code =>
      `Your Frame Beauty verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request it, you can safely ignore this email.\n\n— Frame Beauty`,
    html: code =>
      renderLayout({
        preheader: `Your verification code is ${code}. Expires in 10 minutes.`,
        heading: 'Verify your email',
        intro: 'Use the code below to confirm your email address and activate your Frame Beauty account.',
        contentBlock: verificationCodeBlock(code),
        footnote: 'This code will expire in 10 minutes. If you didn\u2019t request it, you can safely ignore this email.',
      }),
  },

  magicLink: {
    subject: 'Complete your Frame Beauty registration',
    text: link =>
      `Welcome to Frame Beauty!\n\nClick the link below to complete your registration:\n\n${link}\n\nThis link will expire in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\n— Frame Beauty`,
    html: link =>
      renderLayout({
        preheader: 'Tap the button to finish creating your Frame Beauty account.',
        heading: 'Welcome to Frame Beauty',
        intro: 'You\u2019re one tap away. Confirm your email to finish setting up your account and start exploring.',
        contentBlock: ctaButtonBlock('Complete Registration', link),
        footnote:
          'For your security, this link expires in 10 minutes and can only be used once. If you didn\u2019t request this, you can safely ignore this email.',
      }),
  },

  passwordReset: {
    subject: 'Reset your Frame Beauty password',
    text: link =>
      `We received a request to reset your Frame Beauty password.\n\nClick the link below to choose a new one:\n\n${link}\n\nThis link will expire in 10 minutes.\n\nIf you didn't request a password reset, you can safely ignore this email.\n\n— Frame Beauty`,
    html: link =>
      renderLayout({
        preheader: 'Tap the button to choose a new password. Link expires in 10 minutes.',
        heading: 'Reset your password',
        intro: 'We received a request to reset the password for your Frame Beauty account. Tap the button below to choose a new one.',
        contentBlock: ctaButtonBlock('Reset Password', link, '#0F0F10'),
        footnote:
          'For your security, this link expires in 10 minutes and can only be used once. If you didn\u2019t request a password reset, you can safely ignore this email \u2014 your password won\u2019t change.',
      }),
  },
};

/* ------------------------------------------------------------------ */
/*  Core send helper                                                    */
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
/*  Public API (unchanged signatures)                                   */
/* ------------------------------------------------------------------ */

export const sendVerificationEmail = (to: string, code: string) => sendEmail(to, 'verification', code);
export const sendMagicLinkEmail = (to: string, magicLink: string) => sendEmail(to, 'magicLink', magicLink);
export const sendPasswordResetEmail = (to: string, resetLink: string) => sendEmail(to, 'passwordReset', resetLink);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.includes(domain);
}

