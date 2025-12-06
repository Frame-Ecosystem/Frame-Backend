console.log('[SERVER] Starting...');

// Import reflect-metadata FIRST before any other imports
import 'reflect-metadata';

// Ensure .env is loaded as early as possible
import 'dotenv/config';

console.log('[SERVER] dotenv loaded, NODE_ENV:', process.env.NODE_ENV);

// Import config to ensure environment variables are available
import '@/config';

console.log('[SERVER] config imported');

import validateEnv from '@utils/validateEnv';
console.log('[SERVER] calling validateEnv...');
validateEnv();

console.log('[SERVER] validateEnv passed');

console.log('[SERVER] importing routes...');
import App from '@/app';
import AuthRoute from '@routes/auth.route';
import IndexRoute from '@routes/index.route';
import UsersRoute from '@routes/users.route';

console.log('[SERVER] imports done, creating app...');

try {
  const app = new App([new IndexRoute(), new UsersRoute(), new AuthRoute()]);

  console.log('[SERVER] app created, calling listen...');

  app.listen();

  console.log('[SERVER] listen called');
} catch (error) {
  console.error('[SERVER] Error during app creation:', error);
  process.exit(1);
}

// Catch any unhandled promise rejections or errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', error => {
  console.error('[SERVER] Uncaught Exception:', error);
  process.exit(1);
});
