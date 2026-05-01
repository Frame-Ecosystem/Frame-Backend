import { NextFunction, Response } from 'express';
import ProductCategorySuggestionsService from '@systems/MarketplaceSystem/services/productCategorySuggestions.service';
import { ProductCategorySuggestionStatus } from '@systems/MarketplaceSystem/interfaces/productCategory.interface';
import { stripSensitiveFields } from '@utils/util';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import { HttpException } from '@exceptions/HttpException';

class ProductCategorySuggestionsController {
  private suggestionsService = new ProductCategorySuggestionsService();

  /** Standard envelope for status-update responses (with optional implemented category). */
  private formatStatusResponse(result: { suggestion: any; category: any | null }) {
    return {
      data: {
        suggestion: stripSensitiveFields(result.suggestion),
        category: result.category ? stripSensitiveFields(result.category) : null,
      },
      message: result.category ? 'Category suggestion approved and implemented successfully' : 'Category suggestion status updated successfully',
    };
  }

  /** POST / — any authenticated user may submit. */
  public createSuggestion = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) return next(new HttpException(401, 'Authentication required'));

      const created = await this.suggestionsService.createSuggestion(userId, req.body);
      res.status(201).json({ data: created, message: 'Category suggestion submitted successfully' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET / — admins see all suggestions; non-admins see only their own.
   * Query: ?page=&limit=&status=
   */
  public getSuggestionsPaginated = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as ProductCategorySuggestionStatus | undefined;

      const filterUserId = req.user?.type === 'admin' ? undefined : req.user?._id?.toString();

      const result = await this.suggestionsService.getSuggestionsPaginated(page, limit, status, filterUserId);

      res.status(200).json({
        data: result.suggestions,
        pagination: { page: result.page, limit, total: result.total, totalPages: result.totalPages },
        message: 'Category suggestions retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /stats — admin only */
  public getStats = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const stats = await this.suggestionsService.getStats();
      res.status(200).json({ data: stats, message: 'Category suggestion statistics retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** GET /:suggestionId */
  public getSuggestionById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const suggestion = await this.suggestionsService.getSuggestionById(req.params.suggestionId);

      // Non-admins may only view their own suggestion.
      if (
        req.user?.type !== 'admin' &&
        (suggestion.suggestedBy as any)?._id?.toString() !== req.user?._id?.toString() &&
        suggestion.suggestedBy?.toString() !== req.user?._id?.toString()
      ) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.status(200).json({ data: suggestion, message: 'Category suggestion retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** PUT /:suggestionId — owner-only edit while pending. */
  public updateSuggestion = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) return next(new HttpException(401, 'Authentication required'));

      const updated = await this.suggestionsService.updateSuggestion(req.params.suggestionId, userId, req.body);
      res.status(200).json({ data: updated, message: 'Category suggestion updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /:suggestionId/status — admin only. */
  public updateSuggestionStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const result = await this.suggestionsService.updateSuggestionStatus(req.params.suggestionId, req.body);
      res.status(200).json(this.formatStatusResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /:suggestionId/admin-approve — admin convenience: defaults to IMPLEMENTED. */
  public adminApproveSuggestion = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const result = await this.suggestionsService.adminApproveSuggestion(req.params.suggestionId, req.body);
      res.status(200).json(this.formatStatusResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /:suggestionId — owner deletes own; admin can delete anything. */
  public deleteSuggestion = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user?.type === 'admin' ? undefined : req.user?._id?.toString();
      const deleted = await this.suggestionsService.deleteSuggestion(req.params.suggestionId, requesterId);
      res.status(200).json({ data: stripSensitiveFields(deleted), message: 'Category suggestion deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export default ProductCategorySuggestionsController;
