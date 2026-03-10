import 'reflect-metadata';
import 'dotenv/config';
import '@/config';

import validateEnv from '@utils/validateEnv';
import { logger } from '@utils/logger';

const main = async () => {
  validateEnv();

  // Import routes AFTER validateEnv
  const { default: App } = await import('@/app');
  const { default: AuthRoute } = await import('@routes/auth.route');
  const { default: AdminRoute } = await import('@routes/admin.route');
  const { default: AdminServicesRoute } = await import('@routes/adminServices.route');
  const { default: CurrentUserRoute } = await import('@routes/currentUser.route');
  const { default: ClientRoute } = await import('@routes/client.route');
  const { default: LoungeServicesRoute } = await import('@routes/loungeServices.route');
  const { default: ServicesRoute } = await import('@routes/services.route');
  const { default: ServiceCategoriesRoute } = await import('@routes/serviceCategories.route');
  const { default: ServiceSuggestionsRoute } = await import('@routes/serviceSuggestions.route');
  const { default: AgentRoute } = await import('@routes/agent.route');
  const { default: LoungeRoute } = await import('@routes/lounge.route');
  const { default: BookingRoute } = await import('@routes/booking.route');
  const { default: QueueRoute } = await import('@routes/queue.route');
  const { default: NotificationRoute } = await import('@routes/notification.route');
  const { default: IndexRoute } = await import('@routes/index.route');

  const app = new App([
    new IndexRoute(),
    new AuthRoute(),
    new AdminRoute(),
    new AdminServicesRoute(),
    new CurrentUserRoute(),
    new ClientRoute(),
    new LoungeServicesRoute(),
    new ServicesRoute(),
    new ServiceCategoriesRoute(),
    new ServiceSuggestionsRoute(),
    new AgentRoute(),
    new LoungeRoute(),
    new BookingRoute(),
    new QueueRoute(),
    new NotificationRoute(),
  ]);

  app.listen();

  // Initialize cron jobs (daily queue population)
  const { initializeCronJobs } = await import('@utils/cron');
  initializeCronJobs();

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
};

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
