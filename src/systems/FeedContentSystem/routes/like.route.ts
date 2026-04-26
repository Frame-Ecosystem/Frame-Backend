import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import { clientMiddleware } from '@middlewares/role.middleware';
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
    // Client-only — toggle like/unlike for a lounge (rate-limited to prevent spam)
    this.router.post('/:loungeId', authMiddleware, clientMiddleware, csrfMiddleware, likeRateLimiter, this.likeController.toggleLike);

    // Client-only — all lounges I liked (paginated)
    this.router.get('/me', authMiddleware, clientMiddleware, this.likeController.getMyLikes);

    // Client-only — check if I liked a specific lounge
    this.router.get('/check/:loungeId', authMiddleware, clientMiddleware, this.likeController.hasLiked);

    // Auth required — clients who liked a lounge (paginated)
    this.router.get('/lounge/:loungeId', authMiddleware, this.likeController.getLoungeLikers);
  }
}

export default LikeRoute;
