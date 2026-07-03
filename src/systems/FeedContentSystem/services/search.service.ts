import { escapeRegex } from '@utils/util';
import userModel from '@systems/UserManager/models/user.model';
import postModel from '@systems/FeedContentSystem/models/post.model';
import reelModel from '@systems/FeedContentSystem/models/reel.model';
import productModel from '@systems/MarketplaceSystem/models/product.model';
import storeModel from '@systems/MarketplaceSystem/models/store.model';
import hashtagModel from '@systems/FeedContentSystem/models/hashtag.model';
import serviceModel from '@systems/ServiceCatalogSystem/models/service.model';
import contentLikeModel from '@systems/FeedContentSystem/models/contentLike.model';
import contentSaveModel from '@systems/FeedContentSystem/models/contentSave.model';
import followModel from '@systems/UserManager/models/follow.model';
import { SearchType, SearchResults, SearchUserResult, SearchContentResult, SearchProductResult, SearchStoreResult, SearchHashtagResult, SearchServiceResult } from '@systems/FeedContentSystem/interfaces/search.interface';

class SearchService {
  private users = userModel;
  private posts = postModel;
  private reels = reelModel;
  private products = productModel;
  private stores = storeModel;
  private hashtags = hashtagModel;
  private services = serviceModel;
  private contentLikes = contentLikeModel;
  private contentSaves = contentSaveModel;
  private follows = followModel;

  private readonly DEFAULT_LIMIT = 10;

  public async search(query: string, type: SearchType, userId?: string): Promise<SearchResults> {
    const q = query.trim();
    const results: SearchResults = { query: q, type };

    if (!q) return results;

    switch (type) {
      case SearchType.ALL:
        const [users, lounges, posts, reels, products, stores, hashtags, services] = await Promise.all([
          this.searchUsers(q),
          this.searchLounges(q),
          this.searchPosts(q),
          this.searchReels(q),
          this.searchProducts(q),
          this.searchStores(q),
          this.searchHashtags(q),
          this.searchServices(q),
        ]);
        results.users = users;
        results.lounges = lounges;
        results.posts = posts;
        results.reels = reels;
        results.products = products;
        results.stores = stores;
        results.hashtags = hashtags;
        results.services = services;
        break;

      case SearchType.USERS:
        results.users = await this.searchUsers(q);
        break;
      case SearchType.LOUNGES:
        results.lounges = await this.searchLounges(q);
        break;
      case SearchType.POSTS:
        results.posts = await this.searchPosts(q);
        break;
      case SearchType.REELS:
        results.reels = await this.searchReels(q);
        break;
      case SearchType.PRODUCTS:
        results.products = await this.searchProducts(q);
        break;
      case SearchType.STORES:
        results.stores = await this.searchStores(q);
        break;
      case SearchType.HASHTAGS:
        results.hashtags = await this.searchHashtags(q);
        break;
      case SearchType.SERVICES:
        results.services = await this.searchServices(q);
        break;
    }

    return results;
  }

  /* ───────── Users (clients + agents) ───────── */

  private async searchUsers(q: string): Promise<{ data: SearchUserResult[]; total: number } | undefined> {
    const escaped = escapeRegex(q);
    const filter = {
      type: { $in: ['client', 'agent'] },
      isBlocked: { $ne: true },
      $or: [
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
        { agentName: { $regex: escaped, $options: 'i' } },
        { bio: { $regex: escaped, $options: 'i' } },
      ],
    };

    const [users, total] = await Promise.all([
      this.users
        .find(filter)
        .select('type firstName lastName agentName profileImage bio location followersCount')
        .sort({ followersCount: -1 })
        .limit(this.DEFAULT_LIMIT)
        .lean()
        .exec(),
      this.users.countDocuments(filter).exec(),
    ]);

    return { data: users as unknown as SearchUserResult[], total };
  }

  /* ───────── Lounges ───────── */

  private async searchLounges(q: string): Promise<{ data: SearchUserResult[]; total: number } | undefined> {
    const escaped = escapeRegex(q);
    const filter = {
      type: 'lounge',
      isBlocked: { $ne: true },
      $or: [
        { loungeTitle: { $regex: escaped, $options: 'i' } },
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
        { bio: { $regex: escaped, $options: 'i' } },
        { 'location.placeName': { $regex: escaped, $options: 'i' } },
        { 'location.address': { $regex: escaped, $options: 'i' } },
      ],
    };

    const [lounges, total] = await Promise.all([
      this.users
        .find(filter)
        .select('type loungeTitle firstName lastName profileImage bio location averageRating followersCount')
        .sort({ averageRating: -1, followersCount: -1 })
        .limit(this.DEFAULT_LIMIT)
        .lean()
        .exec(),
      this.users.countDocuments(filter).exec(),
    ]);

    return { data: lounges as unknown as SearchUserResult[], total };
  }

