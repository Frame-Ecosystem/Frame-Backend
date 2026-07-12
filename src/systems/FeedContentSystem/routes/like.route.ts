import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import { adminOrLoungeOrClientOrAgentMiddleware } from '@middlewares/role.middleware';
import { likeRateLimiter } from '@middlewares/rateLimit.middleware';
import LikeController from '@systems/FeedContentSystem/controllers/like.controller';

class LikeRoute implements Routes {
  public path = '/v1/likes';
  public router = Router();
  public likeController = new LikeController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @route   POST /v1/likes/:targetId
     * @desc    Toggle like/unlike for a target user (lounge or agent)
     * @access  Private (Client, Lounge, or Agent) — rate-limited
     */
    this.router.post('/:targetId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, csrfMiddleware, likeRateLimiter, this.likeController.toggleLike);

    /**
     * @route   GET /v1/likes/me
     * @desc    All targets liked by the authenticated user (paginated)
     * @access  Private (Client, Lounge, or Agent)
     */
    this.router.get('/me', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.likeController.getMyLikes);

    /**
     * @route   GET /v1/likes/check/:targetId
     * @desc    Check if the authenticated user has liked a specific target
     * @access  Private (Client, Lounge, or Agent)
     */
    this.router.get('/check/:targetId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.likeController.hasLiked);

    /**
     * @route   GET /v1/likes/target/:targetId
     * @desc    Users who liked a specific target (paginated)
     * @access  Private (all authenticated users)
     */
    this.router.get('/target/:targetId', authMiddleware, this.likeController.getTargetLikers);
  }
}

export default LikeRoute;
