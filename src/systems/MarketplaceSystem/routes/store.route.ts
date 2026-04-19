import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { adminMiddleware, adminOrLoungeOrClientMiddleware } from '@middlewares/role.middleware';
import { optionalUpload } from '@middlewares/imageUpload.middleware';
import StoreController from '@systems/MarketplaceSystem/controllers/store.controller';
import { CreateStoreDto, UpdateStoreDto } from '@systems/MarketplaceSystem/dtos/store.dto';

class StoreRoute implements Routes {
  public path = '/v1/marketplace/stores';
  public router = Router();
  public controller = new StoreController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Public
    this.router.get('/discover', this.controller.discoverStores);
    this.router.get('/slug/:slug', this.controller.getStoreBySlug);
    this.router.get('/:id', this.controller.getStoreById);

    // Authenticated owner
    this.router.post('/', authMiddleware, adminOrLoungeOrClientMiddleware, csrfMiddleware, validationMiddleware(CreateStoreDto, 'body'), this.controller.createStore);
    this.router.get('/me/store', authMiddleware, this.controller.getMyStore);
    this.router.put('/me/store', authMiddleware, csrfMiddleware, validationMiddleware(UpdateStoreDto, 'body'), this.controller.updateStore);
    this.router.put('/me/store/logo', authMiddleware, csrfMiddleware, optionalUpload('logo'), this.controller.uploadLogo);
    this.router.put('/me/store/banner', authMiddleware, csrfMiddleware, optionalUpload('banner'), this.controller.uploadBanner);
    this.router.delete('/me/store', authMiddleware, csrfMiddleware, this.controller.closeStore);

    // Admin
    this.router.get('/admin/all', authMiddleware, adminMiddleware, this.controller.adminGetStores);
    this.router.put('/admin/:id/status', authMiddleware, adminMiddleware, csrfMiddleware, this.controller.adminUpdateStoreStatus);
    this.router.put('/admin/:id/verify', authMiddleware, adminMiddleware, csrfMiddleware, this.controller.adminVerifyStore);
  }
}

export default StoreRoute;
