import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import CartController from '@controllers/marketplace/cart.controller';
import { AddToCartDto, UpdateCartItemDto } from '@dtos/marketplace/cart.dto';

class CartRoute implements Routes {
  public path = '/v1/marketplace/cart';
  public router = Router();
  public controller = new CartController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authMiddleware);

    this.router.get('/', this.controller.getCart);
    this.router.post('/items', csrfMiddleware, validationMiddleware(AddToCartDto, 'body'), this.controller.addToCart);
    this.router.put('/items/:productId', csrfMiddleware, validationMiddleware(UpdateCartItemDto, 'body'), this.controller.updateCartItem);
    this.router.delete('/items/:productId', csrfMiddleware, this.controller.removeFromCart);
    this.router.delete('/clear', csrfMiddleware, this.controller.clearCart);
  }
}

export default CartRoute;
