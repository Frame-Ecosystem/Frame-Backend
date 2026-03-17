import { NextFunction, Response } from 'express';
import ReportService from '@services/content/report.service';
import { RequestWithUser } from '@interfaces/auth/auth.interface';

class ReportController {
  private reportService = new ReportService();

  /** Report content (post/reel/comment) */
  public createReport = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const reporterId = req.user._id.toString();
      const { targetType, targetId } = req.params;
      const { reason } = req.body;

      const report = await this.reportService.createReport(reporterId, targetType as 'post' | 'reel' | 'comment', targetId, reason);
      res.status(201).json({ data: report, message: 'Report submitted' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: list reports */
  public getReports = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;

      const result = await this.reportService.getReports(status, page, limit);
      res.status(200).json({ data: result.reports, pagination: { total: result.total, page, limit }, message: 'Reports retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /** Admin: review a report */
  public reviewReport = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { reportId } = req.params;
      const { status, adminNote } = req.body;

      const report = await this.reportService.reviewReport(reportId, { status, adminNote });
      res.status(200).json({ data: report, message: 'Report reviewed' });
    } catch (error) {
      next(error);
    }
  };
}

export default ReportController;
