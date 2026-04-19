import commentModel from '@systems/FeedContentSystem/models/comment.model';
import contentLikeModel from '@systems/FeedContentSystem/models/contentLike.model';
import postModel from '@systems/FeedContentSystem/models/post.model';
import reelModel from '@systems/FeedContentSystem/models/reel.model';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import { HttpException, BadRequestException, NotFoundException, ForbiddenException, InternalServerException } from '@exceptions/HttpException';
import { assertObjectId } from '@utils/validators';
import { logger } from '@utils/logger';

class CommentService {
  private comments = commentModel;
  private contentLikes = contentLikeModel;
  private posts = postModel;
  private reels = reelModel;
  private notificationService = NotificationService.getInstance();

  /* ───────── Create ───────── */

  public async addComment(authorId: string, targetType: 'post' | 'reel', targetId: string, data: { text: string; parentCommentId?: string }) {
    try {
      assertObjectId(targetId, 'Target');

      // Verify target exists
      const target = targetType === 'post' ? await this.posts.findById(targetId).lean().exec() : await this.reels.findById(targetId).lean().exec();

      if (!target || target.isHidden) {
        throw new NotFoundException(`${targetType === 'post' ? 'Post' : 'Reel'} not found`, 'TARGET_NOT_FOUND');
      }

      // Verify parent comment if replying
      if (data.parentCommentId) {
        assertObjectId(data.parentCommentId, 'Parent comment');
        const parent = await this.comments.findById(data.parentCommentId).lean().exec();
        if (!parent) throw new NotFoundException('Parent comment not found', 'PARENT_NOT_FOUND');
        // Ensure parent belongs to same target
        if (parent.targetId.toString() !== targetId || parent.targetType !== targetType) {
          throw new BadRequestException('Parent comment does not belong to this content', 'PARENT_MISMATCH');
        }
      }

      const comment = await this.comments.create({
        authorId,
        targetId,
        targetType,
        text: data.text,
        parentCommentId: data.parentCommentId || null,
      });

      // Increment comment count on parent content
      if (targetType === 'post') {
        await this.posts.findByIdAndUpdate(targetId, { $inc: { commentCount: 1 } }).exec();
      } else {
        await this.reels.findByIdAndUpdate(targetId, { $inc: { commentCount: 1 } }).exec();
      }

      const populated = await this.comments
        .findById(comment._id)
        .populate('authorId', 'firstName lastName loungeTitle profileImage type')
        .lean()
        .exec();

      logger.info(`CommentService.addComment: comment ${comment._id} on ${targetType} ${targetId}`);

      // Fire notifications asynchronously (never block the response)
      this.fireCommentNotifications(authorId, targetType, targetId, target, comment, data.parentCommentId).catch(() => {});

      return populated;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      logger.error(`CommentService.addComment error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to add comment');
    }
  }

  /* ───────── List ───────── */

  public async getComments(targetType: 'post' | 'reel', targetId: string, page: number, limit: number) {
    assertObjectId(targetId, 'Target');
    const skip = (page - 1) * limit;

    // Only top-level comments
    const filter = { targetId, targetType, parentCommentId: null, isHidden: false };

    const [comments, total] = await Promise.all([
      this.comments
        .find(filter)
        .populate('authorId', 'firstName lastName loungeTitle profileImage type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.comments.countDocuments(filter).exec(),
    ]);

    // Attach reply count to each top-level comment
    const enriched = await Promise.all(
      comments.map(async c => {
        const replyCount = await this.comments.countDocuments({ parentCommentId: c._id, isHidden: false }).exec();
        return { ...c, replyCount };
      }),
    );

    return { comments: enriched, total, page, limit };
  }

  public async getReplies(commentId: string, page: number, limit: number) {
    assertObjectId(commentId, 'Comment');
    const skip = (page - 1) * limit;

    const filter = { parentCommentId: commentId, isHidden: false };

    const [replies, total] = await Promise.all([
      this.comments
        .find(filter)
        .populate('authorId', 'firstName lastName loungeTitle profileImage type')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.comments.countDocuments(filter).exec(),
    ]);

    return { replies, total, page, limit };
  }

  /* ───────── Delete ───────── */

  public async deleteComment(commentId: string, userId: string, isAdmin = false) {
    assertObjectId(commentId, 'Comment');

    const comment = await this.comments.findById(commentId);
    if (!comment) throw new NotFoundException('Comment not found', 'COMMENT_NOT_FOUND');
    if (!isAdmin && comment.authorId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Count this comment + its replies for decrement
    const replyCount = await this.comments.countDocuments({ parentCommentId: commentId }).exec();
    const totalToDecrement = 1 + replyCount;

    // Delete replies
    await this.comments.deleteMany({ parentCommentId: commentId }).exec();
    // Delete likes on this comment and its replies
    await this.contentLikes.deleteMany({ targetId: commentId, targetType: 'comment' }).exec();

    // Decrement comment count on parent content
    if (comment.targetType === 'post') {
      await this.posts.findByIdAndUpdate(comment.targetId, { $inc: { commentCount: -totalToDecrement } }).exec();
    } else {
      await this.reels.findByIdAndUpdate(comment.targetId, { $inc: { commentCount: -totalToDecrement } }).exec();
    }

    await comment.deleteOne();
    logger.info(`CommentService.deleteComment: comment ${commentId} deleted by ${userId} (admin=${isAdmin})`);
  }

  /* ───────── Like ───────── */

  public async toggleLike(commentId: string, userId: string) {
    assertObjectId(commentId, 'Comment');
    const comment = await this.comments.findById(commentId);
    if (!comment || comment.isHidden) throw new NotFoundException('Comment not found', 'COMMENT_NOT_FOUND');

    const existing = await this.contentLikes.findOne({ userId, targetId: commentId, targetType: 'comment' }).lean().exec();

    if (existing) {
      await this.contentLikes.deleteOne({ _id: existing._id }).exec();
      await this.comments.findByIdAndUpdate(commentId, { $inc: { likeCount: -1 } }).exec();
      return { liked: false };
    } else {
      await this.contentLikes.create({ userId, targetId: commentId, targetType: 'comment' });
      await this.comments.findByIdAndUpdate(commentId, { $inc: { likeCount: 1 } }).exec();

      // Notify comment author
      const commentAuthorId = comment.authorId.toString();
      if (commentAuthorId !== userId) {
        const userModel = (await import('@systems/UserManager/models/user.model')).default;
        const actor = await userModel.findById(userId).select('firstName lastName loungeTitle profileImage type').lean().exec();
        const actorName = this.notificationService.extractName(actor);
        const actorImage = actor?.profileImage?.url;
        const targetType = comment.targetType as 'post' | 'reel';
        const targetId = comment.targetId.toString();
        this.notificationService.notifyCommentLiked(commentAuthorId, userId, actorName, commentId, targetType, targetId, actorImage).catch(() => {});
      }

      return { liked: true };
    }
  }

  /* ───────── Notification Helpers ───────── */

  private async fireCommentNotifications(
    authorId: string,
    targetType: 'post' | 'reel',
    targetId: string,
    target: any,
    comment: any,
    parentCommentId?: string,
  ): Promise<void> {
    try {
      const userModel = (await import('@systems/UserManager/models/user.model')).default;
      const actor = await userModel.findById(authorId).select('firstName lastName loungeTitle profileImage type').lean().exec();
      const actorName = this.notificationService.extractName(actor);
      const actorImage = actor?.profileImage?.url;
      const commentId = comment._id.toString();
      const text = comment.text || '';

      // Notify the content author (post/reel owner)
      const contentAuthorId = target.authorId?.toString();
      if (contentAuthorId && contentAuthorId !== authorId) {
        await this.notificationService.notifyContentCommented(
          contentAuthorId,
          authorId,
          actorName,
          targetType,
          targetId,
          commentId,
          text,
          actorImage,
        );
      }

      // If replying, also notify the parent comment author
      if (parentCommentId) {
        const parent = await this.comments.findById(parentCommentId).select('authorId').lean().exec();
        const parentAuthorId = parent?.authorId?.toString();
        if (parentAuthorId && parentAuthorId !== authorId && parentAuthorId !== contentAuthorId) {
          await this.notificationService.notifyCommentReplied(parentAuthorId, authorId, actorName, targetType, targetId, commentId, text, actorImage);
        }
      }
    } catch (err: any) {
      logger.error(`CommentService.fireCommentNotifications error: ${err.message}`);
    }
  }

  /* ───────── Admin ───────── */

  public async hideComment(commentId: string, reason?: string) {
    assertObjectId(commentId, 'Comment');
    const comment = await this.comments.findByIdAndUpdate(commentId, { isHidden: true }, { new: true }).lean().exec();
    if (!comment) throw new NotFoundException('Comment not found', 'COMMENT_NOT_FOUND');

    // Notify author of content moderation
    this.notificationService.notifyContentHidden(comment.authorId.toString(), 'comment', commentId, reason).catch(() => {});

    return comment;
  }

  public async unhideComment(commentId: string) {
    assertObjectId(commentId, 'Comment');
    const comment = await this.comments.findByIdAndUpdate(commentId, { isHidden: false }, { new: true }).lean().exec();
    if (!comment) throw new NotFoundException('Comment not found', 'COMMENT_NOT_FOUND');
    return comment;
  }
}

export default CommentService;
