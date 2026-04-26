import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import { clientMiddleware } from '@middlewares/role.middleware';
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
    // Public — paginated ratings for a lounge (auth still required for consistency)
    this.router.get('/lounge/:loungeId', authMiddleware, this.ratingController.getLoungeRatings);

    // Client-only — own rating for a lounge
    this.router.get('/me/:loungeId', authMiddleware, clientMiddleware, this.ratingController.getMyRating);

    // Client-only — create or update
    this.router.put('/', authMiddleware, clientMiddleware, csrfMiddleware, validationMiddleware(UpsertRatingDto, 'body'), this.ratingController.upsertRating);

    // Client-only — delete own rating
    this.router.delete('/:loungeId', authMiddleware, clientMiddleware, csrfMiddleware, this.ratingController.deleteRating);
  }
}

export default RatingRoute;
