import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import LikeService from '@systems/FeedContentSystem/services/like.service';
import { parsePagination } from '@utils/validators';
import { logger } from '@utils/logger';

class LikeController {
  private likeService = new LikeService();

  /** POST /likes/:targetId — toggle like/unlike for the authenticated user. */
  public toggleLike = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { targetId } = req.params;

      const result = await this.likeService.toggleLike(userId, targetId);
      res.status(200).json({ success: true, data: result, message: result.liked ? 'Liked' : 'Unliked' });
    } catch (error: any) {
      logger.error(`Error in toggleLike: ${error.message}`);
      next(error);
    }
  };

  /** GET /likes/me — all targets liked by the authenticated user. */
  public getMyLikes = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { page, limit } = parsePagination(req);

      const { likes, total } = await this.likeService.getMyLikes(userId, page, limit);
      res.status(200).json({ success: true, data: likes, total, page, limit });
    } catch (error: any) {
      logger.error(`Error in getMyLikes: ${error.message}`);
      next(error);
    }
  };

  /** GET /likes/check/:targetId — check if user has liked a target. */
  public hasLiked = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { targetId } = req.params;

      const liked = await this.likeService.hasLiked(userId, targetId);
      res.status(200).json({ success: true, data: { liked } });
    } catch (error: any) {
      logger.error(`Error in hasLiked: ${error.message}`);
      next(error);
    }
  };

  /** GET /likes/target/:targetId — users who liked this target (auth required). */
  public getTargetLikers = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { targetId } = req.params;
      const { page, limit } = parsePagination(req);

      const { likes, total } = await this.likeService.getTargetLikers(targetId, page, limit);
      res.status(200).json({ success: true, data: likes, total, page, limit });
    } catch (error: any) {
      logger.error(`Error in getTargetLikers: ${error.message}`);
      next(error);
    }
  };
}

export default LikeController;
