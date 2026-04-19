import { config } from 'dotenv';
import { networkInterfaces } from 'os';

config();
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

/** First non-internal IPv4 address on the local network, or 'localhost'. */
export const LOCAL_IP = ((): string => {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
})();

export const CREDENTIALS = process.env.CREDENTIALS === 'true';

export const {
  NODE_ENV,
  PORT,
  DB_HOST,
  DB_PORT,
  DB_DATABASE,
  SECRET_KEY,
  REFRESH_TOKEN_SECRET,
  LOG_FORMAT,
  LOG_DIR,
  ORIGIN,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} = process.env;

/** In development, uses localhost so Google OAuth allows the redirect (private IPs are rejected). */
export const GOOGLE_REDIRECT_URI = NODE_ENV === 'production' ? process.env.GOOGLE_REDIRECT_URI : `http://localhost:3000/v1/auth/google/callback`;

/** Base URL for frontend links (emails, OAuth redirects). */
export const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || process.env.GOOGLE_BASE_URL || `http://${LOCAL_IP}:3001`;
