import postModel from '@systems/FeedContentSystem/models/post.model';
import reelModel from '@systems/FeedContentSystem/models/reel.model';
import followModel from '@systems/UserManager/models/follow.model';
import contentSaveModel from '@systems/FeedContentSystem/models/contentSave.model';
import contentLikeModel from '@systems/FeedContentSystem/models/contentLike.model';
import hashtagModel from '@systems/FeedContentSystem/models/hashtag.model';
import reportModel from '@systems/FeedContentSystem/models/report.model';
import { assertObjectId } from '@utils/validators';
import { NotFoundException } from '@exceptions/HttpException';

class FeedService {
  private posts = postModel;
  private reels = reelModel;
  private follows = followModel;
  private contentSaves = contentSaveModel;
  private contentLikes = contentLikeModel;
  private hashtags = hashtagModel;
  private reports = reportModel;

  /* ───────── Following Feed ───────── */

  public async getFollowingFeed(userId: string, page: number, limit: number, seed?: number) {
    assertObjectId(userId, 'User');
    const skip = (page - 1) * limit;
    const usedSeed = seed ?? Math.floor(Math.random() * 2147483647);

    // Get IDs of users this person follows
    const followDocs = await this.follows.find({ followerId: userId }).select('followingId').lean().exec();
    const followingIds = followDocs.map(f => f.followingId);

    if (!followingIds.length) return { items: [], total: 0, page, limit, seed: usedSeed };

    const filter = { authorId: { $in: followingIds }, isHidden: false };
    const populate = { path: 'authorId', select: 'firstName lastName loungeTitle profileImage type' };

    const [posts, reels] = await Promise.all([
      this.posts.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
      this.reels.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
    ]);

    // Merge + randomize with seeded shuffle
    const merged = [...posts.map(p => ({ ...p, contentType: 'post' as const })), ...reels.map(r => ({ ...r, contentType: 'reel' as const }))];
    const shuffled = this.seededShuffle(merged, usedSeed);

    const total = shuffled.length;
    const items = shuffled.slice(skip, skip + limit);

    // Attach interaction state
    const enriched = await this.enrichItems(items, userId);

    return { items: enriched, total, page, limit, seed: usedSeed };
  }

  /* ───────── Explore Feed ───────── */

  public async getExploreFeed(userId: string | undefined, page: number, limit: number, seed?: number) {
    const skip = (page - 1) * limit;
    const usedSeed = seed ?? Math.floor(Math.random() * 2147483647);

    const filter = { isHidden: false };
    const populate = { path: 'authorId', select: 'firstName lastName loungeTitle profileImage type' };

    const [posts, reels] = await Promise.all([
      this.posts.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
      this.reels.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
    ]);

    // Merge + engagement-weighted random shuffle
    const merged = [...posts.map(p => ({ ...p, contentType: 'post' as const })), ...reels.map(r => ({ ...r, contentType: 'reel' as const }))];
    const shuffled = this.weightedShuffle(merged, usedSeed);

    const total = shuffled.length;
    const items = shuffled.slice(skip, skip + limit);

    const enriched = userId ? await this.enrichItems(items, userId) : items;
    return { items: enriched, total, page, limit, seed: usedSeed };
  }

  /* ───────── Hashtag Feed ───────── */

  public async getHashtagFeed(tag: string, userId: string | undefined, page: number, limit: number, seed?: number) {
    const normalised = tag.toLowerCase().replace(/^#/, '').trim();
    if (!normalised) throw new NotFoundException('Hashtag not found', 'HASHTAG_NOT_FOUND');

    const skip = (page - 1) * limit;
    const usedSeed = seed ?? Math.floor(Math.random() * 2147483647);
    const filter = { hashtags: normalised, isHidden: false };
    const populate = { path: 'authorId', select: 'firstName lastName loungeTitle profileImage type' };

    const [posts, reels] = await Promise.all([
      this.posts.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
      this.reels.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
    ]);

    const merged = [...posts.map(p => ({ ...p, contentType: 'post' as const })), ...reels.map(r => ({ ...r, contentType: 'reel' as const }))];
    const shuffled = this.seededShuffle(merged, usedSeed);

    const total = shuffled.length;
    const items = shuffled.slice(skip, skip + limit);

    const enriched = userId ? await this.enrichItems(items, userId) : items;
    return { items: enriched, total, page, limit, seed: usedSeed };
  }

  /* ───────── Saved Content ───────── */

  public async getSavedContent(userId: string, page: number, limit: number) {
    assertObjectId(userId, 'User');
    const skip = (page - 1) * limit;

    const filter = { userId, targetType: { $in: ['post', 'reel'] } };
    const [saves, total] = await Promise.all([
      this.contentSaves.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.contentSaves.countDocuments(filter).exec(),
    ]);

    // Resolve each saved item
    const items = await Promise.all(
      saves.map(async save => {
        const id = save.targetId.toString();
        const populate = { path: 'authorId', select: 'firstName lastName loungeTitle profileImage type' };

        if (save.targetType === 'post') {
          const post = await this.posts.findById(id).populate(populate).lean().exec();
          return post && !post.isHidden ? { ...post, contentType: 'post' as const, isSaved: true } : null;
        } else {
          const reel = await this.reels.findById(id).populate(populate).lean().exec();
          return reel && !reel.isHidden ? { ...reel, contentType: 'reel' as const, isSaved: true } : null;
        }
      }),
    );

    return { items: items.filter(Boolean), total, page, limit };
  }

  /* ───────── Trending Hashtags ───────── */

  public async getTrendingHashtags(limit: number) {
    const tags = await this.hashtags
      .find({ postCount: { $gt: 0 } })
      .sort({ postCount: -1 })
      .limit(limit)
      .lean()
      .exec();
    return tags;
  }

  /* ───────── Search Hashtags ───────── */

  public async searchHashtags(query: string, limit: number) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tags = await this.hashtags
      .find({ name: { $regex: escaped, $options: 'i' } })
      .sort({ postCount: -1 })
      .limit(limit)
      .lean()
      .exec();
    return tags;
  }

  /* ───────── Private ───────── */

  /** Mulberry32 seeded PRNG — deterministic random from a given seed */
  private mulberry32(seed: number): () => number {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Fisher-Yates shuffle driven by a seeded PRNG for reproducible order */
  private seededShuffle<T>(arr: T[], seed: number): T[] {
    const shuffled = [...arr];
    const rng = this.mulberry32(seed);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /** Engagement-weighted shuffle — high-engagement items float up probabilistically */
  private weightedShuffle<T extends Record<string, any>>(arr: T[], seed: number): T[] {
    const rng = this.mulberry32(seed);
    const weighted = arr.map(item => {
      const engagement = (item.likeCount || 0) + (item.commentCount || 0);
      // Random score biased by log-scaled engagement
      const score = rng() + Math.log1p(engagement) * 0.3;
      return { item, score };
    });
    weighted.sort((a, b) => b.score - a.score);
    return weighted.map(w => w.item);
  }

  private async enrichItems(items: any[], userId: string) {
    return Promise.all(
      items.map(async item => {
        const id = item._id.toString();
        const type = item.contentType === 'post' ? 'post' : 'reel';
        const [liked, saved] = await Promise.all([
          this.contentLikes.exists({ userId, targetId: id, targetType: type }).lean(),
          this.contentSaves.exists({ userId, targetId: id, targetType: type }).lean(),
        ]);
        return { ...item, isLiked: !!liked, isSaved: !!saved };
      }),
    );
  }
}

export default FeedService;
