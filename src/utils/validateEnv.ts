import { cleanEnv, port, str, bool } from 'envalid';
import { logger } from '@utils/logger';

/**
 * Validates environment variables at startup.
 * Fails fast if required variables are missing.
 */
const validateEnv = () => {
  const env = cleanEnv(process.env, {
    NODE_ENV: str({ choices: ['development', 'test', 'production'] }),
    PORT: port({ default: 3000 }),
    MONGO_URI: str({ desc: 'MongoDB connection URI (supports mongodb:// and mongodb+srv://)' }),
    SECRET_KEY: str({ desc: 'JWT secret key for access tokens' }),
    REFRESH_TOKEN_SECRET: str({ desc: 'JWT secret key for refresh tokens (must be different from SECRET_KEY)' }),
    REFRESH_TOKEN_COOKIE_DOMAIN: str({ default: '', desc: 'Optional domain for refresh token cookie, e.g. .framebeauty.tn' }),
    REFRESH_TOKEN_COOKIE_SAMESITE: str({ default: 'auto', choices: ['auto', 'strict', 'lax', 'none'] }),
    REFRESH_TOKEN_COOKIE_SECURE: str({ default: 'auto', choices: ['auto', 'true', 'false'] }),
    ENABLE_ADMIN_BOOTSTRAP: bool({ default: false, desc: 'Create default admin user at startup when missing' }),
    ADMIN_EMAIL: str({ default: '' }),
    ADMIN_PASSWORD: str({ default: '' }),
    // Image upload feature flag
    ENABLE_IMAGE_UPLOAD: bool({ default: false, desc: 'Enable image upload feature (requires Cloudflare R2 config)' }),
    // Cloudflare R2 configuration (required if ENABLE_IMAGE_UPLOAD is true)
    R2_ACCOUNT_ID: str({ default: '' }),
    R2_ACCESS_KEY_ID: str({ default: '' }),
    R2_SECRET_ACCESS_KEY: str({ default: '' }),
    R2_BUCKET_NAME: str({ default: '' }),
    R2_PUBLIC_URL: str({ default: '' }),
    // Firebase push notifications (optional — push disabled if not set)
    FIREBASE_SERVICE_ACCOUNT_PATH: str({ default: '', desc: 'Path to Firebase service account JSON file' }),
    FIREBASE_PROJECT_ID: str({ default: '', desc: 'Firebase project ID (alternative to service account file)' }),
    FIREBASE_CLIENT_EMAIL: str({ default: '', desc: 'Firebase client email (alternative to service account file)' }),
    FIREBASE_PRIVATE_KEY: str({ default: '', desc: 'Firebase private key (alternative to service account file)' }),
    // Email / SMTP configuration
    SMTP_HOST: str({ default: 'smtp-relay.brevo.com' }),
    SMTP_PORT: port({ default: 587 }),
    BREVO_SMTP_USER: str({ default: '' }),
    BREVO_SMTP_KEY: str({ default: '' }),
    SMTP_FROM: str({ default: '' }),
    FRONTEND_BASE_URL: str({ default: '' }),
    MAGIC_LINK_BASE_URL: str({ default: '' }),
  });

  const isValidAbsoluteUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  // Validate Cloudflare R2 config if image upload is enabled
  if (env.ENABLE_IMAGE_UPLOAD) {
    const r2Configured = env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME && env.R2_PUBLIC_URL;

    if (!r2Configured) {
      logger.error('❌ ENABLE_IMAGE_UPLOAD is true but Cloudflare R2 credentials are missing!');
      logger.error('   Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL');
      throw new Error('Cloudflare R2 configuration required when ENABLE_IMAGE_UPLOAD is enabled');
    }
    logger.info('✅ Cloudflare R2 configuration validated');
  }

  // Ensure access token and refresh token secrets are different
  if (env.SECRET_KEY === env.REFRESH_TOKEN_SECRET) {
    logger.error('❌ SECRET_KEY and REFRESH_TOKEN_SECRET must be different!');
    throw new Error('SECRET_KEY and REFRESH_TOKEN_SECRET must be distinct to prevent token confusion attacks');
  }

  if (env.ENABLE_ADMIN_BOOTSTRAP) {
    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
      logger.error('❌ ENABLE_ADMIN_BOOTSTRAP is true but ADMIN_EMAIL or ADMIN_PASSWORD is missing');
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required when ENABLE_ADMIN_BOOTSTRAP is enabled');
    }

    if (env.ADMIN_PASSWORD.length < 12) {
      logger.error('❌ ADMIN_PASSWORD must be at least 12 characters when ENABLE_ADMIN_BOOTSTRAP is enabled');
      throw new Error('ADMIN_PASSWORD is too weak for bootstrap admin account');
    }
  }

  if (env.NODE_ENV === 'production') {
    if (!env.BREVO_SMTP_USER || !env.BREVO_SMTP_KEY || !env.SMTP_FROM) {
      logger.error('❌ Production email is misconfigured: BREVO_SMTP_USER, BREVO_SMTP_KEY, and SMTP_FROM are required');
      throw new Error('Missing required SMTP credentials for production');
    }

    if (env.FRONTEND_BASE_URL && env.FRONTEND_BASE_URL.includes(',')) {
      logger.error('❌ FRONTEND_BASE_URL must be a single URL. Use ORIGIN for comma-separated CORS origins.');
      throw new Error('Invalid FRONTEND_BASE_URL format in production');
    }

    const linkBase = env.MAGIC_LINK_BASE_URL || env.FRONTEND_BASE_URL;
    if (!linkBase || !isValidAbsoluteUrl(linkBase)) {
      logger.error('❌ MAGIC_LINK_BASE_URL (or FRONTEND_BASE_URL fallback) must be a valid absolute http/https URL in production');
      throw new Error('Invalid magic link base URL for production');
    }
  }

  return env;
};

export default validateEnv;
