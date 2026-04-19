import { Router } from 'express';
import PublicServicesController from '@systems/ServiceCatalogSystem/controllers/publicServices.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';

class PublicServicesRoute implements Routes {
  public path = '/v1/services';
  public router = Router();
  public controller = new PublicServicesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get('/', authMiddleware, this.controller.getAllServices);
    this.router.get('/:id', authMiddleware, this.controller.getServiceById);
  }
}

export default PublicServicesRoute;
