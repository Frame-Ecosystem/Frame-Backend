import { Like } from '@systems/FeedContentSystem/interfaces/like.interface';
import likeModel from '@systems/FeedContentSystem/models/like.model';
import userModel from '@systems/UserManager/models/user.model';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import { assertObjectId, assertLounge } from '@utils/validators';
import { logger } from '@utils/logger';

class LikeService {
  private likes = likeModel;
  private users = userModel;
  private notificationService = NotificationService.getInstance();

  /* ───────── Commands ───────── */

  /** Toggle like: creates a like if it doesn't exist, removes it if it does. */
  public async toggleLike(userId: string, loungeId: string): Promise<{ liked: boolean }> {
    await assertLounge(loungeId);

    const existing = await this.likes.findOne({ clientId: userId, loungeId }).select('_id').lean().exec();

    if (existing) {
      await this.likes.deleteOne({ _id: existing._id });
      await this.refreshLoungeCount(loungeId);
      logger.info(`LikeService.toggleLike: unlike user=${userId} lounge=${loungeId}`);
      return { liked: false };
    }

    await this.likes.create({ clientId: userId, loungeId });
    await this.refreshLoungeCount(loungeId);

    // Notify lounge about the new like
    const user = await this.users.findById(userId).select('firstName lastName loungeTitle profileImage type').lean().exec();
    const userName = this.notificationService.extractName(user);
    const userImage = user?.profileImage?.url;
    this.notificationService.notifyLoungeLiked(loungeId, userId, userName, userImage).catch(() => {});

    logger.info(`LikeService.toggleLike: like user=${userId} lounge=${loungeId}`);
    return { liked: true };
  }

  /* ───────── Queries ───────── */

  /** Check whether the authenticated user has liked a specific lounge. */
  public async hasLiked(userId: string, loungeId: string): Promise<boolean> {
    assertObjectId(loungeId, 'lounge');
    const like = await this.likes.findOne({ clientId: userId, loungeId }).select('_id').lean().exec();
    return !!like;
  }

  /** Get all lounges liked by the authenticated user (newest first, paginated). */
  public async getMyLikes(userId: string, page = 1, limit = 20): Promise<{ likes: Like[]; total: number }> {
    const [likes, total] = await Promise.all([
      this.likes
        .find({ clientId: userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'loungeId', select: 'firstName lastName loungeTitle profileImage coverImage averageRating ratingCount likeCount' })
        .lean()
        .exec(),
      this.likes.countDocuments({ clientId: userId }).exec(),
    ]);

    return { likes, total };
  }

  /** Get all users who liked a specific lounge (newest first, paginated). */
  public async getLoungeLikers(loungeId: string, page = 1, limit = 20): Promise<{ likes: Like[]; total: number }> {
    assertObjectId(loungeId, 'lounge');

    const [likes, total] = await Promise.all([
      this.likes
        .find({ loungeId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'clientId', select: 'firstName lastName loungeTitle profileImage type' })
        .lean()
        .exec(),
      this.likes.countDocuments({ loungeId }).exec(),
    ]);

    return { likes, total };
  }

  /* ───────── Helpers ───────── */

  /** Recalculate and persist the lounge's denormalized likeCount. */
  private async refreshLoungeCount(loungeId: string): Promise<void> {
    const count = await this.likes.countDocuments({ loungeId }).exec();
    await this.users.findByIdAndUpdate(loungeId, { likeCount: count });
  }
}

export default LikeService;
