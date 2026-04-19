import { NextFunction, Response } from 'express';
import PostService from '@services/content/post.service';
import { RequestWithUser } from '@interfaces/auth/auth.interface';

class PostController {
  private postService = new PostService();

  /** Create a post (images + text) */
  public createPost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const authorId = req.user._id.toString();
      const authorType = req.user.type; // 'client' | 'lounge'
      const files = req.files as Express.Multer.File[];
      const { text, hashtags } = req.body;

      const parsedHashtags = hashtags ? (Array.isArray(hashtags) ? hashtags : JSON.parse(hashtags)) : undefined;

      const post = await this.postService.createPost(authorId, authorType, { text, hashtags: parsedHashtags }, files);
      res.status(201).json({ data: post, message: 'Post created successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Get a single post */
  public getPost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id?.toString();
      const post = await this.postService.getPostById(req.params.postId, userId);
      res.status(200).json({ data: post, message: 'Post retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Get posts by user */
  public getUserPosts = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.postService.getUserPosts(req.params.userId, page, limit);
      res.status(200).json({ data: result.posts, pagination: { total: result.total, page, limit }, message: 'Posts retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Update a post */
  public updatePost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { text, hashtags } = req.body;
      const parsedHashtags = hashtags ? (Array.isArray(hashtags) ? hashtags : JSON.parse(hashtags)) : undefined;

      const post = await this.postService.updatePost(req.params.postId, userId, { text, hashtags: parsedHashtags });
      res.status(200).json({ data: post, message: 'Post updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Delete a post */
  public deletePost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      await this.postService.deletePost(req.params.postId, userId);
      res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Toggle like */
  public toggleLike = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const result = await this.postService.toggleLike(req.params.postId, userId);
      res.status(200).json({ data: result, message: result.liked ? 'Post liked' : 'Post unliked' });
    } catch (error) {
      next(error);
    }
  };

  /** Toggle save/bookmark */
  public toggleSave = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const result = await this.postService.toggleSave(req.params.postId, userId);
      res.status(200).json({ data: result, message: result.saved ? 'Post saved' : 'Post unsaved' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: hide post */
  public hidePost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const post = await this.postService.hidePost(req.params.postId);
      res.status(200).json({ data: post, message: 'Post hidden' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: unhide post */
  public unhidePost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const post = await this.postService.unhidePost(req.params.postId);
      res.status(200).json({ data: post, message: 'Post unhidden' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: delete any post */
  public adminDeletePost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      await this.postService.deletePost(req.params.postId, userId, true);
      res.status(200).json({ message: 'Post deleted by admin' });
    } catch (error) {
      next(error);
    }
  };
}

export default PostController;
