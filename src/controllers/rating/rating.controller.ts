import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@interfaces/auth/auth.interface';
import { UpsertRatingDto } from '@dtos/rating/rating.dto';
import RatingService from '@services/rating/rating.service';
import { parsePagination } from '@utils/validators';
import { logger } from '@utils/logger';

class RatingController {
  private ratingService = new RatingService();

  /** PUT /ratings — create or update the authenticated client's rating for a lounge. */
  public upsertRating = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const clientId = req.user._id.toString();
      const dto: UpsertRatingDto = req.body;

      const rating = await this.ratingService.upsertRating(clientId, dto);
      res.status(200).json({ success: true, data: rating, message: 'Rating saved successfully' });
    } catch (error: any) {
      logger.error(`Error in upsertRating: ${error.message}`);
      next(error);
    }
  };

  /** DELETE /ratings/:loungeId — remove the authenticated client's rating for a lounge. */
  public deleteRating = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const clientId = req.user._id.toString();
      const { loungeId } = req.params;

      await this.ratingService.deleteRating(clientId, loungeId);
      res.status(200).json({ success: true, message: 'Rating deleted successfully' });
    } catch (error: any) {
      logger.error(`Error in deleteRating: ${error.message}`);
      next(error);
    }
  };

  /** GET /ratings/lounge/:loungeId — paginated ratings for a lounge (public). */
  public getLoungeRatings = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { loungeId } = req.params;
      const { page, limit } = parsePagination(req);

      const { ratings, total } = await this.ratingService.getLoungeRatings(loungeId, page, limit);
      res.status(200).json({
        success: true,
        data: ratings,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        message: 'Lounge ratings retrieved successfully',
      });
    } catch (error: any) {
      logger.error(`Error in getLoungeRatings: ${error.message}`);
      next(error);
    }
  };

  /** GET /ratings/me/:loungeId — the authenticated client's rating for a lounge. */
  public getMyRating = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const clientId = req.user._id.toString();
      const { loungeId } = req.params;

      const rating = await this.ratingService.getMyRating(clientId, loungeId);
      res.status(200).json({ success: true, data: rating, message: rating ? 'Rating found' : 'No rating yet' });
    } catch (error: any) {
      logger.error(`Error in getMyRating: ${error.message}`);
      next(error);
    }
  };
}

export default RatingController;
