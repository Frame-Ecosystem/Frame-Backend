import { Router } from 'express';
import PostController from '@systems/FeedContentSystem/controllers/post.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import { adminOrLoungeOrClientOrAgentMiddleware, adminMiddleware } from '@middlewares/role.middleware';
import { uploadPostMedia } from '@middlewares/contentUpload.middleware';
import { contentCreateRateLimiter, likeRateLimiter, generalRateLimiter } from '@middlewares/rateLimit.middleware';

class PostRoute implements Routes {
  public path = '/v1/posts';
  public router = Router();
  private controller = new PostController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @route   POST /v1/posts
     * @desc    Create a new post (images + text)
     * @access  Private (Client or Lounge)
     */
    this.router.post(
      '/',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      csrfMiddleware,
      contentCreateRateLimiter,
      uploadPostMedia,
      this.controller.createPost,
    );

    /**
     * @route   GET /v1/posts/user/:userId
     * @desc    Get posts by a specific user
     * @access  Private
     */
    this.router.get('/user/:userId', authMiddleware, generalRateLimiter, this.controller.getUserPosts);

    /**
     * @route   GET /v1/posts/:postId
     * @desc    Get a single post
     * @access  Private
     */
    this.router.get('/:postId', authMiddleware, generalRateLimiter, this.controller.getPost);

    /**
     * @route   PUT /v1/posts/:postId
     * @desc    Update a post (text, hashtags)
     * @access  Private (owner only)
     */
    this.router.put(
      '/:postId',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      csrfMiddleware,
      generalRateLimiter,
      this.controller.updatePost,
    );

    /**
     * @route   DELETE /v1/posts/:postId
     * @desc    Delete own post
     * @access  Private (owner only)
     */
    this.router.delete('/:postId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, csrfMiddleware, this.controller.deletePost);

    /**
     * @route   POST /v1/posts/:postId/like
     * @desc    Like or unlike a post
     * @access  Private
     */
    this.router.post(
      '/:postId/like',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      csrfMiddleware,
      likeRateLimiter,
      this.controller.toggleLike,
    );

    /**
     * @route   POST /v1/posts/:postId/save
     * @desc    Save or unsave a post
     * @access  Private
     */
    this.router.post(
      '/:postId/save',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      csrfMiddleware,
      likeRateLimiter,
      this.controller.toggleSave,
    );

    /* ───────── Admin routes ───────── */

    /**
     * @route   PUT /v1/posts/:postId/hide
     * @desc    Hide a post (admin moderation)
     * @access  Admin only
     */
    this.router.put('/:postId/hide', authMiddleware, adminMiddleware, csrfMiddleware, this.controller.hidePost);

    /**
     * @route   PUT /v1/posts/:postId/unhide
     * @desc    Unhide a post (admin moderation)
     * @access  Admin only
     */
    this.router.put('/:postId/unhide', authMiddleware, adminMiddleware, csrfMiddleware, this.controller.unhidePost);

    /**
     * @route   DELETE /v1/posts/:postId/admin
     * @desc    Admin force delete a post
     * @access  Admin only
     */
    this.router.delete('/:postId/admin', authMiddleware, adminMiddleware, csrfMiddleware, this.controller.adminDeletePost);
  }
}

export default PostRoute;
