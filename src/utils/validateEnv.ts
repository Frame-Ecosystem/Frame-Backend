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
    ENABLE_IMAGE_UPLOAD: bool({ default: false, desc: 'Enable image upload feature (requires Cloudinary config)' }),
    // Cloudinary configuration (required if ENABLE_IMAGE_UPLOAD is true)
    CLOUDINARY_CLOUD_NAME: str({ default: '' }),
    CLOUDINARY_API_KEY: str({ default: '' }),
    CLOUDINARY_API_SECRET: str({ default: '' }),
  });

  // Validate Cloudinary config if image upload is enabled
  if (env.ENABLE_IMAGE_UPLOAD) {
    const cloudinaryConfigured = env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET;

    if (!cloudinaryConfigured) {
      logger.error('❌ ENABLE_IMAGE_UPLOAD is true but Cloudinary credentials are missing!');
      logger.error('   Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
      throw new Error('Cloudinary configuration required when ENABLE_IMAGE_UPLOAD is enabled');
    }
    logger.info('✅ Cloudinary configuration validated');
  }

  return env;
};

export default validateEnv;
