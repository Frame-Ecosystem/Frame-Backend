import mongoose from 'mongoose';
import slugify from 'slugify';
import { BadRequestException, NotFoundException, ForbiddenException } from '@exceptions/HttpException';
import productModel from '@systems/MarketplaceSystem/models/product.model';
import storeModel from '@systems/MarketplaceSystem/models/store.model';
import wishlistModel from '@systems/MarketplaceSystem/models/wishlist.model';
import { Product, ProductStatus, StoreStatus } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';
import { CreateProductDto, UpdateProductDto } from '@systems/MarketplaceSystem/dtos/product.dto';
import cloudflareR2Service from '@shared/services/cloudflareR2.service';

class ProductService {
  private products = productModel;
  private stores = storeModel;
  private wishlists = wishlistModel;

  /* ───────── Slug helper ───────── */

  private async generateUniqueSlug(name: string, storeId: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true });
    let slug = base;
    let counter = 0;
    while (await this.products.exists({ slug, storeId })) {
      counter++;
      slug = `${base}-${counter}`;
    }
    return slug;
  }

  /* ───────── Ownership check ───────── */

  private async verifyStoreOwnership(storeId: string, ownerId: string): Promise<void> {
    const store = await this.stores.findById(storeId);
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');
    if (store.ownerId.toString() !== ownerId) throw new ForbiddenException('You do not own this store');
    if (store.status === StoreStatus.SUSPENDED) throw new ForbiddenException('Store is suspended');
    if (store.status === StoreStatus.CLOSED) throw new ForbiddenException('Store is closed');
  }

  /* ───────── Create ───────── */

  public async createProduct(ownerId: string, dto: CreateProductDto): Promise<Product> {
    await this.verifyStoreOwnership(dto.storeId, ownerId);

    const slug = await this.generateUniqueSlug(dto.name, dto.storeId);

    const totalStock = dto.variants?.length
      ? dto.variants.reduce((sum, v) => sum + v.stock, 0)
      : dto.stock || 0;

    const product = await this.products.create({
      ...dto,
      slug,
      stock: totalStock,
      status: ProductStatus.DRAFT,
    });

    await this.stores.findByIdAndUpdate(dto.storeId, { $inc: { 'stats.totalProducts': 1 } });

    return product;
  }

  /* ───────── Read ───────── */

  public async getProductById(id: string): Promise<Product> {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');
    const product = await this.products.findById(id).populate('storeId', 'name slug logo ownerId status');
    if (!product) throw new NotFoundException('Product not found', 'PRODUCT_NOT_FOUND');

    // Increment view count (fire-and-forget)
    this.products.findByIdAndUpdate(id, { $inc: { 'stats.viewCount': 1 } }).exec();

    return product;
  }

  public async getStoreProducts(storeId: string, query: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    sort?: string;
  }): Promise<{ products: Product[]; total: number }> {
    if (!mongoose.Types.ObjectId.isValid(storeId)) throw new BadRequestException('Invalid store ID', 'INVALID_STORE_ID');

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { storeId };
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;

    let sortOption: any = { createdAt: -1 };
    if (query.sort === 'price_asc') sortOption = { price: 1 };
    if (query.sort === 'price_desc') sortOption = { price: -1 };
    if (query.sort === 'popular') sortOption = { 'stats.totalSold': -1 };
    if (query.sort === 'rating') sortOption = { 'stats.averageRating': -1 };

    const [products, total] = await Promise.all([
      this.products.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
      this.products.countDocuments(filter),
    ]);

    return { products, total };
  }

  public async discoverProducts(query: {
    page?: number;
    limit?: number;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: string;
    tags?: string;
    search?: string;
    sort?: string;
  }): Promise<{ products: Product[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { status: ProductStatus.ACTIVE };

    if (query.category) filter.category = query.category;
    if (query.condition) filter.condition = query.condition;
    if (query.minPrice || query.maxPrice) {
      filter.price = {};
      if (query.minPrice) filter.price.$gte = query.minPrice;
      if (query.maxPrice) filter.price.$lte = query.maxPrice;
    }
    if (query.tags) filter.tags = { $in: query.tags.split(',').map(t => t.trim()) };
    if (query.search) filter.$text = { $search: query.search };

    let sortOption: any = { createdAt: -1 };
    if (query.sort === 'price_asc') sortOption = { price: 1 };
    if (query.sort === 'price_desc') sortOption = { price: -1 };
    if (query.sort === 'popular') sortOption = { 'stats.totalSold': -1 };
    if (query.sort === 'rating') sortOption = { 'stats.averageRating': -1 };
    if (query.sort === 'newest') sortOption = { createdAt: -1 };

    const [products, total] = await Promise.all([
      this.products.find(filter).populate('storeId', 'name slug logo').sort(sortOption).skip(skip).limit(limit).lean(),
      this.products.countDocuments(filter),
    ]);

    return { products, total };
  }

  /* ───────── Update ───────── */

  public async updateProduct(ownerId: string, productId: string, dto: UpdateProductDto): Promise<Product> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const product = await this.products.findById(productId);
    if (!product) throw new NotFoundException('Product not found', 'PRODUCT_NOT_FOUND');

    await this.verifyStoreOwnership(product.storeId.toString(), ownerId);

    if (dto.name && dto.name !== product.name) {
      (dto as any).slug = await this.generateUniqueSlug(dto.name, product.storeId.toString());
    }

    if (dto.variants?.length) {
      (dto as any).stock = dto.variants.reduce((sum, v) => sum + v.stock, 0);
    }

    Object.assign(product, dto);
    await product.save();
    return product;
  }

  public async uploadProductImages(ownerId: string, productId: string, files: Express.Multer.File[]): Promise<Product> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const product = await this.products.findById(productId);
    if (!product) throw new NotFoundException('Product not found', 'PRODUCT_NOT_FOUND');
    await this.verifyStoreOwnership(product.storeId.toString(), ownerId);

    if (product.images.length + files.length > 10) {
      throw new BadRequestException('Maximum 10 images per product', 'MAX_IMAGES_EXCEEDED');
    }

    const uploadPromises = files.map(f => cloudflareR2Service.uploadProductImage(f.buffer, productId));
    const results = await Promise.all(uploadPromises);

    const newImages = results.map((r, i) => ({
      url: r.url,
      publicId: r.publicId,
      isPrimary: product.images.length === 0 && i === 0,
    }));

    product.images.push(...newImages);
    await product.save();
    return product;
  }

  public async deleteProductImage(ownerId: string, productId: string, publicId: string): Promise<Product> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const product = await this.products.findById(productId);
    if (!product) throw new NotFoundException('Product not found', 'PRODUCT_NOT_FOUND');
    await this.verifyStoreOwnership(product.storeId.toString(), ownerId);

    const imageIndex = product.images.findIndex((img: any) => img.publicId === publicId);
    if (imageIndex === -1) throw new NotFoundException('Image not found', 'IMAGE_NOT_FOUND');

    await cloudflareR2Service.deleteImage(publicId).catch(() => {});
    product.images.splice(imageIndex, 1);

    // Ensure at least one primary image
    if (product.images.length > 0 && !product.images.some((img: any) => img.isPrimary)) {
      (product.images[0] as any).isPrimary = true;
    }

    await product.save();
    return product;
  }

  public async deleteProduct(ownerId: string, productId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const product = await this.products.findById(productId);
    if (!product) throw new NotFoundException('Product not found', 'PRODUCT_NOT_FOUND');
    await this.verifyStoreOwnership(product.storeId.toString(), ownerId);

    // Delete all images from R2
    for (const img of product.images) {
      await cloudflareR2Service.deleteImage((img as any).publicId).catch(() => {});
    }

    // Remove from wishlists
    await this.wishlists.deleteMany({ productId });

    await product.deleteOne();
    await this.stores.findByIdAndUpdate(product.storeId, { $inc: { 'stats.totalProducts': -1 } });
  }

  /* ───────── Admin ───────── */

  public async adminUpdateProductStatus(productId: string, status: string, reason?: string): Promise<Product> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const product = await this.products.findById(productId);
    if (!product) throw new NotFoundException('Product not found', 'PRODUCT_NOT_FOUND');

    product.status = status as ProductStatus;
    await product.save();
    return product;
  }

  public async adminGetProducts(query: {
    page?: number;
    limit?: number;
    status?: string;
    storeId?: string;
    search?: string;
  }): Promise<{ products: Product[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.storeId) filter.storeId = query.storeId;
    if (query.search) filter.$text = { $search: query.search };

    const [products, total] = await Promise.all([
      this.products.find(filter).populate('storeId', 'name slug ownerId').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.products.countDocuments(filter),
    ]);

    return { products, total };
  }
}

export default ProductService;
