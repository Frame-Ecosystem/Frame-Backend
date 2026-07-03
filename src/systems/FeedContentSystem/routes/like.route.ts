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
    // Auth required — toggle like/unlike for a lounge (rate-limited to prevent spam)
    this.router.post('/:loungeId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, csrfMiddleware, likeRateLimiter, this.likeController.toggleLike);

    // Auth required — all lounges I liked (paginated)
    this.router.get('/me', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.likeController.getMyLikes);

    // Auth required — check if I liked a specific lounge
    this.router.get('/check/:loungeId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.likeController.hasLiked);

    // Auth required — clients who liked a lounge (paginated)
    this.router.get('/lounge/:loungeId', authMiddleware, this.likeController.getLoungeLikers);
  }
}

export default LikeRoute;
