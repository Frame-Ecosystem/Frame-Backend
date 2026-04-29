import postModel from '@systems/FeedContentSystem/models/post.model';
import reelModel from '@systems/FeedContentSystem/models/reel.model';
import hashtagModel from '@systems/FeedContentSystem/models/hashtag.model';
import contentLikeModel from '@systems/FeedContentSystem/models/contentLike.model';
import contentSaveModel from '@systems/FeedContentSystem/models/contentSave.model';
import commentModel from '@systems/FeedContentSystem/models/comment.model';
import R2Service from '@shared/services/cloudflareR2.service';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import { HttpException, BadRequestException, NotFoundException, ForbiddenException, InternalServerException } from '@exceptions/HttpException';
import { assertObjectId } from '@utils/validators';
import { logger } from '@utils/logger';
import { AuthorType } from '@systems/FeedContentSystem/interfaces/content.interface';

class ReelService {
  private posts = postModel;
  private reels = reelModel;
  private hashtags = hashtagModel;
  private contentLikes = contentLikeModel;
  private contentSaves = contentSaveModel;
  private comments = commentModel;
  private notificationService = NotificationService.getInstance();

  /* ───────── Create ───────── */

  public async createReel(
    authorId: string,
    authorType: string,
    data: { caption?: string; duration: number; hashtags?: string[] },
    files: { video?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
  ) {
    try {
      const videoFile = files.video?.[0];
      if (!videoFile) throw new BadRequestException('Video file is required', 'VIDEO_REQUIRED');

      if (data.duration < 1 || data.duration > 60) {
        throw new BadRequestException('Duration must be between 1 and 60 seconds', 'INVALID_DURATION');
      }

      const tempId = `${authorId}-${Date.now()}`;

      // Upload video to R2
      const videoResult = await R2Service.uploadReelVideo(videoFile.buffer, tempId);

      // Upload optional thumbnail
      let thumbnailResult: { url: string; publicId: string } | undefined;
      if (files.thumbnail?.[0]) {
        thumbnailResult = await R2Service.uploadReelThumbnail(files.thumbnail[0].buffer, tempId);
      }

      const hashtags = this.normalizeHashtags(data.hashtags);

      const reel = await this.reels.create({
        authorId,
        authorType: authorType as AuthorType,
        caption: data.caption || '',
        videoUrl: videoResult.url,
        videoPublicId: videoResult.publicId,
        thumbnailUrl: thumbnailResult?.url || '',
        thumbnailPublicId: thumbnailResult?.publicId || '',
        duration: data.duration,
        hashtags,
      });

      await this.syncHashtags(hashtags, []);

      const populated = await this.reels.findById(reel._id).populate('authorId', 'firstName lastName loungeTitle profileImage type').lean().exec();

      logger.info(`ReelService.createReel: reel ${reel._id} created by ${authorType} ${authorId}`);
      return populated;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      logger.error(`ReelService.createReel error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to create reel');
    }
  }

  /* ───────── Read ───────── */

  public async getReelById(reelId: string, userId?: string) {
    assertObjectId(reelId, 'Reel');

    const reel = await this.reels.findById(reelId).populate('authorId', 'firstName lastName loungeTitle profileImage type').lean().exec();

    if (!reel || reel.isHidden) throw new NotFoundException('Reel not found', 'REEL_NOT_FOUND');

    const extras = userId ? await this.getInteractionState(reelId, 'reel', userId) : {};
    return { ...reel, ...extras };
  }

  public async getUserReels(userId: string, page: number, limit: number) {
    assertObjectId(userId, 'User');
    const skip = (page - 1) * limit;

    const filter = { authorId: userId, isHidden: false };
    const [reels, total] = await Promise.all([
      this.reels
        .find(filter)
        .populate('authorId', 'firstName lastName loungeTitle profileImage type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.reels.countDocuments(filter).exec(),
    ]);

    return { reels, total, page, limit };
  }

  public async getLoungeReels(loungeId: string, page: number, limit: number) {
    assertObjectId(loungeId, 'Lounge');
    const skip = (page - 1) * limit;

    const filter = { authorId: loungeId, isHidden: false };
    const [reels, total] = await Promise.all([
      this.reels
        .find(filter)
        .populate('authorId', 'firstName lastName loungeTitle profileImage type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.reels.countDocuments(filter).exec(),
    ]);

    return { reels, total, page, limit };
  }

  public async getLoungeContent(loungeId: string, page: number, limit: number) {
    assertObjectId(loungeId, 'Lounge');
    const skip = (page - 1) * limit;

    const filter = { authorId: loungeId, isHidden: false };
    const [posts, totalPosts, reels, totalReels] = await Promise.all([
      this.posts
        .find(filter)
        .populate('authorId', 'firstName lastName loungeTitle profileImage type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.posts.countDocuments(filter).exec(),
      this.reels
        .find(filter)
        .populate('authorId', 'firstName lastName loungeTitle profileImage type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.reels.countDocuments(filter).exec(),
    ]);

    return { posts, totalPosts, reels, totalReels, page, limit };
  }

  /* ───────── Update ───────── */

  public async updateReel(reelId: string, userId: string, data: { caption?: string; hashtags?: string[] }) {
    assertObjectId(reelId, 'Reel');

    const reel = await this.reels.findById(reelId);
    if (!reel) throw new NotFoundException('Reel not found', 'REEL_NOT_FOUND');
    if (reel.authorId.toString() !== userId) throw new ForbiddenException('You can only edit your own reels');

    const oldHashtags = reel.hashtags || [];
    const newHashtags = data.hashtags !== undefined ? this.normalizeHashtags(data.hashtags) : oldHashtags;

    if (data.caption !== undefined) reel.caption = data.caption;
    if (data.hashtags !== undefined) reel.hashtags = newHashtags;
    await reel.save();

    await this.syncHashtags(newHashtags, oldHashtags);

    const populated = await this.reels.findById(reelId).populate('authorId', 'firstName lastName loungeTitle profileImage type').lean().exec();

    logger.info(`ReelService.updateReel: reel ${reelId} updated by ${userId}`);
    return populated;
  }

  /* ───────── Delete ───────── */

  public async deleteReel(reelId: string, userId: string, isAdmin = false) {
    assertObjectId(reelId, 'Reel');

    const reel = await this.reels.findById(reelId);
    if (!reel) throw new NotFoundException('Reel not found', 'REEL_NOT_FOUND');
    if (!isAdmin && reel.authorId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own reels');
    }

    // Delete media from R2
    try {
      await R2Service.deleteImage(reel.videoPublicId);
    } catch {
      /* log only */
    }
    if (reel.thumbnailPublicId) {
      try {
        await R2Service.deleteImage(reel.thumbnailPublicId);
      } catch {
        /* log only */
      }
    }

    // Clean up interactions
    await Promise.all([
      this.contentLikes.deleteMany({ targetId: reelId, targetType: 'reel' }).exec(),
      this.contentSaves.deleteMany({ targetId: reelId, targetType: 'reel' }).exec(),
      this.comments.deleteMany({ targetId: reelId, targetType: 'reel' }).exec(),
    ]);

    await this.syncHashtags([], reel.hashtags || []);
    await reel.deleteOne();

    logger.info(`ReelService.deleteReel: reel ${reelId} deleted by ${userId} (admin=${isAdmin})`);
  }

  /* ───────── Like / Save ───────── */

  public async toggleLike(reelId: string, userId: string) {
    assertObjectId(reelId, 'Reel');
    const reel = await this.reels.findById(reelId);
    if (!reel || reel.isHidden) throw new NotFoundException('Reel not found', 'REEL_NOT_FOUND');

    const existing = await this.contentLikes.findOne({ userId, targetId: reelId, targetType: 'reel' }).lean().exec();

    if (existing) {
      await this.contentLikes.deleteOne({ _id: existing._id }).exec();
      await this.reels.findByIdAndUpdate(reelId, { $inc: { likeCount: -1 } }).exec();
      return { liked: false };
    } else {
      await this.contentLikes.create({ userId, targetId: reelId, targetType: 'reel' });
      await this.reels.findByIdAndUpdate(reelId, { $inc: { likeCount: 1 } }).exec();

      // Notify reel author
      const authorId = reel.authorId.toString();
      if (authorId !== userId) {
        const userModel = (await import('@systems/UserManager/models/user.model')).default;
        const actor = await userModel.findById(userId).select('firstName lastName loungeTitle profileImage type').lean().exec();
        const actorName = this.notificationService.extractName(actor);
        const actorImage = actor?.profileImage?.url;
        this.notificationService.notifyReelLiked(authorId, userId, actorName, reelId, actorImage).catch(() => {});
      }

      return { liked: true };
    }
  }

  public async toggleSave(reelId: string, userId: string) {
    assertObjectId(reelId, 'Reel');
    const reel = await this.reels.findById(reelId);
    if (!reel || reel.isHidden) throw new NotFoundException('Reel not found', 'REEL_NOT_FOUND');

    const existing = await this.contentSaves.findOne({ userId, targetId: reelId, targetType: 'reel' }).lean().exec();

    if (existing) {
      await this.contentSaves.deleteOne({ _id: existing._id }).exec();
      await this.reels.findByIdAndUpdate(reelId, { $inc: { saveCount: -1 } }).exec();
      return { saved: false };
    } else {
      await this.contentSaves.create({ userId, targetId: reelId, targetType: 'reel' });
      await this.reels.findByIdAndUpdate(reelId, { $inc: { saveCount: 1 } }).exec();
      return { saved: true };
    }
  }

  /* ───────── Admin ───────── */

  public async hideReel(reelId: string, reason?: string) {
    assertObjectId(reelId, 'Reel');
    const reel = await this.reels.findByIdAndUpdate(reelId, { isHidden: true }, { new: true }).lean().exec();
    if (!reel) throw new NotFoundException('Reel not found', 'REEL_NOT_FOUND');
    logger.info(`ReelService.hideReel: reel ${reelId} hidden`);

    // Notify author of content moderation
    this.notificationService.notifyContentHidden(reel.authorId.toString(), 'reel', reelId, reason).catch(() => {});

    return reel;
  }

  public async unhideReel(reelId: string) {
    assertObjectId(reelId, 'Reel');
    const reel = await this.reels.findByIdAndUpdate(reelId, { isHidden: false }, { new: true }).lean().exec();
    if (!reel) throw new NotFoundException('Reel not found', 'REEL_NOT_FOUND');
    logger.info(`ReelService.unhideReel: reel ${reelId} unhidden`);
    return reel;
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

export default ReelService;
