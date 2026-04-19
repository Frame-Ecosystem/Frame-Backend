import { Router } from 'express';
import IndexController from '@systems/AdminSystem/controllers/index.controller';
import { Routes } from '@interfaces/routes.interface';

class IndexRoute implements Routes {
  public path = '/';
  public router = Router();
  public indexController = new IndexController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Health check endpoint - no auth required for load balancer/k8s probes
    this.router.get(`${this.path}`, this.indexController.index);
    this.router.get(`${this.path}health`, this.indexController.index);
  }
}

export default IndexRoute;
