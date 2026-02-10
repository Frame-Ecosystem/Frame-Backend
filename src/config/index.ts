import { config } from 'dotenv';

// Load base .env first (if present), then load environment specific local file to override.
config();
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

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

// Use localhost for Google OAuth in development, configured URI for production
export const GOOGLE_REDIRECT_URI = NODE_ENV === 'production' ? _GOOGLE_REDIRECT_URI : 'http://localhost:3000/v1/auth/google/callback';

// Base URL for Google OAuth redirects (frontend URL)
export const FRONTEND_BASE_URL = GOOGLE_BASE_URL || 'http://localhost:3001';
