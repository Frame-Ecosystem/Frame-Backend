import productCategorySuggestionModel from '@systems/MarketplaceSystem/models/productCategorySuggestion.model';
import productCategoryModel from '@systems/MarketplaceSystem/models/productCategory.model';
import { ProductCategorySuggestion, ProductCategorySuggestionStatus } from '@systems/MarketplaceSystem/interfaces/productCategory.interface';
import {
  CreateProductCategorySuggestionDto,
  UpdateProductCategorySuggestionDto,
  UpdateProductCategorySuggestionStatusDto,
  AdminApproveProductCategorySuggestionDto,
} from '@systems/MarketplaceSystem/dtos/productCategorySuggestions.dto';
import ProductCategorySuggestionsAdminService from '@systems/MarketplaceSystem/services/productCategorySuggestionsAdmin.service';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import {
  HttpException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerException,
} from '@exceptions/HttpException';
import { isEmpty, handleMongooseError } from '@utils/util';
import { logger } from '@utils/logger';

class ProductCategorySuggestionsService {
  public suggestions = productCategorySuggestionModel;
  private categories = productCategoryModel;
  private adminService = new ProductCategorySuggestionsAdminService();
  private notificationService = NotificationService.getInstance();

  /* ───────── Create ───────── */

  public async createSuggestion(suggestedBy: string, data: CreateProductCategorySuggestionDto): Promise<ProductCategorySuggestion> {
    try {
      if (isEmpty(data) || !data.name) {
        throw new BadRequestException('Suggestion name is required', 'MISSING_SUGGESTION_NAME');
      }
      if (isEmpty(suggestedBy)) {
        throw new BadRequestException('Suggester ID is required', 'MISSING_USER_ID');
      }

      const trimmedName = data.name.trim();

      // Reject if a real category with the same name already exists.
      const existingCategory = await this.categories.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      });
      if (existingCategory) {
        throw new ConflictException(
          `A product category named "${existingCategory.name}" already exists. Try selecting it instead.`,
          'CATEGORY_ALREADY_EXISTS',
        );
      }

