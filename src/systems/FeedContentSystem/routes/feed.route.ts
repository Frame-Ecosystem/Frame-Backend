import { Router } from 'express';
import FeedController from '@systems/FeedContentSystem/controllers/feed.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { adminOrLoungeOrClientOrAgentMiddleware } from '@middlewares/role.middleware';
import { feedReadLimiter, feedDiscoveryLimiter } from '@middlewares/rateLimit.middleware';

class FeedRoute implements Routes {
  public path = '/v1/feed';
  public router = Router();
  private readonly controller = new FeedController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @route   GET /v1/feed
     * @desc    Following-based feed (posts + reels from followed users)
     * @access  Private
     * @rateLimit feedReadLimiter — 600 req / 15 min per user
     */
    this.router.get('/', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, feedReadLimiter, this.controller.getFollowingFeed);

    /**
     * @route   GET /v1/feed/explore
     * @desc    Global explore feed sorted by engagement
     * @access  Private
     * @rateLimit feedReadLimiter — 600 req / 15 min per user
     */
    this.router.get('/explore', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, feedReadLimiter, this.controller.getExploreFeed);

    /**
     * @route   GET /v1/feed/saved
     * @desc    Get user's saved/bookmarked content
     * @access  Private
     * @rateLimit feedDiscoveryLimiter — 300 req / 15 min per user
     */
    this.router.get('/saved', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, feedDiscoveryLimiter, this.controller.getSavedContent);

    /**
     * @route   GET /v1/feed/hashtag/:tag
     * @desc    Feed filtered by hashtag
     * @access  Private
     * @rateLimit feedDiscoveryLimiter — 300 req / 15 min per user
     */
    this.router.get('/hashtag/:tag', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, feedDiscoveryLimiter, this.controller.getHashtagFeed);

    /**
     * @route   GET /v1/feed/hashtags/trending
     * @desc    Trending hashtags
     * @access  Private
     * @rateLimit feedDiscoveryLimiter — 300 req / 15 min per user
     */
    this.router.get(
      '/hashtags/trending',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      feedDiscoveryLimiter,
      this.controller.getTrendingHashtags,
    );

    /**
     * @route   GET /v1/feed/hashtags/search
     * @desc    Search hashtags
     * @access  Private
     * @query   q - search term
     * @rateLimit feedDiscoveryLimiter — 300 req / 15 min per user
     */
    this.router.get('/hashtags/search', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, feedDiscoveryLimiter, this.controller.searchHashtags);
  }
}

export default FeedRoute;
