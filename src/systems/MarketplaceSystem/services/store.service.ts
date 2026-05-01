import mongoose from 'mongoose';
import slugify from 'slugify';
import { BadRequestException, NotFoundException, ConflictException } from '@exceptions/HttpException';
import storeModel from '@systems/MarketplaceSystem/models/store.model';
import productModel from '@systems/MarketplaceSystem/models/product.model';
import { Store, StoreStatus } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';
import { CreateStoreDto, UpdateStoreDto } from '@systems/MarketplaceSystem/dtos/store.dto';
import cloudflareR2Service from '@shared/services/cloudflareR2.service';

class StoreService {
  private stores = storeModel;
  private products = productModel;

  /* ───────── Slug helper ───────── */

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true });
    let slug = base;
    let counter = 0;
    while (await this.stores.exists({ slug })) {
      counter++;
      slug = `${base}-${counter}`;
    }
    return slug;
  }

  /* ───────── Create ───────── */

  public async createStore(ownerId: string, dto: CreateStoreDto): Promise<Store> {
    const existingStore = await this.stores.findOne({ ownerId, status: { $ne: StoreStatus.CLOSED } });
    if (existingStore) throw new ConflictException('You already have an active store');

    const slug = await this.generateUniqueSlug(dto.name);

    const store = await this.stores.create({
      ...dto,
      ownerId,
      slug,
      status: StoreStatus.PENDING,
    });

    return store;
  }

  /* ───────── Read ───────── */

  public async getStoreById(id: string): Promise<Store> {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid store ID', 'INVALID_STORE_ID');
    const store = await this.stores.findById(id).populate('ownerId', 'firstName lastName profileImage type');
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');
    return store;
  }

  public async getStoreBySlug(slug: string): Promise<Store> {
    const store = await this.stores.findOne({ slug, status: StoreStatus.ACTIVE }).populate('ownerId', 'firstName lastName profileImage type');
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');
    return store;
  }

  public async getMyStore(ownerId: string): Promise<Store> {
    const store = await this.stores.findOne({ ownerId, status: { $ne: StoreStatus.CLOSED } });
    if (!store) throw new NotFoundException('You do not have a store', 'NO_STORE');
    return store;
  }

  public async discoverStores(query: {
    page?: number;
    limit?: number;
    category?: string;
    city?: string;
    search?: string;
    sort?: string;
  }): Promise<{ stores: Store[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { status: StoreStatus.ACTIVE };

    if (query.category) filter.category = query.category;
    if (query.city) filter['location.city'] = { $regex: query.city, $options: 'i' };
    if (query.search) filter.$text = { $search: query.search };

    let sortOption: any = { createdAt: -1 };
    if (query.sort === 'rating') sortOption = { 'stats.averageRating': -1 };
    if (query.sort === 'orders') sortOption = { 'stats.totalOrders': -1 };
    if (query.sort === 'newest') sortOption = { createdAt: -1 };

    const [stores, total] = await Promise.all([
      this.stores.find(filter).populate('ownerId', 'firstName lastName profileImage type').sort(sortOption).skip(skip).limit(limit).lean(),
      this.stores.countDocuments(filter),
    ]);

    return { stores, total };
  }

  /* ───────── Update ───────── */

  public async updateStore(ownerId: string, dto: UpdateStoreDto): Promise<Store> {
    const store = await this.stores.findOne({ ownerId, status: { $ne: StoreStatus.CLOSED } });
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');

    if (dto.name && dto.name !== store.name) {
      (dto as any).slug = await this.generateUniqueSlug(dto.name);
    }

    Object.assign(store, dto);
    await store.save();
    return store;
  }

  public async uploadStoreLogo(ownerId: string, fileBuffer: Buffer): Promise<Store> {
    const store = await this.stores.findOne({ ownerId, status: { $ne: StoreStatus.CLOSED } });
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');

    if (store.logo?.publicId) {
      await cloudflareR2Service.deleteImage(store.logo.publicId).catch(() => {});
    }

    const result = await cloudflareR2Service.uploadStoreLogo(fileBuffer, store._id.toString());
    store.logo = result;
    await store.save();
    return store;
  }

  public async uploadStoreBanner(ownerId: string, fileBuffer: Buffer): Promise<Store> {
    const store = await this.stores.findOne({ ownerId, status: { $ne: StoreStatus.CLOSED } });
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');

    if (store.banner?.publicId) {
      await cloudflareR2Service.deleteImage(store.banner.publicId).catch(() => {});
    }

    const result = await cloudflareR2Service.uploadStoreBanner(fileBuffer, store._id.toString());
    store.banner = result;
    await store.save();
    return store;
  }

  public async closeStore(ownerId: string): Promise<void> {
    const store = await this.stores.findOne({ ownerId, status: { $ne: StoreStatus.CLOSED } });
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');

    // Archive all active products
    await this.products.updateMany({ storeId: store._id, status: { $ne: 'archived' } }, { $set: { status: 'archived' } });

    store.status = StoreStatus.CLOSED;
    await store.save();
  }

  /* ───────── Admin ───────── */

  public async adminGetStores(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{ stores: Store[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.search) filter.$text = { $search: query.search };

    const [stores, total] = await Promise.all([
      this.stores.find(filter).populate('ownerId', 'firstName lastName email type').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.stores.countDocuments(filter),
    ]);

    return { stores, total };
  }

  public async adminUpdateStoreStatus(storeId: string, status: StoreStatus, _reason?: string): Promise<Store> {
    if (!mongoose.Types.ObjectId.isValid(storeId)) throw new BadRequestException('Invalid store ID', 'INVALID_STORE_ID');

    const store = await this.stores.findById(storeId);
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');

    store.status = status;
    if (status === StoreStatus.ACTIVE) store.isVerified = true;
    if (status === StoreStatus.SUSPENDED) {
      await this.products.updateMany({ storeId: store._id, status: 'active' }, { $set: { status: 'hidden' } });
    }

    await store.save();
    return store;
  }

  public async adminVerifyStore(storeId: string, badge: string): Promise<Store> {
    if (!mongoose.Types.ObjectId.isValid(storeId)) throw new BadRequestException('Invalid store ID', 'INVALID_STORE_ID');

    const store = await this.stores.findById(storeId);
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');

    store.isVerified = true;
    store.badge = badge as any;
    await store.save();
    return store;
  }
}

export default StoreService;
