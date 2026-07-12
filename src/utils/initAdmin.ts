import userModel from '@systems/UserManager/models/user.model';
import likeModel from '@systems/FeedContentSystem/models/like.model';
import ratingModel from '@systems/ServiceCatalogSystem/models/rating.model';
import { hash } from 'bcrypt';
import { BCRYPT_ROUNDS } from '@config/constants';
import { logger } from '@utils/logger';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ENABLE_ADMIN_BOOTSTRAP } from '@config';

// Admin defaults
const ADMIN_PHONE = process.env.ADMIN_PHONE || '';

/**
 * Ensure collections and indexes exist in MongoDB.
 * syncIndexes() drops stale indexes not in the current schema and creates new ones.
 * This prevents duplicate-key crashes after field renames (e.g. clientId→likerId).
 */
export async function ensureCollectionExists(): Promise<void> {
  try {
    logger.info('ensureCollectionExists: ensuring collections and indexes exist');
    await Promise.all([
      userModel.syncIndexes(),
      likeModel.syncIndexes(),
      ratingModel.syncIndexes(),
    ]);
    logger.info('ensureCollectionExists: all collections and indexes are ready');
  } catch (error) {
    logger.error(`ensureCollectionExists: failed to ensure collection: ${error?.message || error}`);
    throw error;
  }
}

/**
 * Ensure an admin user exists. If not present, create one using env vars or defaults.
 * - Environment variables (optional): ADMIN_EMAIL, ADMIN_PASSWORD
 */
export async function ensureAdminExists(): Promise<void> {
  try {
    if (ENABLE_ADMIN_BOOTSTRAP !== 'true') {
      logger.info('ensureAdminExists: skipped (ENABLE_ADMIN_BOOTSTRAP is disabled)');
      return;
    }

    logger.info('ensureAdminExists: starting check for admin user');

    // Use count for a precise check and diagnostics
    const adminCount = await userModel.countDocuments({ type: 'admin' });
    logger.info(`ensureAdminExists: admin user count = ${adminCount}`);
    if (adminCount > 0) {
      const existing = await userModel.findOne({ type: 'admin' }).lean();
      logger.info(`ensureAdminExists: admin exists (id=${existing?._id}, email=${existing?.email})`);
      return;
    }

    const adminEmail = ADMIN_EMAIL;
    const adminPassword = ADMIN_PASSWORD;

    logger.info(`ensureAdminExists: using ADMIN_EMAIL=${adminEmail}; ADMIN_PASSWORD set=${!!ADMIN_PASSWORD}`);

    const hashed = await hash(adminPassword, BCRYPT_ROUNDS);

    try {
      const created = await userModel.create({
        email: adminEmail,
        password: hashed,
        type: 'admin',
        phoneNumber: ADMIN_PHONE,
        sessionTrack: {
          isOnline: false,
          devices: [],
        },
        emailVerification: [{ isVerified: true }], // Admin is pre-verified
      });
      logger.info(`Default admin user created: ${adminEmail} (id=${created._id})`);
    } catch (createErr: any) {
      // If creation fails, provide diagnostics
      logger.error(`ensureAdminExists: failed to create admin: ${createErr?.message || createErr}`);
      if (createErr.code === 11000) {
        // Duplicate key error — show conflicting document (by email)
        logger.warn('ensureAdminExists: duplicate key error when creating admin. Attempting to locate conflicting document...');
        try {
          const conflict = await userModel.findOne({ email: adminEmail }).lean();
          if (conflict) {
            logger.warn(`ensureAdminExists: found document with same email: id=${conflict._id}, type=${(conflict as any).type}`);
          } else {
            logger.warn('ensureAdminExists: no document found with the admin email despite duplicate key error. Index inconsistency may exist.');
          }
        } catch (confErr) {
          logger.error(`ensureAdminExists: error while locating conflicting document: ${confErr?.message || confErr}`);
        }
      }

      throw createErr;
    }
  } catch (error) {
    logger.error(`Failed to ensure admin user exists: ${error?.message || error}`);
    throw error;
  }
}
