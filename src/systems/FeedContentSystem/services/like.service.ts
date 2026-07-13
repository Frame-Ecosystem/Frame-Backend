import { BadRequestException, NotFoundException } from '@exceptions/HttpException';
import { Like } from '@systems/FeedContentSystem/interfaces/like.interface';
import likeModel from '@systems/FeedContentSystem/models/like.model';
import userModel from '@systems/UserManager/models/user.model';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import { assertObjectId, assertSocialTarget } from '@utils/validators';
import { isAllowedSocialPair, SocialUserType, POPULATE_TARGET_FULL, POPULATE_ACTOR_BASIC } from '@utils/social-matrix';
import { logger } from '@utils/logger';

const POPULATE_TARGET = { path: 'targetId', select: POPULATE_TARGET_FULL };
const POPULATE_LIKER = { path: 'likerId', select: POPULATE_ACTOR_BASIC };

class LikeService {
  private likes = likeModel;
  private users = userModel;
  private notificationService = NotificationService.getInstance();

  /* ───────── Commands ───────── */

  /**
   * Toggle like: creates a like if it doesn't exist, removes it if it does.
   * Enforces the social interaction matrix:
   *   any user type -> lounge | agent
   */
  public async toggleLike(userId: string, targetId: string): Promise<{ liked: boolean }> {
    assertObjectId(targetId, 'target');

    if (userId === targetId) {
      throw new BadRequestException('You cannot like yourself', 'SELF_LIKE');
    }

    const [liker, targetType] = await Promise.all([
      this.users.findById(userId).select('type firstName lastName loungeTitle profileImage').lean(),
      assertSocialTarget(targetId, 'likeable', 'INVALID_LIKEABLE_TARGET'),
    ]);

    if (!liker) throw new NotFoundException('User not found', 'USER_NOT_FOUND');

    const likerType = liker.type as SocialUserType;

    if (!isAllowedSocialPair(likerType, targetType)) {
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

    const likerName = this.notificationService.extractName(liker);
    const likerImage = liker?.profileImage?.url;

    if (targetType === 'lounge') {
      this.notificationService.notifyLoungeLiked(targetId, userId, likerName, likerImage)
        .catch((err) => logger.error(`LikeService: failed to send lounge liked notification: ${err.message}`));
    } else {
      this.notificationService.notifyAgentLiked(targetId, userId, likerName, likerImage)
        .catch((err) => logger.error(`LikeService: failed to send agent liked notification: ${err.message}`));
    }

    logger.info(`LikeService.toggleLike: like ${likerType}=${userId} -> ${targetType}=${targetId}`);
    return { liked: true };
  }

  /* ───────── Queries ───────── */

  public async hasLiked(userId: string, targetId: string): Promise<boolean> {
    assertObjectId(targetId, 'target');
    const like = await this.likes.findOne({ likerId: userId, targetId }).select('_id').lean().exec();
    return !!like;
  }

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

  private async refreshTargetCount(targetId: string): Promise<void> {
    const count = await this.likes.countDocuments({ targetId }).exec();
    await this.users.findByIdAndUpdate(targetId, { likeCount: count });
  }
}

export default LikeService;
