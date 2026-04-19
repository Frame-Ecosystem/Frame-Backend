import { NotFoundException } from '@exceptions/HttpException';
import { Rating } from '@interfaces/rating/rating.interface';
import ratingModel from '@models/rating/rating.model';
import userModel from '@models/user/user.model';
import NotificationService from '@services/realtime/notification.service';
import { UpsertRatingDto } from '@dtos/rating/rating.dto';
import { assertObjectId, assertLounge } from '@utils/validators';
import { logger } from '@utils/logger';
import mongoose from 'mongoose';

const POPULATE_CLIENT = { path: 'clientId', select: 'firstName lastName profileImage' };

class RatingService {
  private ratings = ratingModel;
  private users = userModel;
  private notificationService = NotificationService.getInstance();

  /* ───────── Commands ───────── */

  /**
   * Create or update a client's rating for a lounge.
   * After persisting, recalculates the lounge's denormalized averageRating / ratingCount.
   */
  public async upsertRating(clientId: string, dto: UpsertRatingDto): Promise<Rating> {
    await assertLounge(dto.loungeId);

    const rating = await this.ratings.findOneAndUpdate(
      { clientId, loungeId: dto.loungeId },
      { score: dto.score, ...(dto.comment !== undefined && { comment: dto.comment }) },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await this.refreshLoungeSummary(dto.loungeId);

    // Notify lounge about the new/updated rating
    const client = await this.users.findById(clientId).select('firstName lastName profileImage type').lean().exec();
    const clientName = this.notificationService.extractName(client);
    const clientImage = client?.profileImage?.url;
    this.notificationService.notifyLoungeRated(dto.loungeId, clientId, clientName, dto.score, clientImage).catch(() => {});

    logger.info(`RatingService.upsertRating: client=${clientId} lounge=${dto.loungeId} score=${dto.score}`);
    return rating;
  }

  /** Delete a client's own rating and refresh the lounge summary. */
  public async deleteRating(clientId: string, loungeId: string): Promise<void> {
    const deleted = await this.ratings.findOneAndDelete({ clientId, loungeId });
    if (!deleted) throw new NotFoundException('Rating not found', 'RATING_NOT_FOUND');

    await this.refreshLoungeSummary(loungeId);
    logger.info(`RatingService.deleteRating: client=${clientId} lounge=${loungeId}`);
  }

  /* ───────── Queries ───────── */

  /** All ratings for a lounge, newest first. */
  public async getLoungeRatings(loungeId: string, page = 1, limit = 20): Promise<{ ratings: Rating[]; total: number }> {
    assertObjectId(loungeId, 'lounge');

    const [ratings, total] = await Promise.all([
      this.ratings
        .find({ loungeId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(POPULATE_CLIENT)
        .lean(),
      this.ratings.countDocuments({ loungeId }),
    ]);

    return { ratings, total };
  }

  /** Get the authenticated client's own rating for a specific lounge (or null). */
  public async getMyRating(clientId: string, loungeId: string): Promise<Rating | null> {
    assertObjectId(loungeId, 'lounge');
    return this.ratings.findOne({ clientId, loungeId }).lean();
  }

  /* ───────── Helpers ───────── */

  /**
   * Recalculate and persist the lounge's averageRating and ratingCount via aggregation.
   * If there are no ratings the values reset to 0.
   */
  private async refreshLoungeSummary(loungeId: string): Promise<void> {
    const [summary] = await this.ratings.aggregate([
      { $match: { loungeId: new mongoose.Types.ObjectId(loungeId) } },
      { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
    ]);

    const averageRating = summary ? Math.round(summary.avg * 10) / 10 : 0;
    const ratingCount = summary?.count ?? 0;

    await this.users.findByIdAndUpdate(loungeId, { averageRating, ratingCount });
  }
}

export default RatingService;
