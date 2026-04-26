import { Router } from 'express';
import ReelController from '@systems/FeedContentSystem/controllers/reel.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import { adminOrLoungeOrClientOrAgentMiddleware, adminMiddleware } from '@middlewares/role.middleware';
import { uploadReelMedia } from '@middlewares/contentUpload.middleware';
import { contentCreateRateLimiter, likeRateLimiter, generalRateLimiter } from '@middlewares/rateLimit.middleware';

class ReelRoute implements Routes {
  public path = '/v1/reels';
  public router = Router();
  private controller = new ReelController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @route   POST /v1/reels
     * @desc    Create a new reel (video + optional thumbnail)
     * @access  Private (Client or Lounge)
     */
    this.router.post(
      '/',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      csrfMiddleware,
      contentCreateRateLimiter,
      uploadReelMedia,
      this.controller.createReel,
    );

    /**
     * @route   GET /v1/reels/user/:userId
     * @desc    Get reels by a specific user
     * @access  Private
     */
    this.router.get('/user/:userId', authMiddleware, generalRateLimiter, this.controller.getUserReels);

    /**
     * @route   GET /v1/reels/:reelId
     * @desc    Get a single reel
     * @access  Private
     */
    this.router.get('/:reelId', authMiddleware, generalRateLimiter, this.controller.getReel);

    /**
     * @route   PUT /v1/reels/:reelId
     * @desc    Update a reel (caption, hashtags)
     * @access  Private (owner only)
     */
    this.router.put('/:reelId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, csrfMiddleware, generalRateLimiter, this.controller.updateReel);

    /**
     * @route   DELETE /v1/reels/:reelId
     * @desc    Delete own reel
     * @access  Private (owner only)
     */
    this.router.delete('/:reelId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, csrfMiddleware, this.controller.deleteReel);

    /**
     * @route   POST /v1/reels/:reelId/like
     * @desc    Like or unlike a reel
     * @access  Private
     */
    this.router.post('/:reelId/like', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, csrfMiddleware, likeRateLimiter, this.controller.toggleLike);

    /**
     * @route   POST /v1/reels/:reelId/save
     * @desc    Save or unsave a reel
     * @access  Private
     */
    this.router.post('/:reelId/save', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, csrfMiddleware, likeRateLimiter, this.controller.toggleSave);

    /* ───────── Admin routes ───────── */

    /**
     * @route   PUT /v1/reels/:reelId/hide
     * @desc    Hide a reel (admin moderation)
     * @access  Admin only
     */
    this.router.put('/:reelId/hide', authMiddleware, adminMiddleware, csrfMiddleware, this.controller.hideReel);

    /**
     * @route   PUT /v1/reels/:reelId/unhide
     * @desc    Unhide a reel (admin moderation)
     * @access  Admin only
     */
    this.router.put('/:reelId/unhide', authMiddleware, adminMiddleware, csrfMiddleware, this.controller.unhideReel);

    /**
     * @route   DELETE /v1/reels/:reelId/admin
     * @desc    Admin force delete a reel
     * @access  Admin only
     */
    this.router.delete('/:reelId/admin', authMiddleware, adminMiddleware, csrfMiddleware, this.controller.adminDeleteReel);
  }
}

export default ReelRoute;
