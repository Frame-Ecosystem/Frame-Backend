import mongoose from 'mongoose';
import { BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@exceptions/HttpException';
import reviewModel from '@models/marketplace/review.model';
import productModel from '@models/marketplace/product.model';
import storeModel from '@models/marketplace/store.model';
import orderModel from '@models/marketplace/order.model';
import { ProductReview, ReviewStatus, OrderStatus } from '@interfaces/marketplace/marketplace.interface';
import { CreateReviewDto, UpdateReviewDto } from '@dtos/marketplace/review.dto';
import cloudflareR2Service from '@services/shared/cloudflareR2.service';

class ReviewService {
  private reviews = reviewModel;
  private products = productModel;
  private stores = storeModel;
  private orders = orderModel;

  /* ───────── Recalculate rating ───────── */

  private async recalculateRatings(productId: string, storeId: string): Promise<void> {
    const productStats = await this.reviews.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), status: ReviewStatus.ACTIVE } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    const pAvg = productStats[0]?.avg || 0;
    const pCount = productStats[0]?.count || 0;
    await this.products.findByIdAndUpdate(productId, {
      $set: { 'stats.averageRating': Math.round(pAvg * 10) / 10, 'stats.ratingCount': pCount },
    });

    const storeStats = await this.reviews.aggregate([
      { $match: { storeId: new mongoose.Types.ObjectId(storeId), status: ReviewStatus.ACTIVE } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    const sAvg = storeStats[0]?.avg || 0;
    const sCount = storeStats[0]?.count || 0;
    await this.stores.findByIdAndUpdate(storeId, {
      $set: { 'stats.averageRating': Math.round(sAvg * 10) / 10, 'stats.ratingCount': sCount },
    });
  }

  /* ───────── Create ───────── */

  public async createReview(userId: string, dto: CreateReviewDto): Promise<ProductReview> {
    if (!mongoose.Types.ObjectId.isValid(dto.productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');
    if (!mongoose.Types.ObjectId.isValid(dto.orderId)) throw new BadRequestException('Invalid order ID', 'INVALID_ORDER_ID');

    // Verify product exists
    const product = await this.products.findById(dto.productId);
    if (!product) throw new NotFoundException('Product not found', 'PRODUCT_NOT_FOUND');

    // Check for duplicate review
    const existingReview = await this.reviews.findOne({ productId: dto.productId, userId });
    if (existingReview) throw new ConflictException('You already reviewed this product');

    // Verify the user bought this product (verified purchase)
    const order = await this.orders.findOne({
      _id: dto.orderId,
      buyerId: userId,
      status: OrderStatus.DELIVERED,
      'items.productId': dto.productId,
    });

    const isVerifiedPurchase = !!order;

    const review = await this.reviews.create({
      productId: dto.productId,
      storeId: product.storeId,
      userId,
      orderId: dto.orderId,
      rating: dto.rating,
      title: dto.title || '',
      comment: dto.comment || '',
      isVerifiedPurchase,
    });

    await this.recalculateRatings(dto.productId, product.storeId.toString());

    return review;
  }

  /* ───────── Read ───────── */

  public async getProductReviews(productId: string, query: {
    page?: number;
    limit?: number;
    sort?: string;
  }): Promise<{ reviews: ProductReview[]; total: number }> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { productId, status: ReviewStatus.ACTIVE };

    let sortOption: any = { createdAt: -1 };
    if (query.sort === 'rating_asc') sortOption = { rating: 1 };
    if (query.sort === 'rating_desc') sortOption = { rating: -1 };
    if (query.sort === 'helpful') sortOption = { helpfulCount: -1 };

    const [reviews, total] = await Promise.all([
      this.reviews.find(filter).populate('userId', 'firstName lastName profileImage').sort(sortOption).skip(skip).limit(limit).lean(),
      this.reviews.countDocuments(filter),
    ]);

    return { reviews, total };
  }

  public async getStoreReviews(storeId: string, query: {
    page?: number;
    limit?: number;
  }): Promise<{ reviews: ProductReview[]; total: number }> {
    if (!mongoose.Types.ObjectId.isValid(storeId)) throw new BadRequestException('Invalid store ID', 'INVALID_STORE_ID');

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.reviews.find({ storeId, status: ReviewStatus.ACTIVE })
        .populate('userId', 'firstName lastName profileImage')
        .populate('productId', 'name slug images')
        .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.reviews.countDocuments({ storeId, status: ReviewStatus.ACTIVE }),
    ]);

    return { reviews, total };
  }

  /* ───────── Update ───────── */

  public async updateReview(userId: string, reviewId: string, dto: UpdateReviewDto): Promise<ProductReview> {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) throw new BadRequestException('Invalid review ID', 'INVALID_REVIEW_ID');

    const review = await this.reviews.findById(reviewId);
    if (!review) throw new NotFoundException('Review not found', 'REVIEW_NOT_FOUND');
    if (review.userId.toString() !== userId) throw new ForbiddenException('You can only edit your own reviews');

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.title !== undefined) review.title = dto.title;
    if (dto.comment !== undefined) review.comment = dto.comment;

    await review.save();
    await this.recalculateRatings(review.productId.toString(), review.storeId.toString());

    return review;
  }

  public async uploadReviewImages(userId: string, reviewId: string, files: Express.Multer.File[]): Promise<ProductReview> {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) throw new BadRequestException('Invalid review ID', 'INVALID_REVIEW_ID');

    const review = await this.reviews.findById(reviewId);
    if (!review) throw new NotFoundException('Review not found', 'REVIEW_NOT_FOUND');
    if (review.userId.toString() !== userId) throw new ForbiddenException('You can only edit your own reviews');

    if (review.images.length + files.length > 5) {
      throw new BadRequestException('Maximum 5 images per review', 'MAX_IMAGES_EXCEEDED');
    }

    const uploadPromises = files.map(f => cloudflareR2Service.uploadReviewImage(f.buffer, reviewId));
    const results = await Promise.all(uploadPromises);

    const newImages = results.map(r => ({ url: r.url, publicId: r.publicId }));
    review.images.push(...(newImages as any));
    await review.save();

    return review;
  }

  /* ───────── Delete ───────── */

  public async deleteReview(userId: string, reviewId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) throw new BadRequestException('Invalid review ID', 'INVALID_REVIEW_ID');

    const review = await this.reviews.findById(reviewId);
    if (!review) throw new NotFoundException('Review not found', 'REVIEW_NOT_FOUND');
    if (review.userId.toString() !== userId) throw new ForbiddenException('You can only delete your own reviews');

    for (const img of review.images) {
      await cloudflareR2Service.deleteImage((img as any).publicId).catch(() => {});
    }

    const { productId, storeId } = review;
    await review.deleteOne();
    await this.recalculateRatings(productId.toString(), storeId.toString());
  }

  /* ───────── Helpful ───────── */

  public async markHelpful(reviewId: string): Promise<ProductReview> {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) throw new BadRequestException('Invalid review ID', 'INVALID_REVIEW_ID');

    const review = await this.reviews.findByIdAndUpdate(
      reviewId,
      { $inc: { helpfulCount: 1 } },
      { new: true },
    );
    if (!review) throw new NotFoundException('Review not found', 'REVIEW_NOT_FOUND');
    return review;
  }

  /* ───────── Admin ───────── */

  public async adminHideReview(reviewId: string): Promise<ProductReview> {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) throw new BadRequestException('Invalid review ID', 'INVALID_REVIEW_ID');

    const review = await this.reviews.findById(reviewId);
    if (!review) throw new NotFoundException('Review not found', 'REVIEW_NOT_FOUND');

    review.status = ReviewStatus.HIDDEN;
    await review.save();
    await this.recalculateRatings(review.productId.toString(), review.storeId.toString());

    return review;
  }
}

export default ReviewService;
