import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import { UpsertRatingDto } from '@systems/ServiceCatalogSystem/dtos/rating.dto';
import RatingService from '@systems/ServiceCatalogSystem/services/rating.service';
import { parsePagination } from '@utils/validators';
import { asyncHandler } from '@utils/controller';

class RatingController {
  private ratingService = new RatingService();

  /** PUT /ratings — create or update the authenticated user's rating for a target. */
  public upsertRating = asyncHandler(async (req: RequestWithUser, res) => {
    const raterId = req.user._id.toString();
    const dto: UpsertRatingDto = req.body;

    const rating = await this.ratingService.upsertRating(raterId, dto);
    res.status(200).json({ success: true, data: rating, message: 'Rating saved successfully' });
  });

  /** DELETE /ratings/:targetId — remove the authenticated user's own rating for a target. */
  public deleteRating = asyncHandler(async (req: RequestWithUser, res) => {
    const raterId = req.user._id.toString();
    const { targetId } = req.params;

    await this.ratingService.deleteRating(raterId, targetId);
    res.status(200).json({ success: true, message: 'Rating deleted successfully' });
  });

  /** GET /ratings/target/:targetId — paginated ratings for a target user (public). */
  public getTargetRatings = asyncHandler(async (req: RequestWithUser, res) => {
    const { targetId } = req.params;
    const { page, limit } = parsePagination(req);

    const { ratings, total } = await this.ratingService.getTargetRatings(targetId, page, limit);
    res.status(200).json({
      success: true,
      data: ratings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });

  /** GET /ratings/me/:targetId — the authenticated user's rating for a target. */
  public getMyRating = asyncHandler(async (req: RequestWithUser, res) => {
    const raterId = req.user._id.toString();
    const { targetId } = req.params;

    const rating = await this.ratingService.getMyRating(raterId, targetId);
    res.status(200).json({ success: true, data: rating });
  });
}

export default RatingController;
