import productCategorySuggestionModel from '@systems/MarketplaceSystem/models/productCategorySuggestion.model';
import {
  ProductCategorySuggestion,
  ProductCategorySuggestionStatus,
  ProductCategory,
} from '@systems/MarketplaceSystem/interfaces/productCategory.interface';
import {
  UpdateProductCategorySuggestionStatusDto,
  AdminApproveProductCategorySuggestionDto,
} from '@systems/MarketplaceSystem/dtos/productCategorySuggestions.dto';
import ProductCategoriesService from '@systems/MarketplaceSystem/services/productCategories.service';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import { HttpException, BadRequestException, NotFoundException, InternalServerException, ConflictException } from '@exceptions/HttpException';
import { isEmpty, handleMongooseError } from '@utils/util';
import { logger } from '@utils/logger';

/**
 * Admin-only service responsible for moderating ProductCategorySuggestions
 * and auto-implementing approved suggestions into real ProductCategory documents.
 */
class ProductCategorySuggestionsAdminService {
  private suggestions = productCategorySuggestionModel;
  private categoriesService = new ProductCategoriesService();
  private notificationService = NotificationService.getInstance();

  /**
   * Update suggestion status. If status is IMPLEMENTED, auto-creates the
   * corresponding ProductCategory using the supplied overrides + suggestion data.
   */
  public async updateSuggestionStatus(
    suggestionId: string,
    data: UpdateProductCategorySuggestionStatusDto,
  ): Promise<{ suggestion: ProductCategorySuggestion; category: ProductCategory | null }> {
    try {
      if (isEmpty(suggestionId)) {
        throw new BadRequestException('Suggestion ID is required', 'MISSING_SUGGESTION_ID');
      }
      if (isEmpty(data) || !data.status) {
        throw new BadRequestException('Status is required', 'MISSING_STATUS');
      }

      const validStatuses = Object.values(ProductCategorySuggestionStatus);
      if (!validStatuses.includes(data.status)) {
        throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 'INVALID_STATUS');
      }

      const suggestion = await this.suggestions.findById(suggestionId);
      if (!suggestion) {
        throw new NotFoundException('Product category suggestion not found', 'SUGGESTION_NOT_FOUND');
      }

      if (suggestion.status === ProductCategorySuggestionStatus.IMPLEMENTED) {
        throw new BadRequestException('This suggestion has already been implemented and cannot be re-moderated', 'SUGGESTION_ALREADY_IMPLEMENTED');
      }

      if (suggestion.status === data.status) {
        throw new BadRequestException(`The suggestion is already ${data.status.toLowerCase()}`, 'STATUS_ALREADY_SET');
      }

      let createdCategory: ProductCategory | null = null;

      if (data.status === ProductCategorySuggestionStatus.IMPLEMENTED) {
        createdCategory = await this.implementSuggestion(suggestion, {
          name: data.name || suggestion.name,
          description: data.description ?? suggestion.description,
          icon: data.icon ?? suggestion.iconHint,
          displayOrder: data.displayOrder ?? 0,
          adminNote: data.adminNote,
        });
      } else {
        await this.suggestions.findByIdAndUpdate(suggestionId, {
          status: data.status,
          ...(data.adminNote !== undefined && { adminNote: data.adminNote }),
        });
        logger.info(`ProductCategorySuggestionsAdminService: updated suggestion ${suggestionId} → ${data.status}`);
      }

      const updatedSuggestion = (await this.suggestions
        .findById(suggestionId)
        .populate('suggestedBy', 'firstName lastName email type')
        .populate('implementedCategoryId')
        .lean()) as ProductCategorySuggestion;

      // Notify suggester (fire-and-forget)
      const suggesterId = (suggestion.suggestedBy as any)?.toString();
      if (suggesterId && data.status !== ProductCategorySuggestionStatus.PENDING) {
        if (data.status === ProductCategorySuggestionStatus.APPROVED || data.status === ProductCategorySuggestionStatus.IMPLEMENTED) {
          this.notificationService.notifyProductCategorySuggestionApproved(suggesterId, suggestion.name, suggestionId).catch(() => {});
        } else if (data.status === ProductCategorySuggestionStatus.REJECTED) {
          this.notificationService
            .notifyProductCategorySuggestionRejected(suggesterId, suggestion.name, suggestionId, data.adminNote)
            .catch(() => {});
        }
      }

      return { suggestion: updatedSuggestion, category: createdCategory };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ProductCategorySuggestionsAdminService.updateStatus', {
        fallbackMessage: 'Unable to update suggestion status at this time.',
        logMeta: { suggestionId, data },
      });
    }
  }

  /**
   * Convenience admin path — defaults status to IMPLEMENTED if omitted.
   */
  public async adminApproveSuggestion(
    suggestionId: string,
    data: AdminApproveProductCategorySuggestionDto,
  ): Promise<{ suggestion: ProductCategorySuggestion; category: ProductCategory | null }> {
    const status = data.status || ProductCategorySuggestionStatus.IMPLEMENTED;
    return this.updateSuggestionStatus(suggestionId, {
      status,
      name: data.name,
      description: data.description,
      icon: data.icon,
      displayOrder: data.displayOrder,
      adminNote: data.adminNote,
    });
  }

  /* ───────── Private helpers ───────── */

  /**
   * Atomically create the ProductCategory and mark the suggestion as IMPLEMENTED.
   * If category creation fails (duplicate name etc.), the suggestion is left untouched.
   */
  private async implementSuggestion(
    suggestion: any,
    opts: { name: string; description?: string; icon?: string; displayOrder: number; adminNote?: string },
  ): Promise<ProductCategory> {
    try {
      const created = await this.categoriesService.createProductCategory({
        name: opts.name,
        description: opts.description,
        icon: opts.icon,
        displayOrder: opts.displayOrder,
        isActive: true,
      });

      await this.suggestions.findByIdAndUpdate(suggestion._id, {
        status: ProductCategorySuggestionStatus.IMPLEMENTED,
        implementedCategoryId: created._id,
        ...(opts.adminNote !== undefined && { adminNote: opts.adminNote }),
      });

      logger.info(`ProductCategorySuggestionsAdminService.implement: suggestion ${suggestion._id} → category ${created._id}`);

      return created;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(
          'A product category with this name already exists. Pick a different name when implementing.',
          'CATEGORY_NAME_CONFLICT',
        );
      }
      if (error instanceof HttpException) throw error;
      logger.error(`ProductCategorySuggestionsAdminService.implement error: ${error?.message || error}`, {
        suggestionId: suggestion._id,
        stack: error?.stack,
      });
      throw new InternalServerException('Failed to create the category from the suggestion. Please try again.', 'CATEGORY_CREATION_FAILED');
    }
  }
}

export default ProductCategorySuggestionsAdminService;
