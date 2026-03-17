import reportModel from '@models/content/report.model';
import postModel from '@models/content/post.model';
import reelModel from '@models/content/reel.model';
import commentModel from '@models/content/comment.model';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { assertObjectId } from '@utils/validators';
import { logger } from '@utils/logger';
import { ReportStatus } from '@interfaces/content/content.interface';

class ReportService {
  private reports = reportModel;
  private posts = postModel;
  private reels = reelModel;
  private comments = commentModel;

  /* ───────── Create Report ───────── */

  public async createReport(reporterId: string, targetType: 'post' | 'reel' | 'comment', targetId: string, reason: string) {
    try {
      assertObjectId(targetId, 'Target');

      // Verify target exists
      let target: any;
      switch (targetType) {
        case 'post':
          target = await this.posts.findById(targetId).lean().exec();
          break;
        case 'reel':
          target = await this.reels.findById(targetId).lean().exec();
          break;
        case 'comment':
          target = await this.comments.findById(targetId).lean().exec();
          break;
        default:
          throw new BadRequestException('Invalid target type', 'INVALID_TARGET_TYPE');
      }

      if (!target) throw new NotFoundException('Content not found', 'TARGET_NOT_FOUND');

      // Check duplicate
      const existing = await this.reports.findOne({ reporterId, targetId, targetType }).lean().exec();
      if (existing) throw new ConflictException('You have already reported this content');

      const report = await this.reports.create({ reporterId, targetId, targetType, reason });

      logger.info(`ReportService.createReport: ${targetType} ${targetId} reported by ${reporterId}`);
      return report;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ReportService.createReport error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to create report');
    }
  }

  /* ───────── Admin — list ───────── */

  public async getReports(status: string | undefined, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const filter: any = {};
    if (status) filter.status = status;

    const [reports, total] = await Promise.all([
      this.reports
        .find(filter)
        .populate('reporterId', 'firstName lastName loungeTitle profileImage type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.reports.countDocuments(filter).exec(),
    ]);

    return { reports, total, page, limit };
  }

  /* ───────── Admin — review ───────── */

  public async reviewReport(reportId: string, data: { status: ReportStatus; adminNote?: string }) {
    assertObjectId(reportId, 'Report');

    const report = await this.reports.findById(reportId);
    if (!report) throw new NotFoundException('Report not found', 'REPORT_NOT_FOUND');

    report.status = data.status;
    if (data.adminNote !== undefined) report.adminNote = data.adminNote;
    await report.save();

    logger.info(`ReportService.reviewReport: report ${reportId} → ${data.status}`);
    return report;
  }
}

export default ReportService;
