import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import FollowService from '@systems/UserManager/services/follow.service';
import { parsePagination } from '@utils/validators';
import { logger } from '@utils/logger';

class FollowController {
  private followService = new FollowService();

  /** POST /v1/follows/:targetId — follow a user. */
  public follow = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const followerId = req.user._id.toString();
      const followerType = req.user.type;
      const { targetId } = req.params;

      const result = await this.followService.follow(followerId, followerType, targetId);
      res.status(201).json({ success: true, data: result, message: 'User followed successfully' });
    } catch (error: any) {
      logger.error(`Error in follow: ${error.message}`);
      next(error);
    }
  };

  /** DELETE /v1/follows/:targetId — unfollow a user. */
  public unfollow = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const followerId = req.user._id.toString();
      const { targetId } = req.params;

      const result = await this.followService.unfollow(followerId, targetId);
      res.status(200).json({ success: true, data: result, message: 'User unfollowed successfully' });
    } catch (error: any) {
      logger.error(`Error in unfollow: ${error.message}`);
      next(error);
    }
  };

  /** GET /v1/follows/check/:targetId — check if current user follows target. */
  public isFollowing = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const followerId = req.user._id.toString();
      const { targetId } = req.params;

      const following = await this.followService.isFollowing(followerId, targetId);
      res.status(200).json({ success: true, data: { following } });
    } catch (error: any) {
      logger.error(`Error in isFollowing: ${error.message}`);
      next(error);
    }
  };

  /** GET /v1/follows/following/:userId — users that :userId is following. */
  public getFollowing = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { page, limit } = parsePagination(req);
      const filterType = req.query.type as string | undefined;

      const data = await this.followService.getFollowing(userId, page, limit, filterType);
      res.status(200).json({ success: true, data, message: 'Following list retrieved successfully' });
    } catch (error: any) {
      logger.error(`Error in getFollowing: ${error.message}`);
      next(error);
    }
  };

  /** GET /v1/follows/followers/:userId — followers of :userId. */
  public getFollowers = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { page, limit } = parsePagination(req);
      const filterType = req.query.type as string | undefined;

      const data = await this.followService.getFollowers(userId, page, limit, filterType);
      res.status(200).json({ success: true, data, message: 'Followers list retrieved successfully' });
    } catch (error: any) {
      logger.error(`Error in getFollowers: ${error.message}`);
      next(error);
    }
  };

  /** GET /v1/follows/counts/:userId — follower + following counts. */
  public getCounts = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const data = await this.followService.getCounts(userId);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error(`Error in getCounts: ${error.message}`);
      next(error);
    }
  };
}

export default FollowController;
