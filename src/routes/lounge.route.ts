import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';

class LoungeRoute implements Routes {
  public path = '/v1/lounge';
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Lounge-specific routes can be added here if needed
  }
}

export default LoungeRoute;
