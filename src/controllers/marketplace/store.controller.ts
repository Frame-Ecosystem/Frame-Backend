import { Response, NextFunction } from 'express';
import { RequestWithUser } from '@interfaces/auth/auth.interface';
import StoreService from '@services/marketplace/store.service';
import { StoreStatus } from '@interfaces/marketplace/marketplace.interface';

class StoreController {
  private storeService = new StoreService();

  /* ───────── Public ───────── */

  public discoverStores = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { stores, total } = await this.storeService.discoverStores(req.query as any);
      res.status(200).json({ data: stores, count: total, message: 'Stores retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public getStoreBySlug = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = await this.storeService.getStoreBySlug(req.params.slug);
      res.status(200).json({ data: store, message: 'Store retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public getStoreById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = await this.storeService.getStoreById(req.params.id);
      res.status(200).json({ data: store, message: 'Store retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /* ───────── Owner ───────── */

  public createStore = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = await this.storeService.createStore(req.user._id.toString(), req.body);
      res.status(201).json({ data: store, message: 'Store created — pending approval' });
    } catch (error) {
      next(error);
    }
  };

  public getMyStore = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = await this.storeService.getMyStore(req.user._id.toString());
      res.status(200).json({ data: store, message: 'Store retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public updateStore = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = await this.storeService.updateStore(req.user._id.toString(), req.body);
      res.status(200).json({ data: store, message: 'Store updated' });
    } catch (error) {
      next(error);
    }
  };

  public uploadLogo = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file provided' });
      const store = await this.storeService.uploadStoreLogo(req.user._id.toString(), req.file.buffer);
      res.status(200).json({ data: store, message: 'Logo uploaded' });
    } catch (error) {
      next(error);
    }
  };

  public uploadBanner = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file provided' });
      const store = await this.storeService.uploadStoreBanner(req.user._id.toString(), req.file.buffer);
      res.status(200).json({ data: store, message: 'Banner uploaded' });
    } catch (error) {
      next(error);
    }
  };

  public closeStore = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      await this.storeService.closeStore(req.user._id.toString());
      res.status(200).json({ message: 'Store closed' });
    } catch (error) {
      next(error);
    }
  };

  /* ───────── Admin ───────── */

  public adminGetStores = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { stores, total } = await this.storeService.adminGetStores(req.query as any);
      res.status(200).json({ data: stores, count: total, message: 'Stores retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public adminUpdateStoreStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = await this.storeService.adminUpdateStoreStatus(
        req.params.id,
        req.body.status as StoreStatus,
        req.body.reason,
      );
      res.status(200).json({ data: store, message: 'Store status updated' });
    } catch (error) {
      next(error);
    }
  };

  public adminVerifyStore = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = await this.storeService.adminVerifyStore(req.params.id, req.body.badge || 'verified');
      res.status(200).json({ data: store, message: 'Store verified' });
    } catch (error) {
      next(error);
    }
  };
}

export default StoreController;
