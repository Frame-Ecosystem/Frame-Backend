import 'reflect-metadata';
import 'dotenv/config';
import '@/config';

import validateEnv from '@utils/validateEnv';
import { logger } from '@utils/logger';

const main = async () => {
  validateEnv();

  // Import routes AFTER validateEnv
  const { default: App } = await import('@/app');
  const { default: AuthRoute } = await import('@systems/AuthSystem/routes/auth.route');
  const { default: AdminRoute } = await import('@systems/AdminSystem/routes/admin.route');
  const { default: CurrentUserRoute } = await import('@systems/UserManager/routes/currentUser.route');
  const { default: ClientRoute } = await import('@systems/UserManager/routes/client.route');
  const { default: LoungeServicesRoute } = await import('@systems/ServiceCatalogSystem/routes/loungeServices.route');
  const { default: ServiceSuggestionsRoute } = await import('@systems/ServiceCatalogSystem/routes/serviceSuggestions.route');
  const { default: PublicServicesRoute } = await import('@systems/ServiceCatalogSystem/routes/publicServices.route');
  const { default: PublicServiceCategoriesRoute } = await import('@systems/ServiceCatalogSystem/routes/publicServiceCategories.route');
  const { default: AgentRoute } = await import('@systems/UserManager/routes/agent.route');
  const { default: LoungeRoute } = await import('@systems/ServiceCatalogSystem/routes/lounge.route');
  const { default: BookingRoute } = await import('@systems/BookingSystem/routes/booking.route');
  const { default: QueueRoute } = await import('@systems/BookingSystem/routes/queue.route');
  const { default: NotificationRoute } = await import('@systems/NotificationSystem/routes/notification.route');
  const { default: RatingRoute } = await import('@systems/ServiceCatalogSystem/routes/rating.route');
  const { default: LikeRoute } = await import('@systems/FeedContentSystem/routes/like.route');
  const { default: FollowRoute } = await import('@systems/UserManager/routes/follow.route');
  const { default: PostRoute } = await import('@systems/FeedContentSystem/routes/post.route');
  const { default: ReelRoute } = await import('@systems/FeedContentSystem/routes/reel.route');
  const { default: CommentRoute } = await import('@systems/FeedContentSystem/routes/comment.route');
  const { default: FeedRoute } = await import('@systems/FeedContentSystem/routes/feed.route');
  const { default: ReportRoute } = await import('@systems/FeedContentSystem/routes/report.route');
  const { default: StoreRoute } = await import('@systems/MarketplaceSystem/routes/store.route');
  const { default: ProductRoute } = await import('@systems/MarketplaceSystem/routes/product.route');
  const { default: OrderRoute } = await import('@systems/MarketplaceSystem/routes/order.route');
  const { default: CartRoute } = await import('@systems/MarketplaceSystem/routes/cart.route');
  const { default: ReviewRoute } = await import('@systems/MarketplaceSystem/routes/review.route');
  const { default: WishlistRoute } = await import('@systems/MarketplaceSystem/routes/wishlist.route');
  const { default: MarketplaceAnalyticsRoute } = await import('@systems/MarketplaceSystem/routes/analytics.route');
  const { default: IndexRoute } = await import('@systems/AdminSystem/routes/index.route');

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
    new StoreRoute(),
    new ProductRoute(),
    new OrderRoute(),
    new CartRoute(),
    new ReviewRoute(),
    new WishlistRoute(),
    new MarketplaceAnalyticsRoute(),
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
