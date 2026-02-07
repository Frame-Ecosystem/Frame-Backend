import userModel from '@models/users.model';
import { hash } from 'bcrypt';
import { BCRYPT_ROUNDS } from '../config/constants';
import { logger } from '@utils/logger';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '@config';

// Admin defaults
const ADMIN_PHONE = process.env.ADMIN_PHONE || '50922140';

/**
 * Ensure the users collection and indexes exist in MongoDB.
 * This forces Mongoose to create the schema upfront so it appears in Compass.
 */
export async function ensureCollectionExists(): Promise<void> {
  try {
    logger.info('ensureCollectionExists: ensuring users collection exists');
    // Calling syncIndexes() creates the collection and indexes if they don't exist
    await userModel.syncIndexes();
    logger.info('ensureCollectionExists: users collection and indexes are ready');
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
    logger.info('ensureAdminExists: starting check for admin user');

    // Use count for a precise check and diagnostics
    const adminCount = await userModel.countDocuments({ type: 'admin' });
    logger.info(`ensureAdminExists: admin user count = ${adminCount}`);
    if (adminCount > 0) {
      const existing = await userModel.findOne({ type: 'admin' }).lean();
      logger.info(`ensureAdminExists: admin exists (id=${existing?._id}, email=${existing?.email})`);
      return;
    }

    const adminEmail = ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    const adminPassword = ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

    logger.info(`ensureAdminExists: using ADMIN_EMAIL=${adminEmail}; ADMIN_PASSWORD set=${!!(ADMIN_PASSWORD || process.env.ADMIN_PASSWORD)}`);

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