  /* ───────── Posts ───────── */

  private async searchPosts(q: string): Promise<{ data: SearchContentResult[]; total: number } | undefined> {
    const escaped = escapeRegex(q);
    const filter = {
      isHidden: false,
      $or: [
        { text: { $regex: escaped, $options: 'i' } },
        { hashtags: { $regex: escaped, $options: 'i' } },
      ],
    };

    const populate = { path: 'authorId', select: 'firstName lastName loungeTitle profileImage type' };

    const [posts, total] = await Promise.all([
      this.posts
        .find(filter)
        .populate(populate)
        .sort({ createdAt: -1 })
        .limit(this.DEFAULT_LIMIT)
        .lean()
        .exec(),
      this.posts.countDocuments(filter).exec(),
    ]);

    const data = posts.map(p => ({ ...p, contentType: 'post' as const })) as unknown as SearchContentResult[];
    return { data, total };
  }

  /* ───────── Reels ───────── */

  private async searchReels(q: string): Promise<{ data: SearchContentResult[]; total: number } | undefined> {
    const escaped = escapeRegex(q);
    const filter = {
      isHidden: false,
      $or: [
        { caption: { $regex: escaped, $options: 'i' } },
        { hashtags: { $regex: escaped, $options: 'i' } },
      ],
    };

    const populate = { path: 'authorId', select: 'firstName lastName loungeTitle profileImage type' };

    const [reels, total] = await Promise.all([
      this.reels
        .find(filter)
        .populate(populate)
        .sort({ createdAt: -1 })
        .limit(this.DEFAULT_LIMIT)
        .lean()
        .exec(),
      this.reels.countDocuments(filter).exec(),
    ]);

    const data = reels.map(r => ({ ...r, contentType: 'reel' as const })) as unknown as SearchContentResult[];
    return { data, total };
  }

  /* ───────── Products ───────── */

  private async searchProducts(q: string): Promise<{ data: SearchProductResult[]; total: number } | undefined> {
    const escaped = escapeRegex(q);
    const filter = {
      status: 'active',
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
      ],
    };

    const populate = { path: 'storeId', select: 'name slug' };

    const [products, total] = await Promise.all([
      this.products
        .find(filter)
        .populate(populate)
        .sort({ 'stats.totalSold': -1, createdAt: -1 })
        .limit(this.DEFAULT_LIMIT)
        .lean()
        .exec(),
      this.products.countDocuments(filter).exec(),
    ]);

    return { data: products as unknown as SearchProductResult[], total };
  }

  /* ───────── Stores ───────── */

  private async searchStores(q: string): Promise<{ data: SearchStoreResult[]; total: number } | undefined> {
    const escaped = escapeRegex(q);
    const filter = {
      status: 'active',
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { 'location.city': { $regex: escaped, $options: 'i' } },
      ],
    };

    const [stores, total] = await Promise.all([
      this.stores
        .find(filter)
        .select('name slug description logo category badge isVerified stats location')
        .sort({ 'stats.averageRating': -1, createdAt: -1 })
        .limit(this.DEFAULT_LIMIT)
        .lean()
        .exec(),
      this.stores.countDocuments(filter).exec(),
    ]);

    return { data: stores as unknown as SearchStoreResult[], total };
  }

  /* ───────── Hashtags ───────── */

  private async searchHashtags(q: string): Promise<{ data: SearchHashtagResult[]; total: number } | undefined> {
    const escaped = escapeRegex(q);
    const filter = { name: { $regex: escaped, $options: 'i' } };

    const [tags, total] = await Promise.all([
      this.hashtags
        .find(filter)
        .sort({ postCount: -1 })
        .limit(this.DEFAULT_LIMIT)
        .lean()
        .exec(),
      this.hashtags.countDocuments(filter).exec(),
    ]);

    return { data: tags as unknown as SearchHashtagResult[], total };
  }

  /* ───────── Services ───────── */

  private async searchServices(q: string): Promise<{ data: SearchServiceResult[]; total: number } | undefined> {
    const escaped = escapeRegex(q);
    const filter = {
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ],
    };

    const populate = { path: 'categoryId', select: 'name' };

    const [services, total] = await Promise.all([
      this.services
        .find(filter)
        .populate(populate)
        .sort({ name: 1 })
        .limit(this.DEFAULT_LIMIT)
        .lean()
        .exec(),
      this.services.countDocuments(filter).exec(),
    ]);

    return { data: services as unknown as SearchServiceResult[], total };
  }
}

export default SearchService;
