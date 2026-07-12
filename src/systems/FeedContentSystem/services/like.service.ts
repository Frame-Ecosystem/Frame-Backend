import { BadRequestException, NotFoundException } from '@exceptions/HttpException';
import { Like, LikelikeUserType, isAllowedLikePair } from '@systems/FeedContentSystem/interfaces/like.interface';
import likeModel from '@systems/FeedContentSystem/models/like.model';
import userModel from '@systems/UserManager/models/user.model';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import { assertObjectId, assertLikeableTarget } from '@utils/validators';
import { logger } from '@utils/logger';

const POPULATE_TARGET = { path: 'targetId', select: 'firstName lastName loungeTitle profileImage coverImage averageRating ratingCount likeCount type' };
const POPULATE_LIKER = { path: 'likerId', select: 'firstName lastName loungeTitle profileImage type' };

class LikeService {
  private likes = likeModel;
  private users = userModel;
  private notificationService = NotificationService.getInstance();

  /* ───────── Commands ───────── */

  /**
   * Toggle like: creates a like if it doesn't exist, removes it if it does.
   * Enforces the like matrix:
   *   client  → lounge | agent
   *   lounge  → agent
   *   agent   → (none)
   */
  public async toggleLike(userId: string, targetId: string): Promise<{ liked: boolean }> {
    assertObjectId(targetId, 'target');

    if (userId === targetId) {
      throw new BadRequestException('You cannot like yourself', 'SELF_LIKE');
    }

    // Look up both users in parallel
    const [liker, targetType] = await Promise.all([
      this.users.findById(userId).select('type firstName lastName loungeTitle profileImage').lean(),
      assertLikeableTarget(targetId),
    ]);

    if (!liker) throw new NotFoundException('User not found', 'USER_NOT_FOUND');

    const likerType = liker.type as LikelikeUserType;

    // Enforce the like matrix
    if (!isAllowedLikePair(likerType, targetType)) {
      throw new BadRequestException(
        `A ${likerType} cannot like a ${targetType}`,
        'INVALID_LIKE_PAIR',
      );
    }

    const existing = await this.likes.findOne({ likerId: userId, targetId }).select('_id').lean().exec();

    if (existing) {
      await this.likes.deleteOne({ _id: existing._id });
      await this.refreshTargetCount(targetId);
      logger.info(`LikeService.toggleLike: unlike user=${userId} target=${targetId}`);
      return { liked: false };
    }

    await this.likes.create({ likerId: userId, targetId, likerType, targetType });
    await this.refreshTargetCount(targetId);

    // Notify target about the new like
    const likerName = this.notificationService.extractName(liker);
    const likerImage = liker?.profileImage?.url;

    if (targetType === 'lounge') {
      this.notificationService.notifyLoungeLiked(targetId, userId, likerName, likerImage).catch(() => {});
    } else {
      this.notificationService.notifyAgentLiked(targetId, userId, likerName, likerImage).catch(() => {});
    }

    logger.info(`LikeService.toggleLike: like ${likerType}=${userId} → ${targetType}=${targetId}`);
    return { liked: true };
  }

  /* ───────── Queries ───────── */

  /** Check whether the authenticated user has liked a specific target. */
  public async hasLiked(userId: string, targetId: string): Promise<boolean> {
    assertObjectId(targetId, 'target');
    const like = await this.likes.findOne({ likerId: userId, targetId }).select('_id').lean().exec();
    return !!like;
  }

  /** Get all targets liked by the authenticated user (newest first, paginated). */
  public async getMyLikes(userId: string, page = 1, limit = 20): Promise<{ likes: Like[]; total: number }> {
    const [likes, total] = await Promise.all([
      this.likes
        .find({ likerId: userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(POPULATE_TARGET)
        .lean()
        .exec(),
      this.likes.countDocuments({ likerId: userId }).exec(),
    ]);

    return { likes, total };
  }

  /** Get all users who liked a specific target (newest first, paginated). */
  public async getTargetLikers(targetId: string, page = 1, limit = 20): Promise<{ likes: Like[]; total: number }> {
    assertObjectId(targetId, 'target');

    const [likes, total] = await Promise.all([
      this.likes
        .find({ targetId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(POPULATE_LIKER)
        .lean()
        .exec(),
      this.likes.countDocuments({ targetId }).exec(),
    ]);

    return { likes, total };
  }

  /* ───────── Helpers ───────── */

  /** Recalculate and persist the target's denormalized likeCount. */
  private async refreshTargetCount(targetId: string): Promise<void> {
    const count = await this.likes.countDocuments({ targetId }).exec();
    await this.users.findByIdAndUpdate(targetId, { likeCount: count });
  }
}

export default LikeService;
