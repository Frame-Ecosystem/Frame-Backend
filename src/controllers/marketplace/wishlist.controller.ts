import { Response, NextFunction } from 'express';
import { RequestWithUser } from '@interfaces/auth/auth.interface';
import WishlistService from '@services/marketplace/wishlist.service';

class WishlistController {
  private wishlistService = new WishlistService();

  public getWishlist = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { items, total } = await this.wishlistService.getWishlist(req.user._id.toString(), req.query as any);
      res.status(200).json({ data: items, count: total, message: 'Wishlist retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public addToWishlist = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const item = await this.wishlistService.addToWishlist(req.user._id.toString(), req.params.productId);
      res.status(200).json({ data: item, message: 'Added to wishlist' });
    } catch (error) {
      next(error);
    }
  };

  public removeFromWishlist = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      await this.wishlistService.removeFromWishlist(req.user._id.toString(), req.params.productId);
      res.status(200).json({ message: 'Removed from wishlist' });
    } catch (error) {
      next(error);
    }
  };
}

export default WishlistController;
