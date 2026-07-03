import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import LikeService from '@systems/FeedContentSystem/services/like.service';
import { parsePagination } from '@utils/validators';
import { logger } from '@utils/logger';

class LikeController {
  private likeService = new LikeService();

  /** POST /likes/:loungeId — toggle like/unlike for the authenticated user. */
  public toggleLike = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { loungeId } = req.params;

      const result = await this.likeService.toggleLike(userId, loungeId);
      res.status(200).json({ success: true, data: result, message: result.liked ? 'Lounge liked' : 'Lounge unliked' });
    } catch (error: any) {
      logger.error(`Error in toggleLike: ${error.message}`);
      next(error);
    }
  };

  /** GET /likes/me — all lounges liked by the authenticated user. */
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

  /** GET /likes/check/:loungeId — check if user has liked a lounge. */
  public hasLiked = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { loungeId } = req.params;

      const liked = await this.likeService.hasLiked(userId, loungeId);
      res.status(200).json({ success: true, data: { liked } });
    } catch (error: any) {
      logger.error(`Error in hasLiked: ${error.message}`);
      next(error);
    }
  };

  /** GET /likes/lounge/:loungeId — users who liked this lounge (auth required). */
  public getLoungeLikers = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { loungeId } = req.params;
      const { page, limit } = parsePagination(req);

      const { likes, total } = await this.likeService.getLoungeLikers(loungeId, page, limit);
      res.status(200).json({ success: true, data: likes, total, page, limit });
    } catch (error: any) {
      logger.error(`Error in getLoungeLikers: ${error.message}`);
      next(error);
    }
  };
}

export default LikeController;
