import { Response, NextFunction } from 'express';
import { RequestWithUser } from '@interfaces/auth/auth.interface';
import ReviewService from '@services/marketplace/review.service';

class ReviewController {
  private reviewService = new ReviewService();

  /* ───────── Public ───────── */

  public getProductReviews = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { reviews, total } = await this.reviewService.getProductReviews(req.params.productId, req.query as any);
      res.status(200).json({ data: reviews, count: total, message: 'Reviews retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public getStoreReviews = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { reviews, total } = await this.reviewService.getStoreReviews(req.params.storeId, req.query as any);
      res.status(200).json({ data: reviews, count: total, message: 'Reviews retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /* ───────── Authenticated ───────── */

  public createReview = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const review = await this.reviewService.createReview(req.user._id.toString(), req.body);
      res.status(201).json({ data: review, message: 'Review created' });
    } catch (error) {
      next(error);
    }
  };

  public updateReview = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const review = await this.reviewService.updateReview(req.user._id.toString(), req.params.id, req.body);
      res.status(200).json({ data: review, message: 'Review updated' });
    } catch (error) {
      next(error);
    }
  };

  public uploadReviewImages = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !(req.files as Express.Multer.File[]).length) {
        return res.status(400).json({ message: 'No files provided' });
      }
      const review = await this.reviewService.uploadReviewImages(
        req.user._id.toString(),
        req.params.id,
        req.files as Express.Multer.File[],
      );
      res.status(200).json({ data: review, message: 'Images uploaded' });
    } catch (error) {
      next(error);
    }
  };

  public deleteReview = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      await this.reviewService.deleteReview(req.user._id.toString(), req.params.id);
      res.status(200).json({ message: 'Review deleted' });
    } catch (error) {
      next(error);
    }
  };

  public markHelpful = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const review = await this.reviewService.markHelpful(req.params.id);
      res.status(200).json({ data: review, message: 'Marked as helpful' });
    } catch (error) {
      next(error);
    }
  };

  /* ───────── Admin ───────── */

  public adminHideReview = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const review = await this.reviewService.adminHideReview(req.params.id);
      res.status(200).json({ data: review, message: 'Review hidden' });
    } catch (error) {
      next(error);
    }
  };
}

export default ReviewController;
