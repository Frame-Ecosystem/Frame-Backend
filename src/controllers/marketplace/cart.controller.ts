import { Response, NextFunction } from 'express';
import { RequestWithUser } from '@interfaces/auth/auth.interface';
import CartService from '@services/marketplace/cart.service';

class CartController {
  private cartService = new CartService();

  public getCart = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const cart = await this.cartService.getCart(req.user._id.toString());
      res.status(200).json({ data: cart, message: 'Cart retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public addToCart = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const cart = await this.cartService.addToCart(
        req.user._id.toString(),
        req.body.productId,
        req.body.quantity,
        req.body.variantIndex,
      );
      res.status(200).json({ data: cart, message: 'Item added to cart' });
    } catch (error) {
      next(error);
    }
  };

  public updateCartItem = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const variantIndex = req.query.variantIndex !== undefined ? Number(req.query.variantIndex) : undefined;
      const cart = await this.cartService.updateCartItem(
        req.user._id.toString(),
        req.params.productId,
        req.body.quantity,
        variantIndex,
      );
      res.status(200).json({ data: cart, message: 'Cart updated' });
    } catch (error) {
      next(error);
    }
  };

  public removeFromCart = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const variantIndex = req.query.variantIndex !== undefined ? Number(req.query.variantIndex) : undefined;
      const cart = await this.cartService.removeFromCart(
        req.user._id.toString(),
        req.params.productId,
        variantIndex,
      );
      res.status(200).json({ data: cart, message: 'Item removed' });
    } catch (error) {
      next(error);
    }
  };

  public clearCart = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const cart = await this.cartService.clearCart(req.user._id.toString());
      res.status(200).json({ data: cart, message: 'Cart cleared' });
    } catch (error) {
      next(error);
    }
  };
}

export default CartController;
