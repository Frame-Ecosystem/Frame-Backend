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
  MONGO_URI,
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

/**
 * Base URL used specifically for links sent via email (magic link, password reset).
 * Always prefers the machine's LAN IP in development so a link tapped on a phone
 * on the same Wi-Fi network resolves to this server instead of the phone's own
 * localhost. In production, falls back to FRONTEND_BASE_URL.
 */
export const MAGIC_LINK_BASE_URL = process.env.MAGIC_LINK_BASE_URL || (NODE_ENV === 'production' ? FRONTEND_BASE_URL : `http://${LOCAL_IP}:2111`);

/** Feature flags */
export const ENABLE_SWAGGER = process.env.ENABLE_SWAGGER === 'true';
