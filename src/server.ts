import 'reflect-metadata';
import 'dotenv/config';
import '@/config';

import validateEnv from '@utils/validateEnv';
import { logger } from '@utils/logger';

validateEnv();

import App from '@/app';
import AuthRoute from '@routes/auth.route';
import AdminRoute from '@routes/admin.route';
import CurrentUserRoute from '@routes/currentUser.route';
import IndexRoute from '@routes/index.route';

const app = new App([new IndexRoute(), new AuthRoute(), new AdminRoute(), new CurrentUserRoute()]);

app.listen();

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  try {
    await app.closeDatabaseConnection();
    logger.info('Database connection closed.');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch any unhandled promise rejections or errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
