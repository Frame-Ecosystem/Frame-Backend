import { Like } from '@interfaces/like/like.interface';
import likeModel from '@models/like/like.model';
import userModel from '@models/user/user.model';
import NotificationService from '@services/realtime/notification.service';
import { assertObjectId, assertLounge } from '@utils/validators';
import { logger } from '@utils/logger';

class LikeService {
  private likes = likeModel;
  private users = userModel;
  private notificationService = NotificationService.getInstance();

  /* ───────── Commands ───────── */

  /** Toggle like: creates a like if it doesn't exist, removes it if it does. */
  public async toggleLike(clientId: string, loungeId: string): Promise<{ liked: boolean }> {
    await assertLounge(loungeId);

    const existing = await this.likes.findOne({ clientId, loungeId }).select('_id').lean().exec();

    if (existing) {
      await this.likes.deleteOne({ _id: existing._id });
      await this.refreshLoungeCount(loungeId);
      logger.info(`LikeService.toggleLike: unlike client=${clientId} lounge=${loungeId}`);
      return { liked: false };
    }

    await this.likes.create({ clientId, loungeId });
    await this.refreshLoungeCount(loungeId);

    // Notify lounge about the new like
    const client = await this.users.findById(clientId).select('firstName lastName profileImage type').lean().exec();
    const clientName = this.notificationService.extractName(client);
    const clientImage = client?.profileImage?.url;
    this.notificationService.notifyLoungeLiked(loungeId, clientId, clientName, clientImage).catch(() => {});

    logger.info(`LikeService.toggleLike: like client=${clientId} lounge=${loungeId}`);
    return { liked: true };
  }

  /* ───────── Queries ───────── */

  /** Check whether the authenticated client has liked a specific lounge. */
  public async hasLiked(clientId: string, loungeId: string): Promise<boolean> {
    assertObjectId(loungeId, 'lounge');
    const like = await this.likes.findOne({ clientId, loungeId }).select('_id').lean().exec();
    return !!like;
  }

  /** Get all lounges liked by the authenticated client (newest first, paginated). */
  public async getMyLikes(clientId: string, page = 1, limit = 20): Promise<{ likes: Like[]; total: number }> {
    const [likes, total] = await Promise.all([
      this.likes
        .find({ clientId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'loungeId', select: 'firstName lastName loungeTitle profileImage coverImage averageRating ratingCount likeCount' })
        .lean()
        .exec(),
      this.likes.countDocuments({ clientId }).exec(),
    ]);

    return { likes, total };
  }

  /** Get all clients who liked a specific lounge (newest first, paginated). */
  public async getLoungeLikers(loungeId: string, page = 1, limit = 20): Promise<{ likes: Like[]; total: number }> {
    assertObjectId(loungeId, 'lounge');

    const [likes, total] = await Promise.all([
      this.likes
        .find({ loungeId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'clientId', select: 'firstName lastName profileImage' })
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
