import { Router } from 'express';
import ServiceCategoriesController from '@systems/ServiceCatalogSystem/controllers/serviceCategories.controller';
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from '@systems/ServiceCatalogSystem/dtos/serviceCategories.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import { adminMiddleware } from '@middlewares/role.middleware';

class ServiceCategoriesRoute implements Routes {
  public path = '/v1/admin/service-categories';
  public router = Router();
  public serviceCategoriesController = new ServiceCategoriesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // All routes require authentication
    this.router.use(authMiddleware);

    // Get all service categories (public read)
    this.router.get('/', this.serviceCategoriesController.getAllServiceCategories);

    // Search service categories (public read)
    this.router.get('/search', this.serviceCategoriesController.searchServiceCategories);

    // Get service category by ID (public read)
    this.router.get('/:categoryId', this.serviceCategoriesController.getServiceCategoryById);

    // Create service category (admin only)
    this.router.post(
      '/',
      adminMiddleware,
      csrfMiddleware,
      validationMiddleware(CreateServiceCategoryDto, 'body'),
      this.serviceCategoriesController.createServiceCategory,
    );

    // Update service category (admin only)
    this.router.put(
      '/:categoryId',
      adminMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateServiceCategoryDto, 'body'),
      this.serviceCategoriesController.updateServiceCategory,
    );

    // Delete service category (admin only)
    this.router.delete('/:categoryId', adminMiddleware, csrfMiddleware, this.serviceCategoriesController.deleteServiceCategory);
  }
}

export default ServiceCategoriesRoute;
