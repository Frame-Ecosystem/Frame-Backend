import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import { adminOrLoungeOrClientOrAgentMiddleware } from '@middlewares/role.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { UpsertRatingDto } from '@systems/ServiceCatalogSystem/dtos/rating.dto';
import RatingController from '@systems/ServiceCatalogSystem/controllers/rating.controller';

class RatingRoute implements Routes {
  public path = '/v1/ratings';
  public router = Router();
  public ratingController = new RatingController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @route   PUT /v1/ratings
     * @desc    Create or update the authenticated user's rating for a target (client, lounge, or agent)
     * @access  Private (Client, Lounge, or Agent) — rate-limited
     */
    this.router.put(
      '/',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      csrfMiddleware,
      validationMiddleware(UpsertRatingDto, 'body'),
      this.ratingController.upsertRating,
    );

    /**
     * @route   DELETE /v1/ratings/:targetId
     * @desc    Delete the authenticated user's own rating for a target
     * @access  Private (Client, Lounge, or Agent)
     */
    this.router.delete('/:targetId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, csrfMiddleware, this.ratingController.deleteRating);

    /**
     * @route   GET /v1/ratings/target/:targetId
     * @desc    Paginated ratings for a target user (lounge or agent)
     * @access  Private (all authenticated users)
     */
    this.router.get('/target/:targetId', authMiddleware, this.ratingController.getTargetRatings);

    /**
     * @route   GET /v1/ratings/me/:targetId
     * @desc    The authenticated user's own rating for a target
     * @access  Private (Client, Lounge, or Agent)
     */
    this.router.get('/me/:targetId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.ratingController.getMyRating);
  }
}

export default RatingRoute;
