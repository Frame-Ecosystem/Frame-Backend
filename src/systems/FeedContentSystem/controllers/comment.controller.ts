import { NextFunction, Response } from 'express';
import CommentService from '@systems/FeedContentSystem/services/comment.service';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';

class CommentController {
  private commentService = new CommentService();

  /** Add a comment (or reply) */
  public addComment = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const authorId = req.user._id.toString();
      const { targetType, targetId } = req.params;
      const { text, parentCommentId } = req.body;

      const comment = await this.commentService.addComment(authorId, targetType as 'post' | 'reel', targetId, { text, parentCommentId });
      res.status(201).json({ data: comment, message: 'Comment added successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** List top-level comments for a post/reel */
  public getComments = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { targetType, targetId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.commentService.getComments(targetType as 'post' | 'reel', targetId, page, limit);
      res.status(200).json({ data: result.comments, pagination: { total: result.total, page, limit }, message: 'Comments retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /** List replies to a comment */
  public getReplies = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { commentId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.commentService.getReplies(commentId, page, limit);
      res.status(200).json({ data: result.replies, pagination: { total: result.total, page, limit }, message: 'Replies retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /** Delete a comment */
  public deleteComment = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      await this.commentService.deleteComment(req.params.commentId, userId);
      res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Toggle like on a comment */
  public toggleLike = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const result = await this.commentService.toggleLike(req.params.commentId, userId);
      res.status(200).json({ data: result, message: result.liked ? 'Comment liked' : 'Comment unliked' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: hide comment */
  public hideComment = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const comment = await this.commentService.hideComment(req.params.commentId);
      res.status(200).json({ data: comment, message: 'Comment hidden' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: unhide comment */
  public unhideComment = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const comment = await this.commentService.unhideComment(req.params.commentId);
      res.status(200).json({ data: comment, message: 'Comment unhidden' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: delete any comment */
  public adminDeleteComment = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      await this.commentService.deleteComment(req.params.commentId, userId, true);
      res.status(200).json({ message: 'Comment deleted by admin' });
    } catch (error) {
      next(error);
    }
  };
}

export default CommentController;
