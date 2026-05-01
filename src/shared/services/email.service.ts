import axios from 'axios';
import nodemailer from 'nodemailer';

import { logger } from '@utils/logger';

type EmailRecipient = { email: string };
type EmailSender = { email: string; name?: string };

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [500, 1_000];

function normalizeRecipients(to: string | string[]): EmailRecipient[] {
  const recipients = (Array.isArray(to) ? to : [to]).map(email => email.trim()).filter(Boolean);

  return recipients.map(email => ({ email }));
}

function parseSender(sender: string): EmailSender {
  const match = sender.match(/^(.*?)<([^>]+)>$/);
  if (!match) {
    return { email: sender.trim() };
  }

  const name = match[1].trim().replace(/^"|"$/g, '');
  const email = match[2].trim();

  return {
    email,
    ...(name ? { name } : {}),
  };
}

function getConfiguredSender(): EmailSender {
  const rawSender = process.env.SMTP_FROM?.trim() || 'Frame Beauty <noreply@framebeauty.com>';
  return parseSender(rawSender);
}

function getBrevoApiKey(): string | null {
  return process.env.BREVO_API_KEY?.trim() || null;
}

function formatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const apiMessage = typeof err.response?.data === 'string' ? err.response.data : JSON.stringify(err.response?.data);
    return apiMessage || err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'Unknown email error';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getSmtpConfig(): { host: string; port: number; user: string; pass: string; from?: string } {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT?.trim() || '587', 10);
  const user = process.env.BREVO_SMTP_USER?.trim();
  const pass = process.env.BREVO_SMTP_KEY?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration (SMTP_HOST, BREVO_SMTP_USER, BREVO_SMTP_KEY) is incomplete');
  }

  return { host, port, user, pass, ...(from ? { from } : {}) };
}

async function sendViaBrevoApi(recipients: EmailRecipient[], sender: EmailSender, subject: string, html: string, text?: string): Promise<void> {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const payload = {
    sender,
    to: recipients,
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
  };

  await axios.post(BREVO_API_URL, payload, {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: REQUEST_TIMEOUT_MS,
  });
}

async function sendViaSmtp(recipients: EmailRecipient[], sender: EmailSender, subject: string, html: string, text?: string): Promise<void> {
  const smtp = getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const senderString = sender.name ? `"${sender.name}" <${sender.email}>` : sender.email;

  await transporter.sendMail({
    from: smtp.from || senderString,
    to: recipients.map(r => r.email).join(', '),
    subject,
    html,
    ...(text ? { text } : {}),
  });
}

async function tryBrevoApiWithRetries(
  recipients: EmailRecipient[],
  sender: EmailSender,
  subject: string,
  html: string,
  text: string | undefined,
  recipientList: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const apiKey = getBrevoApiKey();

  if (!apiKey) {
    const message = 'BREVO_API_KEY not configured';
    logger.warn('[Email] BREVO_API_KEY not configured, skipping Brevo API and using SMTP fallback');
    return { success: false, error: message };
  }

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await sendViaBrevoApi(recipients, sender, subject, html, text);
      logger.info(`[Email] Sent via Brevo API to ${recipientList} | ${subject}`);
      return { success: true };
    } catch (err) {
      const errorMessage = formatError(err);
      logger.warn('[Email] Brevo API attempt failed', {
        to: recipientList,
        subject,
        attempt: attempt + 1,
        message: errorMessage,
      });

      if (attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      logger.error(`[Email] Brevo API failed after ${RETRY_DELAYS_MS.length + 1} attempts, falling back to SMTP`);
      return { success: false, error: errorMessage };
    }
  }

  return { success: false, error: 'Brevo API retries exhausted' };
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<SendEmailResult> {
  const recipients = normalizeRecipients(to);
  const sender = getConfiguredSender();
  const recipientList = recipients.map(r => r.email).join(', ');

  if (!recipients.length) {
    return { success: false, error: 'At least one recipient is required' };
  }

  const brevoResult = await tryBrevoApiWithRetries(recipients, sender, subject, html, text, recipientList);
  if (brevoResult.success) {
    return { success: true };
  }
  const brevoError = 'error' in brevoResult ? brevoResult.error : 'Unknown Brevo failure';

  try {
    await sendViaSmtp(recipients, sender, subject, html, text);
    logger.info(`[Email] Sent via SMTP fallback to ${recipientList} | ${subject}`);
    return { success: true };
  } catch (err) {
    const errorMessage = formatError(err);
    logger.error('[Email] SMTP fallback also failed', { to: recipientList, subject, message: errorMessage });
    return {
      success: false,
      error: `Brevo API failed (${brevoError}). SMTP fallback failed (${errorMessage}).`,
    };
  }
}

export async function verifyEmailService(): Promise<void> {
  const apiKey = getBrevoApiKey();
  if (apiKey) {
    logger.info('[Email] Brevo API email service configured');
  } else {
    logger.warn('[Email] BREVO_API_KEY not set — will use SMTP only');
  }
}
