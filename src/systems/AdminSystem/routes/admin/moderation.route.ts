import { Router } from 'express';
import ContentModerationController from '@systems/FeedContentSystem/controllers/contentModeration.controller';
import { ReviewReportDto } from '@systems/FeedContentSystem/dtos/report.dto';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';

export const createAdminModerationRouter = (): Router => {
  const router = Router();
  const moderationCtrl = new ContentModerationController();

  router.put('/moderation/posts/:postId/hide', csrfMiddleware, moderationCtrl.hidePost);
  router.put('/moderation/posts/:postId/unhide', csrfMiddleware, moderationCtrl.unhidePost);
  router.delete('/moderation/posts/:postId', csrfMiddleware, moderationCtrl.adminDeletePost);

  router.put('/moderation/reels/:reelId/hide', csrfMiddleware, moderationCtrl.hideReel);
  router.put('/moderation/reels/:reelId/unhide', csrfMiddleware, moderationCtrl.unhideReel);
  router.delete('/moderation/reels/:reelId', csrfMiddleware, moderationCtrl.adminDeleteReel);

  router.put('/moderation/comments/:commentId/hide', csrfMiddleware, moderationCtrl.hideComment);
  router.put('/moderation/comments/:commentId/unhide', csrfMiddleware, moderationCtrl.unhideComment);
  router.delete('/moderation/comments/:commentId', csrfMiddleware, moderationCtrl.adminDeleteComment);

  router.get('/moderation/reports', moderationCtrl.getReports);
  router.put('/moderation/reports/:reportId', csrfMiddleware, validationMiddleware(ReviewReportDto, 'body'), moderationCtrl.reviewReport);

  return router;
};
