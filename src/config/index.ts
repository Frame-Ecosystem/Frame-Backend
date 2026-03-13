import { config } from 'dotenv';
import os from 'os';

// Load base .env first (if present), then load environment specific local file to override.
config();
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

/** Resolve the first non-internal IPv4 address (WiFi / Ethernet). */
function getLocalIp(): string {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

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
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: _GOOGLE_REDIRECT_URI,
  GOOGLE_BASE_URL,
} = process.env;

// Use local network IP for Google OAuth in development so it works from other devices
export const GOOGLE_REDIRECT_URI = NODE_ENV === 'production' ? _GOOGLE_REDIRECT_URI : `http://${getLocalIp()}:3000/v1/auth/google/callback`;

// Base URL for frontend links (emails, OAuth redirects).
// In development falls back to the local network IP so links work from other devices.
export const FRONTEND_BASE_URL = GOOGLE_BASE_URL || `http://${getLocalIp()}:3001`;
