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
import { stat, unlink } from 'fs/promises';
import ReelMediaService from '@systems/FeedContentSystem/services/reelMedia.service';
import {
  MAX_REEL_CAPTION_LENGTH,
  MAX_REEL_DURATION_SECONDS,
  MAX_REEL_HASHTAGS,
  MAX_REEL_THUMBNAIL_BYTES,
  MAX_REEL_VIDEO_BYTES,
  REEL_THUMBNAIL_MIME_TYPES,
  REEL_VIDEO_MIME_TYPES,
} from '@systems/FeedContentSystem/contentLimits';

class ReelService {
  private static readonly MIN_REEL_DURATION_SECONDS = 1;

  private readonly posts = postModel;
  private readonly reels = reelModel;
  private readonly hashtags = hashtagModel;
  private readonly contentLikes = contentLikeModel;
  private readonly contentSaves = contentSaveModel;
  private readonly comments = commentModel;
  private readonly notificationService = NotificationService.getInstance();

  /* ───────── Create ───────── */

  public async createReel(
    authorId: string,
    authorType: string,
    data: { caption?: string; duration: number; hashtags?: string[] },
    files: { video?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] } = {},
  ) {
    const generatedTemporaryFiles: string[] = [];
    try {
      const videoFile = files.video?.[0];
      if (!videoFile) throw new BadRequestException('Video file is required', 'VIDEO_REQUIRED');
      if (!videoFile.path || !Number.isFinite(videoFile.size) || videoFile.size <= 0) {
        throw new BadRequestException('Video upload is empty or invalid', 'VIDEO_UPLOAD_INCOMPLETE');
      }
      if (videoFile.size > MAX_REEL_VIDEO_BYTES) {
        throw new BadRequestException('Video must be 90 MB or smaller', 'UPLOAD_FILE_TOO_LARGE');
      }

      if (!REEL_VIDEO_MIME_TYPES.includes(videoFile.mimetype)) {
        throw new BadRequestException('Unsupported video format', 'INVALID_UPLOAD_FILE_TYPE');
      }

      const videoStats = await stat(videoFile.path);
      if (!videoStats.isFile() || videoStats.size !== videoFile.size) {
        throw new BadRequestException('Video upload is incomplete', 'VIDEO_UPLOAD_INCOMPLETE');
      }

      let videoMetadata: Awaited<ReturnType<typeof ReelMediaService.getVideoMetadata>>;
      try {
        videoMetadata = await ReelMediaService.getVideoMetadata(videoFile.path);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          logger.error('ReelService.createReel: FFmpeg is unavailable; reinstall backend dependencies or install FFmpeg on the server');
          throw new InternalServerException('Video processing is unavailable');
        }
        logger.warn(`ReelService.createReel: unable to read uploaded video metadata: ${error.message}`);
        throw new BadRequestException('Unable to read video metadata', 'INVALID_VIDEO_METADATA');
      }

      if (videoMetadata.duration < ReelService.MIN_REEL_DURATION_SECONDS || videoMetadata.duration > MAX_REEL_DURATION_SECONDS) {
        throw new BadRequestException('Video duration must be 3 minutes or less', 'INVALID_DURATION');
      }
      if (data.caption !== undefined && (typeof data.caption !== 'string' || data.caption.length > MAX_REEL_CAPTION_LENGTH)) {
        throw new BadRequestException('Caption exceeds the maximum length', 'INVALID_CAPTION');
      }
      if (
        data.hashtags &&
        (!Array.isArray(data.hashtags) || data.hashtags.length > MAX_REEL_HASHTAGS || data.hashtags.some(tag => typeof tag !== 'string'))
      ) {
        throw new BadRequestException(`Reels support up to ${MAX_REEL_HASHTAGS} hashtags`, 'INVALID_HASHTAGS');
      }
      const customThumbnail = files.thumbnail?.[0];
      const thumbnailTypes: Record<string, string[]> = {
        'image/jpeg': ['mjpeg', 'jpeg'],
        'image/png': ['png'],
        'image/webp': ['webp'],
      };
      if (customThumbnail) {
        if (Number.isFinite(customThumbnail.size) && customThumbnail.size > MAX_REEL_THUMBNAIL_BYTES) {
          throw new BadRequestException('Thumbnail must be 5 MB or smaller', 'THUMBNAIL_FILE_TOO_LARGE');
        }
        if (!customThumbnail.path || !Number.isFinite(customThumbnail.size) || customThumbnail.size <= 0) {
          throw new BadRequestException('Thumbnail upload is incomplete', 'THUMBNAIL_UPLOAD_INCOMPLETE');
        }
        if (!REEL_THUMBNAIL_MIME_TYPES.includes(customThumbnail.mimetype) || !thumbnailTypes[customThumbnail.mimetype]) {
          throw new BadRequestException('Unsupported thumbnail format', 'INVALID_UPLOAD_FILE_TYPE');
        }
        const thumbnailStats = await stat(customThumbnail.path);
        if (!thumbnailStats.isFile() || thumbnailStats.size !== customThumbnail.size) {
          throw new BadRequestException('Thumbnail upload is incomplete', 'THUMBNAIL_UPLOAD_INCOMPLETE');
        }
        try {
          const imageMetadata = await ReelMediaService.getImageMetadata(customThumbnail.path);
          if (!thumbnailTypes[customThumbnail.mimetype].includes(imageMetadata.codec)) {
            throw new Error(`Thumbnail content does not match ${customThumbnail.mimetype}`);
          }
        } catch (error: any) {
          logger.warn(`ReelService.createReel: unable to read custom thumbnail metadata: ${error.message}`);
          throw new BadRequestException('Unable to read thumbnail image', 'INVALID_THUMBNAIL_METADATA');
        }
      }

      const tempId = `${authorId}-${Date.now()}`;
      const uploadedPublicIds: string[] = [];
      let persisted = false;

      try {
        const videoResult = await R2Service.uploadReelVideoFile(videoFile.path, videoFile.mimetype, videoFile.size, tempId);
        uploadedPublicIds.push(videoResult.publicId);

        let thumbnailResult: { url: string; publicId: string } | undefined;
        if (customThumbnail) {
          thumbnailResult = await R2Service.uploadReelThumbnailFile(customThumbnail.path, customThumbnail.mimetype, customThumbnail.size, tempId);
          uploadedPublicIds.push(thumbnailResult.publicId);
        } else {
          try {
            const generated = await ReelMediaService.generateThumbnail(videoFile.path, Math.min(2, videoMetadata.duration * 0.1));
            generatedTemporaryFiles.push(generated.path);
            if (generated.size > MAX_REEL_THUMBNAIL_BYTES) {
              throw new Error('Generated thumbnail exceeds the configured size limit');
            }
            thumbnailResult = await R2Service.uploadReelThumbnailFile(generated.path, 'image/jpeg', generated.size, tempId);
            uploadedPublicIds.push(thumbnailResult.publicId);
          } catch (error: any) {
            logger.warn(`ReelService.createReel: automatic thumbnail generation failed; creating reel without a thumbnail: ${error.message}`);
          }
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
          duration: videoMetadata.duration,
          hashtags,
        });
        persisted = true;

        try {
          await this.syncHashtags(hashtags, []);
        } catch (error: any) {
          logger.error(`ReelService.createReel: reel ${reel._id} was saved but hashtag counts could not be updated: ${error.message}`);
        }

        let populated;
        try {
          populated = await this.reels.findById(reel._id).populate('authorId', 'firstName lastName loungeTitle profileImage type').lean().exec();
        } catch (error: any) {
          logger.warn(`ReelService.createReel: could not populate saved reel ${reel._id}: ${error.message}`);
        }

        logger.info(`ReelService.createReel: reel ${reel._id} created by ${authorType} ${authorId}`);
        return populated || reel.toObject();
      } catch (error: any) {
        if (!persisted) {
          await Promise.all(
            uploadedPublicIds.map(async publicId => {
              try {
                await R2Service.deleteImage(publicId);
              } catch (cleanupError: any) {
                logger.error(`ReelService.createReel: failed to clean up ${publicId}: ${cleanupError.message}`);
              }
            }),
          );
        }
        throw error;
      }
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      logger.error(`ReelService.createReel error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to create reel');
    } finally {
      await Promise.all(
        [...(files.video ?? []), ...(files.thumbnail ?? [])].map(async file => {
          if (!file.path) return;
          try {
            await unlink(file.path);
          } catch (error: any) {
            if (error.code !== 'ENOENT') {
              logger.warn(`ReelService.createReel: failed to remove temporary upload ${file.path}: ${error.message}`);
            }
          }
        }),
      );
      await Promise.all(
        generatedTemporaryFiles.map(async filePath => {
          try {
            await unlink(filePath);
          } catch (error: any) {
            if (error.code !== 'ENOENT') {
              logger.warn(`ReelService.createReel: failed to remove generated thumbnail ${filePath}: ${error.message}`);
            }
          }
        }),
      );
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
    const newHashtags = data.hashtags === undefined ? oldHashtags : this.normalizeHashtags(data.hashtags);

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
