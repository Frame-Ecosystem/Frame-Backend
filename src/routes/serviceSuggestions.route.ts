import { Router } from 'express';
import ServiceSuggestionsController from '@controllers/serviceSuggestions.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import adminMiddleware from '@middlewares/admin.middleware';
import loungeMiddleware from '@middlewares/lounge.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import {
  CreateServiceSuggestionDto,
  UpdateServiceSuggestionDto,
  UpdateServiceSuggestionStatusDto,
  AdminApproveServiceSuggestionDto,
} from '@dtos/serviceSuggestions.dto';

class ServiceSuggestionsRoute implements Routes {
  public path = '/v1/service-suggestions';
  public router = Router();
  public serviceSuggestionsController = new ServiceSuggestionsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // GET - Get service suggestions with pagination and filtering
    this.router.get('/', authMiddleware, this.serviceSuggestionsController.getServiceSuggestionsPaginated);

    // GET - Get service suggestions statistics (admin only)
    this.router.get('/stats', authMiddleware, adminMiddleware, this.serviceSuggestionsController.getServiceSuggestionsStats);

    // GET - Get service suggestion by ID
    this.router.get('/:suggestionId', authMiddleware, this.serviceSuggestionsController.getServiceSuggestionById);

    // POST - Create a new service suggestion (lounge only)
    this.router.post(
      '/',
      authMiddleware,
      loungeMiddleware,
      csrfMiddleware,
      validationMiddleware(CreateServiceSuggestionDto, 'body', false, true, false),
      this.serviceSuggestionsController.createServiceSuggestion,
    );

    // PUT - Update service suggestion (lounge can update their own pending suggestions)
    this.router.put(
      '/:suggestionId',
      authMiddleware,
      loungeMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateServiceSuggestionDto, 'body'),
      this.serviceSuggestionsController.updateServiceSuggestion,
    );

    // PATCH - Update service suggestion status (admin only)
    this.router.patch(
      '/:suggestionId/status',
      authMiddleware,
      adminMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateServiceSuggestionStatusDto, 'body'),
      this.serviceSuggestionsController.updateServiceSuggestionStatus,
    );

    // PATCH - Admin approve service suggestion and create service/lounge service
    this.router.patch(
      '/:suggestionId/admin-approve',
      authMiddleware,
      adminMiddleware,
      csrfMiddleware,
      validationMiddleware(AdminApproveServiceSuggestionDto, 'body'),
      this.serviceSuggestionsController.adminUpdateServiceSuggestionStatus,
    );

    // DELETE - Delete service suggestion
    this.router.delete('/:suggestionId', authMiddleware, csrfMiddleware, this.serviceSuggestionsController.deleteServiceSuggestion);
  }
}

export default ServiceSuggestionsRoute;
