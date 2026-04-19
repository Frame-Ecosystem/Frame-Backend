import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { adminMiddleware } from '@middlewares/role.middleware';
import upload from '@middlewares/imageUpload.middleware';
import ReviewController from '@controllers/marketplace/review.controller';
import { CreateReviewDto, UpdateReviewDto } from '@dtos/marketplace/review.dto';

class ReviewRoute implements Routes {
  public path = '/v1/marketplace/reviews';
  public router = Router();
  public controller = new ReviewController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Public
    this.router.get('/product/:productId', this.controller.getProductReviews);
    this.router.get('/store/:storeId', this.controller.getStoreReviews);

    // Authenticated
    this.router.post('/', authMiddleware, csrfMiddleware, validationMiddleware(CreateReviewDto, 'body'), this.controller.createReview);
    this.router.put('/:id', authMiddleware, csrfMiddleware, validationMiddleware(UpdateReviewDto, 'body'), this.controller.updateReview);
    this.router.post('/:id/images', authMiddleware, csrfMiddleware, upload.array('images', 5), this.controller.uploadReviewImages);
    this.router.delete('/:id', authMiddleware, csrfMiddleware, this.controller.deleteReview);
    this.router.post('/:id/helpful', authMiddleware, csrfMiddleware, this.controller.markHelpful);

    // Admin
    this.router.put('/admin/:id/hide', authMiddleware, adminMiddleware, csrfMiddleware, this.controller.adminHideReview);
  }
}

export default ReviewRoute;
