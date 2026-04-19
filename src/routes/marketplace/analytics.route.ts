import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { adminMiddleware } from '@middlewares/role.middleware';
import MarketplaceAnalyticsController from '@controllers/marketplace/analytics.controller';

class MarketplaceAnalyticsRoute implements Routes {
  public path = '/v1/marketplace/analytics';
  public router = Router();
  public controller = new MarketplaceAnalyticsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authMiddleware);

    // Store owner
    this.router.get('/my-store', this.controller.getMyStoreAnalytics);
    this.router.get('/store/:storeId', this.controller.getStoreAnalytics);

    // Admin
    this.router.get('/admin', adminMiddleware, this.controller.getAdminAnalytics);
  }
}

export default MarketplaceAnalyticsRoute;
