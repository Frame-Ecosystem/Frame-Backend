import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import { adminOrLoungeOrClientOrAgentMiddleware } from '@middlewares/role.middleware';
import { followRateLimiter } from '@middlewares/rateLimit.middleware';
import FollowController from '@systems/UserManager/controllers/follow.controller';

class FollowRoute implements Routes {
  public path = '/v1/follows';
  public router = Router();
  public followController = new FollowController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @route   POST /v1/follows/:targetId
     * @desc    Follow a user (client or lounge)
     * @access  Private (Client or Lounge) � rate-limited
     */
    this.router.post('/:targetId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, csrfMiddleware, followRateLimiter, this.followController.follow);

    /**
     * @route   DELETE /v1/follows/:targetId
     * @desc    Unfollow a user
     * @access  Private (Client or Lounge)
     */
    this.router.delete('/:targetId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, csrfMiddleware, this.followController.unfollow);

    /**
     * @route   GET /v1/follows/check/:targetId
     * @desc    Check if current user follows target
     * @access  Private (Client or Lounge)
     */
    this.router.get('/check/:targetId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.followController.isFollowing);

    /**
     * @route   GET /v1/follows/following/:userId
     * @desc    Get list of users that :userId is following (paginated)
     * @access  Private (Client, Lounge, or Admin)
     * @query   page, limit, type (optional: 'client' | 'lounge')
     */
    this.router.get('/following/:userId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.followController.getFollowing);

    /**
     * @route   GET /v1/follows/followers/:userId
     * @desc    Get followers of :userId (paginated)
     * @access  Private (Client, Lounge, or Admin)
     * @query   page, limit, type (optional: 'client' | 'lounge')
     */
    this.router.get('/followers/:userId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.followController.getFollowers);

    /**
     * @route   GET /v1/follows/counts/:userId
     * @desc    Get follower + following counts for a user
     * @access  Private (Client, Lounge, or Admin)
     */
    this.router.get('/counts/:userId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.followController.getCounts);
  }
}

export default FollowRoute;
