import { Router } from 'express';
import CommentController from '@systems/FeedContentSystem/controllers/comment.controller';
import { Routes } from '@interfaces/routes.interface';
import { adminOrLoungeOrClientOrAgentMiddleware, adminMiddleware } from '@middlewares/role.middleware';
import { commentRateLimiter, likeRateLimiter, generalRateLimiter } from '@middlewares/rateLimit.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { CreateCommentDto } from '@systems/FeedContentSystem/dtos/comment.dto';
import authMiddleware from '@middlewares/auth.middleware';

class CommentRoute implements Routes {
  public path = '/v1/comments';
  public router = Router();
  private controller = new CommentController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /* ───────── Specific routes MUST come before generic /:targetType/:targetId ───────── */

    /**
     * @route   GET /v1/comments/:commentId/replies
     * @desc    List replies to a comment
     * @access  Private
     */
    this.router.get('/:commentId/replies', authMiddleware, generalRateLimiter, this.controller.getReplies);

    /**
     * @route   POST /v1/comments/:commentId/like
     * @desc    Like or unlike a comment
     * @access  Private
     */
    this.router.post('/:commentId/like', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, likeRateLimiter, this.controller.toggleLike);

    /**
     * @route   PUT /v1/comments/:commentId/hide
     * @desc    Hide a comment (admin moderation)
     * @access  Admin only
     */
    this.router.put('/:commentId/hide', authMiddleware, adminMiddleware, this.controller.hideComment);

    /**
     * @route   PUT /v1/comments/:commentId/unhide
     * @desc    Unhide a comment (admin moderation)
     * @access  Admin only
     */
    this.router.put('/:commentId/unhide', authMiddleware, adminMiddleware, this.controller.unhideComment);

    /**
     * @route   DELETE /v1/comments/:commentId/admin
     * @desc    Admin force delete a comment
     * @access  Admin only
     */
    this.router.delete('/:commentId/admin', authMiddleware, adminMiddleware, this.controller.adminDeleteComment);

    /**
     * @route   DELETE /v1/comments/:commentId
     * @desc    Delete own comment
     * @access  Private (owner only)
     */
    this.router.delete('/:commentId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.controller.deleteComment);

    /* ───────── Generic two-param routes LAST ───────── */

    /**
     * @route   POST /v1/comments/:targetType/:targetId
     * @desc    Add a comment (or reply) to a post or reel
     * @access  Private
     * @param   targetType - 'post' | 'reel'
     */
    this.router.post(
      '/:targetType/:targetId',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      commentRateLimiter,
      validationMiddleware(CreateCommentDto, 'body'),
      this.controller.addComment,
    );

    /**
     * @route   GET /v1/comments/:targetType/:targetId
     * @desc    List top-level comments for a post or reel
     * @access  Private
     */
    this.router.get('/:targetType/:targetId', authMiddleware, generalRateLimiter, this.controller.getComments);
  }
}

export default CommentRoute;
