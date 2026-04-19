import { Response, NextFunction } from 'express';
import { RequestWithUser } from '@interfaces/auth/auth.interface';
import MarketplaceAnalyticsService from '@services/marketplace/analytics.service';
import StoreService from '@services/marketplace/store.service';

class MarketplaceAnalyticsController {
  private analyticsService = new MarketplaceAnalyticsService();
  private storeService = new StoreService();

  /* ───────── Store Owner Dashboard ───────── */

  public getStoreAnalytics = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const analytics = await this.analyticsService.getStoreAnalytics(
        req.params.storeId,
        req.user._id.toString(),
      );
      res.status(200).json({ data: analytics, message: 'Analytics retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public getMyStoreAnalytics = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = await this.storeService.getMyStore(req.user._id.toString());
      const analytics = await this.analyticsService.getStoreAnalytics(
        store._id.toString(),
        req.user._id.toString(),
      );
      res.status(200).json({ data: analytics, message: 'Analytics retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /* ───────── Admin ───────── */

  public getAdminAnalytics = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const analytics = await this.analyticsService.getAdminAnalytics();
      res.status(200).json({ data: analytics, message: 'Admin analytics retrieved' });
    } catch (error) {
      next(error);
    }
  };
}

export default MarketplaceAnalyticsController;
