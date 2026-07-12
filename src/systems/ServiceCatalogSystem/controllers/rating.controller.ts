import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import { UpsertRatingDto } from '@systems/ServiceCatalogSystem/dtos/rating.dto';
import RatingService from '@systems/ServiceCatalogSystem/services/rating.service';
import { parsePagination } from '@utils/validators';
import { logger } from '@utils/logger';

class RatingController {
  private ratingService = new RatingService();

  /** PUT /ratings — create or update the authenticated user's rating for a target. */
  public upsertRating = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const raterId = req.user._id.toString();
      const dto: UpsertRatingDto = req.body;

      const rating = await this.ratingService.upsertRating(raterId, dto);
      res.status(200).json({ success: true, data: rating, message: 'Rating saved successfully' });
    } catch (error: any) {
      logger.error(`Error in upsertRating: ${error.message}`);
      next(error);
    }
  };

  /** DELETE /ratings/:targetId — remove the authenticated user's rating for a target. */
  public deleteRating = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const raterId = req.user._id.toString();
      const { targetId } = req.params;

      await this.ratingService.deleteRating(raterId, targetId);
      res.status(200).json({ success: true, message: 'Rating deleted successfully' });
    } catch (error: any) {
      logger.error(`Error in deleteRating: ${error.message}`);
      next(error);
    }
  };

  /** GET /ratings/target/:targetId — paginated ratings for a target user (public). */
  public getTargetRatings = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
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
        message: 'Ratings retrieved successfully',
      });
    } catch (error: any) {
      logger.error(`Error in getTargetRatings: ${error.message}`);
      next(error);
    }
  };

  /** GET /ratings/me/:targetId — the authenticated user's rating for a target. */
  public getMyRating = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const raterId = req.user._id.toString();
      const { targetId } = req.params;

      const rating = await this.ratingService.getMyRating(raterId, targetId);
      res.status(200).json({ success: true, data: rating, message: rating ? 'Rating found' : 'No rating yet' });
    } catch (error: any) {
      logger.error(`Error in getMyRating: ${error.message}`);
      next(error);
    }
  };
}

export default RatingController;
