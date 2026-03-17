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
    DB_HOST: str({ default: 'localhost' }),
    DB_PORT: str({ default: '27017' }),
    DB_DATABASE: str(),
    SECRET_KEY: str({ desc: 'JWT secret key for access tokens' }),
    REFRESH_TOKEN_SECRET: str({ desc: 'JWT secret key for refresh tokens (must be different from SECRET_KEY)' }),
    ADMIN_EMAIL: str({ default: 'admin@admin.com' }),
    ADMIN_PASSWORD: str({ default: 'Admin@123' }),
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
  });

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

  return env;
};

export default validateEnv;