      // Block duplicate pending suggestions (any user) for the same name.
      const dupePending = await this.suggestions.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
        status: ProductCategorySuggestionStatus.PENDING,
      });
      if (dupePending) {
        throw new ConflictException('A pending suggestion with this name already exists. Please wait for moderation.', 'SUGGESTION_ALREADY_EXISTS');
      }

      const created = await this.suggestions.create({
        ...data,
        name: trimmedName,
        description: data.description?.trim(),
        suggestedBy,
        status: ProductCategorySuggestionStatus.PENDING,
      });

      logger.info(`ProductCategorySuggestionsService.create: suggestion ${created._id} (${trimmedName}) by user ${suggestedBy}`);

      // Notify all admins (fire-and-forget)
      try {
        const userModel = (await import('@systems/UserManager/models/user.model')).default;
        const admins = await userModel.find({ type: 'admin' }).select('_id').lean().exec();
        const adminIds = admins.map(a => a._id.toString());
        if (adminIds.length > 0) {
          const requester = await userModel.findById(suggestedBy).select('firstName lastName loungeTitle email').lean().exec();
          const requesterName =
            requester?.loungeTitle || [requester?.firstName, requester?.lastName].filter(Boolean).join(' ') || requester?.email || 'A user';
          this.notificationService
            .notifyProductCategorySuggestionCreated(adminIds, requesterName, created._id.toString(), trimmedName)
            .catch(() => {});
        }
      } catch (notifyErr) {
        logger.warn(`ProductCategorySuggestionsService.create: notify admins failed: ${notifyErr?.message || notifyErr}`);
      }

      return created.toObject() as ProductCategorySuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ProductCategorySuggestionsService.create', {
        duplicateMessage: 'A suggestion with this information already exists.',
        fallbackMessage: 'Unable to create category suggestion at this time.',
        logMeta: { suggestedBy, data },
      });
    }
  }

  /* ───────── Read ───────── */

  public async getSuggestionsPaginated(
    page = 1,
    limit = 20,
    status?: ProductCategorySuggestionStatus,
    suggestedBy?: string,
  ): Promise<{
    suggestions: ProductCategorySuggestion[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const safePage = Math.max(1, page);
      const safeLimit = Math.min(100, Math.max(1, limit));
      const skip = (safePage - 1) * safeLimit;
      const filter: any = {};
      if (status) filter.status = status;
      if (suggestedBy) filter.suggestedBy = suggestedBy;

      const [suggestions, total] = await Promise.all([
        this.suggestions
          .find(filter)
          .populate('suggestedBy', 'firstName lastName email type')
          .populate('implementedCategoryId', 'name slug isActive')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .lean(),
        this.suggestions.countDocuments(filter),
      ]);

      return {
        suggestions: suggestions as ProductCategorySuggestion[],
        total,
        page: safePage,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      };
    } catch (error) {
      handleMongooseError(error, 'ProductCategorySuggestionsService.list', {
        fallbackMessage: 'Unable to retrieve category suggestions at this time.',
        logMeta: { page, limit, status, suggestedBy },
      });
    }
  }

  public async getSuggestionById(id: string): Promise<ProductCategorySuggestion> {
    try {
      if (isEmpty(id)) throw new BadRequestException('Suggestion ID is required', 'MISSING_SUGGESTION_ID');
      const s = await this.suggestions
        .findById(id)
        .populate('suggestedBy', 'firstName lastName email type')
        .populate('implementedCategoryId', 'name slug isActive')
        .lean();
      if (!s) throw new NotFoundException('Product category suggestion not found', 'SUGGESTION_NOT_FOUND');
      return s as ProductCategorySuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ProductCategorySuggestionsService.getById', {
        castMessage: 'Invalid suggestion ID format',
        fallbackMessage: 'Unable to retrieve suggestion.',
        logMeta: { id },
      });
    }
  }

  /* ───────── Update (suggester, pending only) ───────── */

  public async updateSuggestion(id: string, requesterId: string, data: UpdateProductCategorySuggestionDto): Promise<ProductCategorySuggestion> {
    try {
      if (isEmpty(id) || isEmpty(data)) {
        throw new BadRequestException('Suggestion ID and update data are required', 'MISSING_REQUIRED_FIELDS');
      }

      const suggestion = await this.suggestions.findById(id);
      if (!suggestion) throw new NotFoundException('Product category suggestion not found', 'SUGGESTION_NOT_FOUND');

      if (suggestion.suggestedBy.toString() !== requesterId) {
        throw new ForbiddenException('You can only update your own suggestions', 'UNAUTHORIZED_ACCESS');
      }

      if (suggestion.status !== ProductCategorySuggestionStatus.PENDING) {
        throw new BadRequestException('Only pending suggestions can be edited', 'INVALID_STATUS_FOR_UPDATE');
      }

      const update: any = { ...data };
      if (data.name) update.name = data.name.trim();
      if (data.description !== undefined) update.description = data.description?.trim();

      const updated = await this.suggestions
        .findByIdAndUpdate(id, update, { new: true })
        .populate('suggestedBy', 'firstName lastName email type')
        .lean();

      if (!updated) throw new NotFoundException('Suggestion not found after update', 'SUGGESTION_NOT_FOUND');

      logger.info(`ProductCategorySuggestionsService.update: suggestion ${id} updated by ${requesterId}`);
      return updated as ProductCategorySuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ProductCategorySuggestionsService.update', {
        castMessage: 'Invalid suggestion ID format',
        fallbackMessage: 'Unable to update suggestion at this time.',
        logMeta: { id, requesterId, data },
      });
    }
  }

  /* ───────── Delete ───────── */

  public async deleteSuggestion(id: string, requesterId?: string): Promise<ProductCategorySuggestion> {
    try {
      if (isEmpty(id)) throw new BadRequestException('Suggestion ID is required', 'MISSING_SUGGESTION_ID');
      const filter: any = { _id: id };
      if (requesterId) filter.suggestedBy = requesterId;

      const deleted = await this.suggestions.findOneAndDelete(filter).lean();
      if (!deleted) throw new NotFoundException('Product category suggestion not found', 'SUGGESTION_NOT_FOUND');

      logger.info(`ProductCategorySuggestionsService.delete: ${id}`);
      return deleted as ProductCategorySuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ProductCategorySuggestionsService.delete', {
        castMessage: 'Invalid suggestion ID format',
        fallbackMessage: 'Unable to delete suggestion at this time.',
        logMeta: { id, requesterId },
      });
    }
  }

  /* ───────── Stats ───────── */

  public async getStats(): Promise<{ total: number; pending: number; approved: number; rejected: number; implemented: number }> {
    try {
      const stats = await this.suggestions.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
      const result = { total: 0, pending: 0, approved: 0, rejected: 0, implemented: 0 };
      stats.forEach((s: any) => {
        if (s._id in result) (result as any)[s._id] = s.count;
        result.total += s.count;
      });
      return result;
    } catch (error) {
      logger.error(`ProductCategorySuggestionsService.getStats: ${error?.message || error}`);
      throw new InternalServerException('Unable to retrieve suggestion statistics.');
    }
  }

  /* ───────── Admin delegates ───────── */

  public updateSuggestionStatus(id: string, data: UpdateProductCategorySuggestionStatusDto) {
    return this.adminService.updateSuggestionStatus(id, data);
  }

  public adminApproveSuggestion(id: string, data: AdminApproveProductCategorySuggestionDto) {
    return this.adminService.adminApproveSuggestion(id, data);
  }
}

export default ProductCategorySuggestionsService;
