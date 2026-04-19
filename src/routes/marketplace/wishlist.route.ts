import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import WishlistController from '@controllers/marketplace/wishlist.controller';

class WishlistRoute implements Routes {
  public path = '/v1/marketplace/wishlist';
  public router = Router();
  public controller = new WishlistController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authMiddleware);

    this.router.get('/', this.controller.getWishlist);
    this.router.post('/:productId', csrfMiddleware, this.controller.addToWishlist);
    this.router.delete('/:productId', csrfMiddleware, this.controller.removeFromWishlist);
  }
}

export default WishlistRoute;
