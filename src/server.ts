import 'reflect-metadata';
import 'dotenv/config';
import '@/config';

import validateEnv from '@utils/validateEnv';
import { logger } from '@utils/logger';

const main = async () => {
  validateEnv();

  // Import routes AFTER validateEnv
  const { default: App } = await import('@/app');
  const { default: AuthRoute } = await import('@routes/auth/auth.route');
  const { default: AdminRoute } = await import('@routes/admin/admin.route');
  const { default: CurrentUserRoute } = await import('@routes/user/currentUser.route');
  const { default: ClientRoute } = await import('@routes/user/client.route');
  const { default: LoungeServicesRoute } = await import('@routes/lounge/loungeServices.route');
  const { default: ServiceSuggestionsRoute } = await import('@routes/catalog/serviceSuggestions.route');
  const { default: PublicServicesRoute } = await import('@routes/catalog/publicServices.route');
  const { default: PublicServiceCategoriesRoute } = await import('@routes/catalog/publicServiceCategories.route');
  const { default: AgentRoute } = await import('@routes/user/agent.route');
  const { default: LoungeRoute } = await import('@routes/lounge/lounge.route');
  const { default: BookingRoute } = await import('@routes/booking/booking.route');
  const { default: QueueRoute } = await import('@routes/queue/queue.route');
  const { default: NotificationRoute } = await import('@routes/realtime/notification.route');
  const { default: RatingRoute } = await import('@routes/rating/rating.route');
  const { default: LikeRoute } = await import('@routes/like/like.route');
  const { default: FollowRoute } = await import('@routes/follow/follow.route');
  const { default: PostRoute } = await import('@routes/content/post.route');
  const { default: ReelRoute } = await import('@routes/content/reel.route');
  const { default: CommentRoute } = await import('@routes/content/comment.route');
  const { default: FeedRoute } = await import('@routes/content/feed.route');
  const { default: ReportRoute } = await import('@routes/content/report.route');
  const { default: IndexRoute } = await import('@routes/index.route');

  const app = new App([
    new IndexRoute(),
    new AuthRoute(),
    new AdminRoute(),
    new CurrentUserRoute(),
    new ClientRoute(),
    new LoungeServicesRoute(),
    new ServiceSuggestionsRoute(),
    new PublicServicesRoute(),
    new PublicServiceCategoriesRoute(),
    new AgentRoute(),
    new LoungeRoute(),
    new BookingRoute(),
    new QueueRoute(),
    new NotificationRoute(),
    new RatingRoute(),
    new LikeRoute(),
    new FollowRoute(),
    new PostRoute(),
    new ReelRoute(),
    new CommentRoute(),
    new FeedRoute(),
    new ReportRoute(),
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
