import postModel from '@models/content/post.model';
import hashtagModel from '@models/content/hashtag.model';
import contentLikeModel from '@models/content/contentLike.model';
import contentSaveModel from '@models/content/contentSave.model';
import commentModel from '@models/content/comment.model';
import R2Service from '@services/cloudflare-r2.service';
import { HttpException, BadRequestException, NotFoundException, ForbiddenException, InternalServerException } from '@exceptions/HttpException';
import { assertObjectId } from '@utils/validators';
import { logger } from '@utils/logger';
import { AuthorType } from '@interfaces/content/content.interface';

class PostService {
  private posts = postModel;
  private hashtags = hashtagModel;
  private contentLikes = contentLikeModel;
  private contentSaves = contentSaveModel;
  private comments = commentModel;

  /* ───────── Create ───────── */

  public async createPost(authorId: string, authorType: string, data: { text?: string; hashtags?: string[] }, files?: Express.Multer.File[]) {
    try {
      if (!files?.length && !data.text) {
        throw new BadRequestException('A post must have at least text or an image', 'EMPTY_POST');
      }

      // Upload images to R2
      const media: { url: string; publicId: string }[] = [];
      if (files?.length) {
        const tempId = `${authorId}-${Date.now()}`;
        for (const file of files) {
          const result = await R2Service.uploadPostImage(file.buffer, tempId);
          media.push(result);
        }
      }

      const hashtags = this.normalizeHashtags(data.hashtags);

      const post = await this.posts.create({
        authorId,
        authorType: authorType as AuthorType,
        text: data.text || '',
        media,
        hashtags,
      });

      // Update hashtag counters
      await this.syncHashtags(hashtags, []);

      const populated = await this.posts.findById(post._id).populate('authorId', 'firstName lastName loungeTitle profileImage type').lean().exec();

      logger.info(`PostService.createPost: post ${post._id} created by ${authorType} ${authorId}`);
      return populated;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`PostService.createPost error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to create post');
    }
  }

  /* ───────── Read ───────── */

  public async getPostById(postId: string, userId?: string) {
    assertObjectId(postId, 'Post');

    const post = await this.posts.findById(postId).populate('authorId', 'firstName lastName loungeTitle profileImage type').lean().exec();

    if (!post || post.isHidden) throw new NotFoundException('Post not found', 'POST_NOT_FOUND');

    const extras = userId ? await this.getInteractionState(postId, 'post', userId) : {};
    return { ...post, ...extras };
  }

  public async getUserPosts(userId: string, page: number, limit: number) {
    assertObjectId(userId, 'User');
    const skip = (page - 1) * limit;

    const filter = { authorId: userId, isHidden: false };
    const [posts, total] = await Promise.all([
      this.posts
        .find(filter)
        .populate('authorId', 'firstName lastName loungeTitle profileImage type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.posts.countDocuments(filter).exec(),
    ]);

    return { posts, total, page, limit };
  }

  /* ───────── Update ───────── */

  public async updatePost(postId: string, userId: string, data: { text?: string; hashtags?: string[] }) {
    assertObjectId(postId, 'Post');

    const post = await this.posts.findById(postId);
    if (!post) throw new NotFoundException('Post not found', 'POST_NOT_FOUND');
    if (post.authorId.toString() !== userId) throw new ForbiddenException('You can only edit your own posts');

    const oldHashtags = post.hashtags || [];
    const newHashtags = data.hashtags !== undefined ? this.normalizeHashtags(data.hashtags) : oldHashtags;

    if (data.text !== undefined) post.text = data.text;
    if (data.hashtags !== undefined) post.hashtags = newHashtags;
    await post.save();

    await this.syncHashtags(newHashtags, oldHashtags);

    const populated = await this.posts.findById(postId).populate('authorId', 'firstName lastName loungeTitle profileImage type').lean().exec();

    logger.info(`PostService.updatePost: post ${postId} updated by ${userId}`);
    return populated;
  }

  /* ───────── Delete ───────── */

  public async deletePost(postId: string, userId: string, isAdmin = false) {
    assertObjectId(postId, 'Post');

    const post = await this.posts.findById(postId);
    if (!post) throw new NotFoundException('Post not found', 'POST_NOT_FOUND');
    if (!isAdmin && post.authorId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // Delete media from R2
    for (const m of post.media || []) {
      try {
        await R2Service.deleteImage(m.publicId);
      } catch {
        /* log only */
      }
    }

    // Clean up interactions
    await Promise.all([
      this.contentLikes.deleteMany({ targetId: postId, targetType: 'post' }).exec(),
      this.contentSaves.deleteMany({ targetId: postId, targetType: 'post' }).exec(),
      this.comments.deleteMany({ targetId: postId, targetType: 'post' }).exec(),
    ]);

    await this.syncHashtags([], post.hashtags || []);
    await post.deleteOne();

    logger.info(`PostService.deletePost: post ${postId} deleted by ${userId} (admin=${isAdmin})`);
  }

  /* ───────── Like / Save ───────── */

  public async toggleLike(postId: string, userId: string) {
    assertObjectId(postId, 'Post');
    const post = await this.posts.findById(postId);
    if (!post || post.isHidden) throw new NotFoundException('Post not found', 'POST_NOT_FOUND');

    const existing = await this.contentLikes.findOne({ userId, targetId: postId, targetType: 'post' }).lean().exec();

    if (existing) {
      await this.contentLikes.deleteOne({ _id: existing._id }).exec();
      await this.posts.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } }).exec();
      return { liked: false };
    } else {
      await this.contentLikes.create({ userId, targetId: postId, targetType: 'post' });
      await this.posts.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } }).exec();
      return { liked: true };
    }
  }

  public async toggleSave(postId: string, userId: string) {
    assertObjectId(postId, 'Post');
    const post = await this.posts.findById(postId);
    if (!post || post.isHidden) throw new NotFoundException('Post not found', 'POST_NOT_FOUND');

    const existing = await this.contentSaves.findOne({ userId, targetId: postId, targetType: 'post' }).lean().exec();

    if (existing) {
      await this.contentSaves.deleteOne({ _id: existing._id }).exec();
      await this.posts.findByIdAndUpdate(postId, { $inc: { saveCount: -1 } }).exec();
      return { saved: false };
    } else {
      await this.contentSaves.create({ userId, targetId: postId, targetType: 'post' });
      await this.posts.findByIdAndUpdate(postId, { $inc: { saveCount: 1 } }).exec();
      return { saved: true };
    }
  }

  /* ───────── Admin ───────── */

  public async hidePost(postId: string) {
    assertObjectId(postId, 'Post');
    const post = await this.posts.findByIdAndUpdate(postId, { isHidden: true }, { new: true }).lean().exec();
    if (!post) throw new NotFoundException('Post not found', 'POST_NOT_FOUND');
    logger.info(`PostService.hidePost: post ${postId} hidden`);
    return post;
  }

  public async unhidePost(postId: string) {
    assertObjectId(postId, 'Post');
    const post = await this.posts.findByIdAndUpdate(postId, { isHidden: false }, { new: true }).lean().exec();
    if (!post) throw new NotFoundException('Post not found', 'POST_NOT_FOUND');
    logger.info(`PostService.unhidePost: post ${postId} unhidden`);
    return post;
  }

  /* ───────── Private helpers ───────── */

  private normalizeHashtags(tags?: string[]): string[] {
    if (!tags?.length) return [];
    return [...new Set(tags.map(t => t.toLowerCase().replace(/^#/, '').trim()).filter(Boolean))];
  }

  private async syncHashtags(added: string[], removed: string[]) {
    const toIncrement = added.filter(t => !removed.includes(t));
    const toDecrement = removed.filter(t => !added.includes(t));

    const ops = [
      ...toIncrement.map(name => this.hashtags.updateOne({ name }, { $inc: { postCount: 1 } }, { upsert: true }).exec()),
      ...toDecrement.map(name => this.hashtags.updateOne({ name }, { $inc: { postCount: -1 } }).exec()),
    ];
    if (ops.length) await Promise.all(ops);
  }

  private async getInteractionState(targetId: string, targetType: string, userId: string) {
    const [liked, saved] = await Promise.all([
      this.contentLikes.exists({ userId, targetId, targetType }).lean(),
      this.contentSaves.exists({ userId, targetId, targetType }).lean(),
    ]);
    return { isLiked: !!liked, isSaved: !!saved };
  }
}

export default PostService;
