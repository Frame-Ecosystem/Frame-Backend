import { Router } from 'express';
import FeedController from '@controllers/content/feed.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { adminOrLoungeOrClientMiddleware } from '@middlewares/role.middleware';
import { generalRateLimiter } from '@middlewares/rate-limit.middleware';

class FeedRoute implements Routes {
  public path = '/v1/feed';
  public router = Router();
  private controller = new FeedController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @route   GET /v1/feed
     * @desc    Following-based feed (posts + reels from followed users)
     * @access  Private
     */
    this.router.get('/', authMiddleware, adminOrLoungeOrClientMiddleware, generalRateLimiter, this.controller.getFollowingFeed);

    /**
     * @route   GET /v1/feed/explore
     * @desc    Global explore feed sorted by engagement
     * @access  Private
     */
    this.router.get('/explore', authMiddleware, adminOrLoungeOrClientMiddleware, generalRateLimiter, this.controller.getExploreFeed);

    /**
     * @route   GET /v1/feed/saved
     * @desc    Get user's saved/bookmarked content
     * @access  Private
     */
    this.router.get('/saved', authMiddleware, adminOrLoungeOrClientMiddleware, generalRateLimiter, this.controller.getSavedContent);

    /**
     * @route   GET /v1/feed/hashtag/:tag
     * @desc    Feed filtered by hashtag
     * @access  Private
     */
    this.router.get('/hashtag/:tag', authMiddleware, adminOrLoungeOrClientMiddleware, generalRateLimiter, this.controller.getHashtagFeed);

    /**
     * @route   GET /v1/feed/hashtags/trending
     * @desc    Trending hashtags
     * @access  Private
     */
    this.router.get('/hashtags/trending', authMiddleware, adminOrLoungeOrClientMiddleware, generalRateLimiter, this.controller.getTrendingHashtags);

    /**
     * @route   GET /v1/feed/hashtags/search
     * @desc    Search hashtags
     * @access  Private
     * @query   q - search term
     */
    this.router.get('/hashtags/search', authMiddleware, adminOrLoungeOrClientMiddleware, generalRateLimiter, this.controller.searchHashtags);
  }
}

export default FeedRoute;
