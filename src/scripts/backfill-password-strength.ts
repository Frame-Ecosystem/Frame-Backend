/**
 * One-time migration script: backfill passwordStrength for existing users.
 *
 * All existing users (created under the old strict password policy) are set to
 * passwordStrength = 'medium' as a conservative default per product decision.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-password-strength.ts
 *   — or if ts-node is not available —
 *   npx tsx src/scripts/backfill-password-strength.ts
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables (mirrors src/config/index.ts logic)
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env';
config({ path: envFile });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is not set. Aborting.');
  process.exit(1);
}

async function run() {
  console.log(`Connecting to MongoDB (${nodeEnv})...`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const usersCollection = mongoose.connection.db!.collection('users');

  const result = await usersCollection.updateMany(
    { passwordStrength: { $exists: false } },
    { $set: { passwordStrength: 'medium' } },
  );

  console.log(`Migration complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
