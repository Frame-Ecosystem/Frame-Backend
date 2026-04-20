import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import ProductCategorySuggestionsController from '@systems/MarketplaceSystem/controllers/productCategorySuggestions.controller';
import {
  CreateProductCategorySuggestionDto,
  UpdateProductCategorySuggestionDto,
  UpdateProductCategorySuggestionStatusDto,
  AdminApproveProductCategorySuggestionDto,
} from '@systems/MarketplaceSystem/dtos/productCategorySuggestions.dto';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { adminMiddleware } from '@middlewares/role.middleware';

/**
 * Product Category Suggestions — community-driven category proposals
 * with admin moderation and auto-implementation.
 *
 *  GET    /                          → list (auth) — admins see all, others see own
 *  GET    /stats                     → counts (admin)
 *  GET    /:suggestionId             → fetch one (auth, owner or admin)
 *  POST   /                          → submit (any authenticated user + csrf)
 *  PUT    /:suggestionId             → owner edit while pending (csrf)
 *  PATCH  /:suggestionId/status      → admin moderation (csrf)
 *  PATCH  /:suggestionId/admin-approve → admin one-shot approve & implement (csrf)
 *  DELETE /:suggestionId             → owner deletes own / admin deletes any (csrf)
 */
class ProductCategorySuggestionsRoute implements Routes {
  public path = '/v1/marketplace/product-category-suggestions';
  public router = Router();
  public controller = new ProductCategorySuggestionsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get('/', authMiddleware, this.controller.getSuggestionsPaginated);
    this.router.get('/stats', authMiddleware, adminMiddleware, this.controller.getStats);
    this.router.get('/:suggestionId', authMiddleware, this.controller.getSuggestionById);

    this.router.post(
      '/',
      authMiddleware,
      csrfMiddleware,
      validationMiddleware(CreateProductCategorySuggestionDto, 'body', false, true, false),
      this.controller.createSuggestion,
    );

    this.router.put(
      '/:suggestionId',
      authMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateProductCategorySuggestionDto, 'body'),
      this.controller.updateSuggestion,
    );

    this.router.patch(
      '/:suggestionId/status',
      authMiddleware,
      adminMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateProductCategorySuggestionStatusDto, 'body'),
      this.controller.updateSuggestionStatus,
    );

    this.router.patch(
      '/:suggestionId/admin-approve',
      authMiddleware,
      adminMiddleware,
      csrfMiddleware,
      validationMiddleware(AdminApproveProductCategorySuggestionDto, 'body'),
      this.controller.adminApproveSuggestion,
    );

    this.router.delete('/:suggestionId', authMiddleware, csrfMiddleware, this.controller.deleteSuggestion);
  }
}

export default ProductCategorySuggestionsRoute;
