import { config } from 'dotenv';
import { networkInterfaces } from 'os';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env';

config({ path: envFile });

const PRODUCTION_FRONTEND_BASE_URL = 'https://framebeautydemo.vercel.app';
const PRODUCTION_BACKEND_BASE_URL = 'https://frame-backend-apis.onrender.com';

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
  ENABLE_ADMIN_BOOTSTRAP,
  REFRESH_TOKEN_COOKIE_DOMAIN,
  REFRESH_TOKEN_COOKIE_SAMESITE,
  REFRESH_TOKEN_COOKIE_SECURE,
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

const localFrontendPort = process.env.LOCAL_FRONTEND_PORT || '2111';
const localFrontendBaseUrl = process.env.LOCAL_FRONTEND_BASE_URL || `http://${LOCAL_IP}:${localFrontendPort}`;
const localBackendPort = process.env.LOCAL_BACKEND_PORT || PORT || '2000';
const localBackendBaseUrl = process.env.LOCAL_BACKEND_BASE_URL || `http://${LOCAL_IP}:${localBackendPort}`;

const withLocalNetworkHost = (baseUrl: string): string => {
  try {
    const parsed = new URL(baseUrl);
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
      parsed.hostname = LOCAL_IP;
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    return baseUrl;
  }
  return baseUrl;
};

/** Base URL for backend links, callbacks, docs, and health checks. */
export const BACKEND_BASE_URL =
  NODE_ENV === 'production'
    ? process.env.BACKEND_BASE_URL || PRODUCTION_BACKEND_BASE_URL
    : withLocalNetworkHost(process.env.BACKEND_BASE_URL || localBackendBaseUrl);

/** Base URL for frontend links (emails, OAuth redirects). */
export const FRONTEND_BASE_URL =
  NODE_ENV === 'production'
    ? process.env.FRONTEND_BASE_URL || process.env.GOOGLE_BASE_URL || PRODUCTION_FRONTEND_BASE_URL
    : withLocalNetworkHost(process.env.FRONTEND_BASE_URL || process.env.GOOGLE_BASE_URL || localFrontendBaseUrl);

/** OAuth callback URL served by this backend. */
export const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${BACKEND_BASE_URL}/v1/auth/google/callback`;

/**
 * Base URL used specifically for links sent via email (magic link, password reset).
 * Always prefers the machine's LAN IP in development so a link tapped on a phone
 * on the same Wi-Fi network resolves to this server instead of the phone's own
 * localhost. In production, falls back to FRONTEND_BASE_URL.
 */
export const MAGIC_LINK_BASE_URL =
  NODE_ENV === 'production'
    ? process.env.MAGIC_LINK_BASE_URL || FRONTEND_BASE_URL
    : withLocalNetworkHost(process.env.MAGIC_LINK_BASE_URL || FRONTEND_BASE_URL);
