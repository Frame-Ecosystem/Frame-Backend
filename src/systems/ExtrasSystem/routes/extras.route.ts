import { Router } from 'express';
import PublicExtrasController from '@systems/ExtrasSystem/controllers/publicExtras.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';

class ExtraRoute implements Routes {
  public path = '/v1/extras';
  public router = Router();
  public publicExtrasController = new PublicExtrasController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get('/', authMiddleware, this.publicExtrasController.getAll);
  }
}

export default ExtraRoute;
