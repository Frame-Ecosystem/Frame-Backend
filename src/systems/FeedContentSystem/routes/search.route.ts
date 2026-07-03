import { Router } from 'express';
import SearchController from '@systems/FeedContentSystem/controllers/search.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { adminOrLoungeOrClientOrAgentMiddleware } from '@middlewares/role.middleware';
import { searchRateLimiter } from '@middlewares/rateLimit.middleware';

class SearchRoute implements Routes {
  public path = '/v1/search';
  public router = Router();
  private readonly controller = new SearchController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @route   GET /v1/search
     * @desc    UltraSearch — unified search across users, lounges, posts, reels,
     *          products, stores, hashtags, and services.
     * @access  Private
     * @query   q     - Search query (required)
     * @query   type  - Search type: all|users|lounges|posts|reels|products|stores|hashtags|services (default: all)
     * @rateLimit searchRateLimiter — 60 req / 15 min per user
     */
    this.router.get(
      '/',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      searchRateLimiter,
      this.controller.ultraSearch,
    );
  }
}

export default SearchRoute;
