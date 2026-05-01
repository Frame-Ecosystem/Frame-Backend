import followModel from '@systems/UserManager/models/follow.model';
import userModel from '@systems/UserManager/models/user.model';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import { BadRequestException, NotFoundException } from '@exceptions/HttpException';
import { assertObjectId } from '@utils/validators';
import { logger } from '@utils/logger';

/** Allowed follow relationships: client→client, client→lounge, lounge→client, lounge→lounge */
const ALLOWED_FOLLOW_PAIRS = new Set(['client→client', 'client→lounge', 'lounge→client', 'lounge→lounge']);

/** Fields populated on follow user references. */
const FOLLOW_USER_SELECT = 'firstName lastName loungeTitle profileImage bio type';

interface PaginateFollowsOpts {
  filterField: 'followerId' | 'followingId';
  userId: string;
  populateField: 'followerId' | 'followingId';
  typeFilterField: 'followerType' | 'followingType';
  filterType?: string;
  page: number;
  limit: number;
}

class FollowService {
  private follows = followModel;
  private users = userModel;
  private notificationService = NotificationService.getInstance();

  /* ───────── Commands ───────── */

  /** Follow a user. Returns { following: true }. */
  public async follow(followerId: string, followerType: string, targetId: string): Promise<{ following: boolean }> {
    assertObjectId(targetId, 'Target user');

    if (followerId === targetId) {
      throw new BadRequestException('You cannot follow yourself', 'SELF_FOLLOW');
    }

    // Verify target exists and get their type
    const target = await this.users.findById(targetId).select('type isBlocked').lean().exec();
    if (!target) throw new NotFoundException('User not found', 'USER_NOT_FOUND');
    if (target.isBlocked) throw new NotFoundException('User not found', 'USER_NOT_FOUND');

    const targetType = target.type as string;

    // Validate the follow pair is allowed
    const pairKey = `${followerType}→${targetType}`;
    if (!ALLOWED_FOLLOW_PAIRS.has(pairKey)) {
      throw new BadRequestException(`A ${followerType} cannot follow a ${targetType}`, 'INVALID_FOLLOW_PAIR');
    }

    // Check if already following
    const existing = await this.follows.findOne({ followerId, followingId: targetId }).lean().exec();
    if (existing) {
      throw new BadRequestException('You are already following this user', 'ALREADY_FOLLOWING');
    }

    try {
      await this.follows.create({
        followerId,
        followingId: targetId,
        followerType,
        followingType: targetType,
      });
    } catch (err: any) {
      // Concurrent follow race: unique index caught a duplicate — treat as success
      if (err?.code === 11000) {
        return { following: true };
      }
      throw err;
    }

    // Update denormalized counts
    await this.refreshCounts(followerId, targetId);

    // Notify the target user about new follower
    const follower = await this.users.findById(followerId).select('firstName lastName loungeTitle profileImage type').lean().exec();
    const followerName = this.notificationService.extractName(follower);
    const followerImage = follower?.profileImage?.url;
    this.notificationService.notifyNewFollower(targetId, followerId, followerName, followerImage).catch(() => {});

    logger.info(`FollowService.follow: ${followerType} ${followerId} → ${targetType} ${targetId}`);
    return { following: true };
  }

  /** Unfollow a user. Returns { following: false }. */
  public async unfollow(followerId: string, targetId: string): Promise<{ following: boolean }> {
    assertObjectId(targetId, 'Target user');

    if (followerId === targetId) {
      throw new BadRequestException('You cannot unfollow yourself', 'SELF_FOLLOW');
    }

    const result = await this.follows.deleteOne({ followerId, followingId: targetId }).exec();
    if (result.deletedCount === 0) {
      throw new BadRequestException('You are not following this user', 'NOT_FOLLOWING');
    }

    // Update denormalized counts
    await this.refreshCounts(followerId, targetId);

    logger.info(`FollowService.unfollow: ${followerId} unfollowed ${targetId}`);
    return { following: false };
  }

  /* ───────── Queries ───────── */

  /** Check if followerId is following targetId. */
  public async isFollowing(followerId: string, targetId: string): Promise<boolean> {
    assertObjectId(targetId, 'Target user');
    const doc = await this.follows.findOne({ followerId, followingId: targetId }).select('_id').lean().exec();
    return !!doc;
  }

  /** Get paginated list of users that `userId` is following. */
  public async getFollowing(userId: string, page: number, limit: number, filterType?: string) {
    return this.paginateFollows({
      filterField: 'followerId',
      userId,
      populateField: 'followingId',
      typeFilterField: 'followingType',
      filterType,
      page,
      limit,
    });
  }

  /** Get paginated list of followers for `userId`. */
  public async getFollowers(userId: string, page: number, limit: number, filterType?: string) {
    return this.paginateFollows({
      filterField: 'followingId',
      userId,
      populateField: 'followerId',
      typeFilterField: 'followerType',
      filterType,
      page,
      limit,
    });
  }

  /** Get follow counts for a user. */
  public async getCounts(userId: string): Promise<{ followersCount: number; followingCount: number }> {
    assertObjectId(userId, 'User');

    const [followersCount, followingCount] = await Promise.all([
      this.follows.countDocuments({ followingId: userId }).exec(),
      this.follows.countDocuments({ followerId: userId }).exec(),
    ]);

    return { followersCount, followingCount };
  }

  /* ───────── Helpers ───────── */

  /** Shared paginator for getFollowing / getFollowers. */
  private async paginateFollows(opts: PaginateFollowsOpts) {
    const { filterField, userId, populateField, typeFilterField, filterType, page, limit } = opts;
    assertObjectId(userId, 'User');

    const filter: Record<string, string> = { [filterField]: userId };
    if (filterType) filter[typeFilterField] = filterType;

    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      this.follows.find(filter).populate(populateField, FOLLOW_USER_SELECT).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.follows.countDocuments(filter).exec(),
    ]);

    return {
      users: follows.map(f => (f as any)[populateField]).filter(Boolean),
      total,
      page,
      limit,
    };
  }

  /** Recalculate and persist denormalized follower/following counts. */
  private async refreshCounts(followerId: string, followingId: string): Promise<void> {
    const [followerFollowingCount, followingFollowersCount] = await Promise.all([
      this.follows.countDocuments({ followerId }).exec(),
      this.follows.countDocuments({ followingId }).exec(),
    ]);

    await Promise.all([
      this.users.findByIdAndUpdate(followerId, { followingCount: followerFollowingCount }),
      this.users.findByIdAndUpdate(followingId, { followersCount: followingFollowersCount }),
    ]);
  }
}

export default FollowService;
