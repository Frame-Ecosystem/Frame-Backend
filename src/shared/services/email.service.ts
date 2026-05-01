import axios from 'axios';

import { logger } from '@utils/logger';

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

function normalizeRecipients(to: string | string[]): Array<{ email: string }> {
  const recipients = (Array.isArray(to) ? to : [to]).map(email => email.trim()).filter(Boolean);

  return recipients.map(email => ({ email }));
}

function parseSender(sender: string): { email: string; name?: string } {
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

function getConfiguredSender(): { email: string; name?: string } {
  const rawSender = process.env.SMTP_FROM?.trim() || 'Frame Beauty <noreply@framebeauty.com>';
  return parseSender(rawSender);
}

function getBrevoApiKey(): string {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is required');
  }

  return apiKey;
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

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<SendEmailResult> {
  const recipients = normalizeRecipients(to);
  const sender = getConfiguredSender();

  if (!recipients.length) {
    return { success: false, error: 'At least one recipient is required' };
  }

  const payload = {
    sender,
    to: recipients,
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await axios.post(BREVO_API_URL, payload, {
        headers: {
          'api-key': getBrevoApiKey(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      });

      logger.info(`[Email] Sent successfully to ${recipients.map(recipient => recipient.email).join(', ')} | ${subject}`);
      return { success: true };
    } catch (err) {
      const errorMessage = formatError(err);

      logger.error('[Email] Send failed', {
        to: recipients.map(recipient => recipient.email),
        subject,
        attempt: attempt + 1,
        message: errorMessage,
        ...(axios.isAxiosError(err)
          ? {
              status: err.response?.status,
              data: err.response?.data,
            }
          : {}),
      });

      if (attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      return { success: false, error: errorMessage };
    }
  }

  return { success: false, error: 'Email send failed after retries' };
}

export async function verifyEmailService(): Promise<void> {
  getBrevoApiKey();
  logger.info('[Email] Brevo API email service configured');
}
