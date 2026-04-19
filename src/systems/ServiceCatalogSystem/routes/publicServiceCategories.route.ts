import { Router } from 'express';
import PublicServiceCategoriesController from '@systems/ServiceCatalogSystem/controllers/publicServiceCategories.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';

class PublicServiceCategoriesRoute implements Routes {
  public path = '/v1/service-categories';
  public router = Router();
  public controller = new PublicServiceCategoriesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get('/', authMiddleware, this.controller.getAllServiceCategories);
    this.router.get('/:id', authMiddleware, this.controller.getServiceCategoryById);
  }
}

export default PublicServiceCategoriesRoute;
