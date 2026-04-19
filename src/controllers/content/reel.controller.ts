import { NextFunction, Response } from 'express';
import ReelService from '@services/content/reel.service';
import { RequestWithUser } from '@interfaces/auth/auth.interface';

class ReelController {
  private reelService = new ReelService();

  /** Create a reel (video + optional thumbnail) */
  public createReel = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const authorId = req.user._id.toString();
      const authorType = req.user.type;
      const files = req.files as { video?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] };
      const { caption, duration, hashtags } = req.body;

      const parsedHashtags = hashtags ? (Array.isArray(hashtags) ? hashtags : JSON.parse(hashtags)) : undefined;

      const reel = await this.reelService.createReel(authorId, authorType, { caption, duration: Number(duration), hashtags: parsedHashtags }, files);
      res.status(201).json({ data: reel, message: 'Reel created successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Get a single reel */
  public getReel = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id?.toString();
      const reel = await this.reelService.getReelById(req.params.reelId, userId);
      res.status(200).json({ data: reel, message: 'Reel retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Get reels by user */
  public getUserReels = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.reelService.getUserReels(req.params.userId, page, limit);
      res.status(200).json({ data: result.reels, pagination: { total: result.total, page, limit }, message: 'Reels retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Update a reel (caption + hashtags only) */
  public updateReel = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { caption, hashtags } = req.body;
      const parsedHashtags = hashtags ? (Array.isArray(hashtags) ? hashtags : JSON.parse(hashtags)) : undefined;

      const reel = await this.reelService.updateReel(req.params.reelId, userId, { caption, hashtags: parsedHashtags });
      res.status(200).json({ data: reel, message: 'Reel updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Delete a reel */
  public deleteReel = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      await this.reelService.deleteReel(req.params.reelId, userId);
      res.status(200).json({ message: 'Reel deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** Toggle like */
  public toggleLike = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const result = await this.reelService.toggleLike(req.params.reelId, userId);
      res.status(200).json({ data: result, message: result.liked ? 'Reel liked' : 'Reel unliked' });
    } catch (error) {
      next(error);
    }
  };

  /** Toggle save/bookmark */
  public toggleSave = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const result = await this.reelService.toggleSave(req.params.reelId, userId);
      res.status(200).json({ data: result, message: result.saved ? 'Reel saved' : 'Reel unsaved' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: hide reel */
  public hideReel = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const reel = await this.reelService.hideReel(req.params.reelId);
      res.status(200).json({ data: reel, message: 'Reel hidden' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: unhide reel */
  public unhideReel = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const reel = await this.reelService.unhideReel(req.params.reelId);
      res.status(200).json({ data: reel, message: 'Reel unhidden' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: delete any reel */
  public adminDeleteReel = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      await this.reelService.deleteReel(req.params.reelId, userId, true);
      res.status(200).json({ message: 'Reel deleted by admin' });
    } catch (error) {
      next(error);
    }
  };
}

export default ReelController;
