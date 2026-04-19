import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import PostService from '@systems/FeedContentSystem/services/post.service';
import ReelService from '@systems/FeedContentSystem/services/reel.service';
import CommentService from '@systems/FeedContentSystem/services/comment.service';
import ReportService from '@systems/FeedContentSystem/services/report.service';

class ContentModerationController {
  private postService = new PostService();
  private reelService = new ReelService();
  private commentService = new CommentService();
  private reportService = new ReportService();

  // ─── Post Moderation ──────────────────────────────────────────

  public hidePost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const post = await this.postService.hidePost(req.params.postId);
      res.status(200).json({ data: post, message: 'Post hidden' });
    } catch (error) {
      next(error);
    }
  };

  public unhidePost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const post = await this.postService.unhidePost(req.params.postId);
      res.status(200).json({ data: post, message: 'Post unhidden' });
    } catch (error) {
      next(error);
    }
  };

  public adminDeletePost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      await this.postService.deletePost(req.params.postId, userId, true);
      res.status(200).json({ message: 'Post deleted by admin' });
    } catch (error) {
      next(error);
    }
  };

  // ─── Reel Moderation ──────────────────────────────────────────

  public hideReel = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const reel = await this.reelService.hideReel(req.params.reelId);
      res.status(200).json({ data: reel, message: 'Reel hidden' });
    } catch (error) {
      next(error);
    }
  };

  public unhideReel = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const reel = await this.reelService.unhideReel(req.params.reelId);
      res.status(200).json({ data: reel, message: 'Reel unhidden' });
    } catch (error) {
      next(error);
    }
  };

  public adminDeleteReel = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      await this.reelService.deleteReel(req.params.reelId, userId, true);
      res.status(200).json({ message: 'Reel deleted by admin' });
    } catch (error) {
      next(error);
    }
  };

  // ─── Comment Moderation ───────────────────────────────────────

  public hideComment = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const comment = await this.commentService.hideComment(req.params.commentId);
      res.status(200).json({ data: comment, message: 'Comment hidden' });
    } catch (error) {
      next(error);
    }
  };

  public unhideComment = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const comment = await this.commentService.unhideComment(req.params.commentId);
      res.status(200).json({ data: comment, message: 'Comment unhidden' });
    } catch (error) {
      next(error);
    }
  };

  public adminDeleteComment = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      await this.commentService.deleteComment(req.params.commentId, userId, true);
      res.status(200).json({ message: 'Comment deleted by admin' });
    } catch (error) {
      next(error);
    }
  };

  // ─── Report Management ────────────────────────────────────────

  public getReports = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;

      const result = await this.reportService.getReports(status, page, limit);
      res.status(200).json({ data: result.reports, pagination: { total: result.total, page, limit }, message: 'Reports retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public reviewReport = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { reportId } = req.params;
      const { status, adminNote } = req.body;

      const report = await this.reportService.reviewReport(reportId, { status, adminNote });
      res.status(200).json({ data: report, message: 'Report reviewed' });
    } catch (error) {
      next(error);
    }
  };
}

export default ContentModerationController;
