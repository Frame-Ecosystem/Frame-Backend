import { NextFunction, Response } from 'express';
import FeedService from '@systems/FeedContentSystem/services/feed.service';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';

class FeedController {
  private feedService = new FeedService();

  /** Following-based feed */
  public getFollowingFeed = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const seed = req.query.seed ? parseInt(req.query.seed as string) : undefined;

      const result = await this.feedService.getFollowingFeed(userId, page, limit, seed);
      res.setHeader('Cache-Control', 'private, no-cache');
      res.setHeader('Vary', 'Authorization');
      res.status(200).json({ data: result.items, pagination: { total: result.total, page, limit, seed: result.seed }, message: 'Feed retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /** Global explore feed */
  public getExploreFeed = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id?.toString();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const seed = req.query.seed ? parseInt(req.query.seed as string) : undefined;

      const result = await this.feedService.getExploreFeed(userId, page, limit, seed);
      res.setHeader('Cache-Control', 'public, no-cache');
      res.setHeader('Vary', 'Authorization');
      res
        .status(200)
        .json({ data: result.items, pagination: { total: result.total, page, limit, seed: result.seed }, message: 'Explore feed retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /** Hashtag feed */
  public getHashtagFeed = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id?.toString();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const seed = req.query.seed ? parseInt(req.query.seed as string) : undefined;

      const result = await this.feedService.getHashtagFeed(req.params.tag, userId, page, limit, seed);
      res
        .status(200)
        .json({ data: result.items, pagination: { total: result.total, page, limit, seed: result.seed }, message: 'Hashtag feed retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /** Saved content */
  public getSavedContent = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.feedService.getSavedContent(userId, page, limit);
      res.status(200).json({ data: result.items, pagination: { total: result.total, page, limit }, message: 'Saved content retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /** Trending hashtags */
  public getTrendingHashtags = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const tags = await this.feedService.getTrendingHashtags(limit);
      res.status(200).json({ data: tags, message: 'Trending hashtags retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /** Search hashtags */
  public searchHashtags = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const q = (req.query.q as string) || '';
      const limit = parseInt(req.query.limit as string) || 20;
      const tags = await this.feedService.searchHashtags(q, limit);
      res.status(200).json({ data: tags, message: 'Hashtag search results' });
    } catch (error) {
      next(error);
    }
  };
}

export default FeedController;
