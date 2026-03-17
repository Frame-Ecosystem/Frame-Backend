import postModel from '@models/content/post.model';
import reelModel from '@models/content/reel.model';
import followModel from '@models/follow/follow.model';
import contentSaveModel from '@models/content/contentSave.model';
import contentLikeModel from '@models/content/contentLike.model';
import hashtagModel from '@models/content/hashtag.model';
import reportModel from '@models/content/report.model';
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

  public async getFollowingFeed(userId: string, page: number, limit: number) {
    assertObjectId(userId, 'User');
    const skip = (page - 1) * limit;

    // Get IDs of users this person follows
    const followDocs = await this.follows.find({ followerId: userId }).select('followingId').lean().exec();
    const followingIds = followDocs.map(f => f.followingId);

    if (!followingIds.length) return { items: [], total: 0, page, limit };

    const filter = { authorId: { $in: followingIds }, isHidden: false };
    const populate = { path: 'authorId', select: 'firstName lastName loungeTitle profileImage type' };

    const [posts, reels] = await Promise.all([
      this.posts.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
      this.reels.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
    ]);

    // Merge + sort by date descending
    const merged = [...posts.map(p => ({ ...p, contentType: 'post' as const })), ...reels.map(r => ({ ...r, contentType: 'reel' as const }))].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = merged.length;
    const items = merged.slice(skip, skip + limit);

    // Attach interaction state
    const enriched = await this.enrichItems(items, userId);

    return { items: enriched, total, page, limit };
  }

  /* ───────── Explore Feed ───────── */

  public async getExploreFeed(userId: string | undefined, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const filter = { isHidden: false };
    const populate = { path: 'authorId', select: 'firstName lastName loungeTitle profileImage type' };

    const [posts, reels] = await Promise.all([
      this.posts.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
      this.reels.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
    ]);

    // Merge + sort by engagement (likes + comments) then recency
    const merged = [...posts.map(p => ({ ...p, contentType: 'post' as const })), ...reels.map(r => ({ ...r, contentType: 'reel' as const }))].sort(
      (a, b) => {
        const engageA = (a.likeCount || 0) + (a.commentCount || 0);
        const engageB = (b.likeCount || 0) + (b.commentCount || 0);
        if (engageB !== engageA) return engageB - engageA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      },
    );

    const total = merged.length;
    const items = merged.slice(skip, skip + limit);

    const enriched = userId ? await this.enrichItems(items, userId) : items;
    return { items: enriched, total, page, limit };
  }

  /* ───────── Hashtag Feed ───────── */

  public async getHashtagFeed(tag: string, userId: string | undefined, page: number, limit: number) {
    const normalised = tag.toLowerCase().replace(/^#/, '').trim();
    if (!normalised) throw new NotFoundException('Hashtag not found', 'HASHTAG_NOT_FOUND');

    const skip = (page - 1) * limit;
    const filter = { hashtags: normalised, isHidden: false };
    const populate = { path: 'authorId', select: 'firstName lastName loungeTitle profileImage type' };

    const [posts, reels] = await Promise.all([
      this.posts.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
      this.reels.find(filter).populate(populate).sort({ createdAt: -1 }).lean().exec(),
    ]);

    const merged = [...posts.map(p => ({ ...p, contentType: 'post' as const })), ...reels.map(r => ({ ...r, contentType: 'reel' as const }))].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = merged.length;
    const items = merged.slice(skip, skip + limit);

    const enriched = userId ? await this.enrichItems(items, userId) : items;
    return { items: enriched, total, page, limit };
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
