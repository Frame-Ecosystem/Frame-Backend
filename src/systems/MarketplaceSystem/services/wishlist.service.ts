import mongoose from 'mongoose';
import { BadRequestException, NotFoundException } from '@exceptions/HttpException';
import wishlistModel from '@systems/MarketplaceSystem/models/wishlist.model';
import productModel from '@systems/MarketplaceSystem/models/product.model';
import { Wishlist, ProductStatus } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

class WishlistService {
  private wishlists = wishlistModel;
  private products = productModel;

  public async getWishlist(userId: string, query: {
    page?: number;
    limit?: number;
  }): Promise<{ items: Wishlist[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.wishlists.find({ userId })
        .populate({
          path: 'productId',
          select: 'name slug price images stats status storeId',
          populate: { path: 'storeId', select: 'name slug' },
        })
        .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.wishlists.countDocuments({ userId }),
    ]);

    return { items, total };
  }

  public async addToWishlist(userId: string, productId: string): Promise<Wishlist> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const product = await this.products.findById(productId);
    if (!product) throw new NotFoundException('Product not found', 'PRODUCT_NOT_FOUND');

    const existing = await this.wishlists.findOne({ userId, productId });
    if (existing) return existing;

    const item = await this.wishlists.create({ userId, productId });

    // Update wishlist count stat
    await this.products.findByIdAndUpdate(productId, { $inc: { 'stats.wishlistCount': 1 } });

    return item;
  }

  public async removeFromWishlist(userId: string, productId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const result = await this.wishlists.findOneAndDelete({ userId, productId });
    if (result) {
      await this.products.findByIdAndUpdate(productId, { $inc: { 'stats.wishlistCount': -1 } });
    }
  }

  public async isInWishlist(userId: string, productId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(productId)) return false;
    return !!(await this.wishlists.exists({ userId, productId }));
  }
}

export default WishlistService;
