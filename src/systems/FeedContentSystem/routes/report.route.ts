import { Router } from 'express';
import ReportController from '@systems/FeedContentSystem/controllers/report.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { adminOrLoungeOrClientMiddleware, adminMiddleware } from '@middlewares/role.middleware';
import { reportRateLimiter, generalRateLimiter } from '@middlewares/rateLimit.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { CreateReportDto, ReviewReportDto } from '@systems/FeedContentSystem/dtos/report.dto';

class ReportRoute implements Routes {
  public path = '/v1/reports';
  public router = Router();
  private controller = new ReportController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @route   POST /v1/reports/:targetType/:targetId
     * @desc    Report a post, reel, or comment
     * @access  Private
     * @param   targetType - 'post' | 'reel' | 'comment'
     */
    this.router.post(
      '/:targetType/:targetId',
      authMiddleware,
      adminOrLoungeOrClientMiddleware,
      reportRateLimiter,
      validationMiddleware(CreateReportDto, 'body'),
      this.controller.createReport,
    );

    /* ───────── Admin routes ───────── */

    /**
     * @route   GET /v1/reports
     * @desc    List all reports (with optional status filter)
     * @access  Admin only
     * @query   status - pending | reviewed | dismissed
     */
    this.router.get('/', authMiddleware, adminMiddleware, generalRateLimiter, this.controller.getReports);

    /**
     * @route   PUT /v1/reports/:reportId
     * @desc    Review a report (mark reviewed/dismissed with optional note)
     * @access  Admin only
     */
    this.router.put('/:reportId', authMiddleware, adminMiddleware, validationMiddleware(ReviewReportDto, 'body'), this.controller.reviewReport);
  }
}

export default ReportRoute;
