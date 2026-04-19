import { NextFunction, Response } from 'express';
import ServiceSuggestionsService from '@systems/ServiceCatalogSystem/services/serviceSuggestions.service';
import { stripSensitiveFields } from '@utils/util';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import { ServiceSuggestionStatus } from '@systems/ServiceCatalogSystem/interfaces/serviceSuggestion.interface';
import { HttpException } from '@exceptions/HttpException';

class ServiceSuggestionsController {
  private serviceSuggestionsService = new ServiceSuggestionsService();

  /**
   * Build the standard response shape for suggestion status updates.
   */
  private formatSuggestionStatusResponse(result: any) {
    return {
      data: {
        suggestion: stripSensitiveFields(result.suggestion),
        service: result.service ? stripSensitiveFields(result.service) : null,
        loungeService: result.loungeService ? stripSensitiveFields(result.loungeService) : null,
      },
      message: result.service ? 'Service suggestion approved and implemented successfully' : 'Service suggestion status updated successfully',
    };
  }

  /**
   * Create a new service suggestion (lounge users only)
   */
  public createServiceSuggestion = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.user._id?.toString();

      if (!loungeId) {
        return next(new HttpException(401, 'Authentication required'));
      }

      const suggestionData = req.body;

      const suggestion = await this.serviceSuggestionsService.createServiceSuggestion(loungeId, suggestionData);

      res.status(201).json({
        data: suggestion,
        message: 'Service suggestion created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get service suggestions with pagination and filtering
   */
  public getServiceSuggestionsPaginated = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as ServiceSuggestionStatus;

      // Lounges only see their own suggestions; admins see all
      let filterLoungeId: string | undefined;
      if (req.user.type === 'lounge') {
        filterLoungeId = req.user._id?.toString();
      }

      const result = await this.serviceSuggestionsService.getServiceSuggestionsPaginated(page, limit, status, filterLoungeId);

      res.status(200).json({
        data: result.suggestions,
        pagination: {
          page: result.page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        },
        message: 'Service suggestions retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get service suggestion by ID
   */
  public getServiceSuggestionById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const suggestionId = req.params.suggestionId;

      const suggestion = await this.serviceSuggestionsService.getServiceSuggestionById(suggestionId);

      // Check if user can access this suggestion
      if (req.user.type === 'lounge' && (suggestion.loungeId as any)._id.toString() !== req.user._id?.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.status(200).json({
        data: suggestion,
        message: 'Service suggestion retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update service suggestion (lounge users can update their own pending suggestions)
   */
  public updateServiceSuggestion = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const suggestionId = req.params.suggestionId;
      const loungeId = req.user._id?.toString();

      if (!loungeId) {
        return next(new HttpException(401, 'Authentication required'));
      }

      const updateData = req.body;

      const suggestion = await this.serviceSuggestionsService.updateServiceSuggestion(suggestionId, loungeId, updateData);

      res.status(200).json({
        data: suggestion,
        message: 'Service suggestion updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update service suggestion status (admin only)
   */
  public updateServiceSuggestionStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const suggestionId = req.params.suggestionId;
      const statusData = req.body;

      const result = await this.serviceSuggestionsService.updateServiceSuggestionStatus(suggestionId, statusData);

      res.status(200).json(this.formatSuggestionStatusResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete service suggestion
   */
  public deleteServiceSuggestion = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const suggestionId = req.params.suggestionId;
      const loungeId = req.user.type === 'lounge' ? req.user._id : undefined;

      const suggestion = await this.serviceSuggestionsService.deleteServiceSuggestion(suggestionId, loungeId);

      res.status(200).json({
        data: stripSensitiveFields(suggestion),
        message: 'Service suggestion deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get service suggestions statistics (admin only)
   */
  public getServiceSuggestionsStats = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const stats = await this.serviceSuggestionsService.getServiceSuggestionsStats();

      res.status(200).json({
        data: stats,
        message: 'Service suggestions statistics retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Admin function to update service suggestion status and create service/lounge service when approved
   */
  public adminUpdateServiceSuggestionStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const suggestionId = req.params.suggestionId;
      const updateData = req.body;

      const result = await this.serviceSuggestionsService.adminUpdateServiceSuggestionStatus(suggestionId, updateData);

      res.status(200).json(this.formatSuggestionStatusResponse(result));
    } catch (error) {
      next(error);
    }
  };
}

export default ServiceSuggestionsController;
