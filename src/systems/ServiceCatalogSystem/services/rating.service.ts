import { BadRequestException, NotFoundException } from '@exceptions/HttpException';
import { Rating, RateableUserType, isAllowedRatingPair } from '@systems/ServiceCatalogSystem/interfaces/rating.interface';
import ratingModel from '@systems/ServiceCatalogSystem/models/rating.model';
import userModel from '@systems/UserManager/models/user.model';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import { UpsertRatingDto } from '@systems/ServiceCatalogSystem/dtos/rating.dto';
import { assertObjectId, assertRateableTarget, assertExistingUser } from '@utils/validators';
import { logger } from '@utils/logger';
import mongoose from 'mongoose';

const POPULATE_RATER = { path: 'raterId', select: 'firstName lastName loungeTitle profileImage type' };

class RatingService {
  private ratings = ratingModel;
  private users = userModel;
  private notificationService = NotificationService.getInstance();

  /* ───────── Commands ───────── */

  /**
   * Create or update a user's rating for a target.
   * Enforces the rating matrix:
   *   client  → lounge | agent
   *   agent   → lounge
   *   lounge  → agent
   * After persisting, recalculates the target's denormalized averageRating / ratingCount.
   */
  public async upsertRating(raterId: string, dto: UpsertRatingDto): Promise<Rating> {
    assertObjectId(dto.targetId, 'target');

    if (raterId === dto.targetId) {
      throw new BadRequestException('You cannot rate yourself', 'SELF_RATING');
    }

    // Look up both users in parallel
    const [rater, targetType] = await Promise.all([
      this.users.findById(raterId).select('type firstName lastName loungeTitle profileImage').lean(),
      assertRateableTarget(dto.targetId),
    ]);

    if (!rater) throw new NotFoundException('Rater not found', 'USER_NOT_FOUND');

    const raterType = rater.type as RateableUserType;

    // Enforce the rating matrix
    if (!isAllowedRatingPair(raterType, targetType)) {
      throw new BadRequestException(
        `A ${raterType} cannot rate a ${targetType}`,
        'INVALID_RATING_PAIR',
      );
    }

    const rating = await this.ratings.findOneAndUpdate(
      { raterId, targetId: dto.targetId },
      {
        raterType,
        targetType,
        score: dto.score,
        ...(dto.comment !== undefined && { comment: dto.comment }),
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await this.refreshTargetSummary(dto.targetId);

    // Send notification based on the rating pair
    const raterName = this.notificationService.extractName(rater);
    const raterImage = rater?.profileImage?.url;

    if (raterType === 'client' && targetType === 'lounge') {
      this.notificationService.notifyLoungeRated(dto.targetId, raterId, raterName, dto.score, raterImage).catch(() => {});
    } else if (raterType === 'client' && targetType === 'agent') {
      this.notificationService.notifyAgentRated(dto.targetId, raterId, raterName, dto.score, raterImage).catch(() => {});
    } else {
      // agent→lounge or lounge→agent
      this.notificationService.notifyRatingReceived(dto.targetId, raterId, raterName, dto.score, raterImage).catch(() => {});
    }

    logger.info(`RatingService.upsertRating: ${raterType}=${raterId} → ${targetType}=${dto.targetId} score=${dto.score}`);
    return rating;
  }

  /** Delete a user's own rating and refresh the target summary. */
  public async deleteRating(raterId: string, targetId: string): Promise<void> {
    assertObjectId(targetId, 'target');

    const deleted = await this.ratings.findOneAndDelete({ raterId, targetId });
    if (!deleted) throw new NotFoundException('Rating not found', 'RATING_NOT_FOUND');

    await this.refreshTargetSummary(targetId);
    logger.info(`RatingService.deleteRating: rater=${raterId} target=${targetId}`);
  }

  /* ───────── Queries ───────── */

  /** All ratings for a target user, newest first. */
  public async getTargetRatings(targetId: string, page = 1, limit = 20): Promise<{ ratings: Rating[]; total: number }> {
    assertObjectId(targetId, 'target');

    const [ratings, total] = await Promise.all([
      this.ratings
        .find({ targetId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(POPULATE_RATER)
        .lean(),
      this.ratings.countDocuments({ targetId }),
    ]);

    return { ratings, total };
  }

  /** Get the authenticated user's own rating for a specific target (or null). */
  public async getMyRating(raterId: string, targetId: string): Promise<Rating | null> {
    assertObjectId(targetId, 'target');
    return this.ratings.findOne({ raterId, targetId }).lean();
  }

  /* ───────── Helpers ───────── */

  /**
   * Recalculate and persist the target's averageRating and ratingCount via aggregation.
   * If there are no ratings the values reset to 0.
   */
  private async refreshTargetSummary(targetId: string): Promise<void> {
    const [summary] = await this.ratings.aggregate([
      { $match: { targetId: new mongoose.Types.ObjectId(targetId) } },
      { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
    ]);

    const averageRating = summary ? Math.round(summary.avg * 10) / 10 : 0;
    const ratingCount = summary?.count ?? 0;

    await this.users.findByIdAndUpdate(targetId, { averageRating, ratingCount });
  }
}

export default RatingService;
