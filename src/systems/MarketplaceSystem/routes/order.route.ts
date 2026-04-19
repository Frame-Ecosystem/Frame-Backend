import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { adminMiddleware } from '@middlewares/role.middleware';
import OrderController from '@systems/MarketplaceSystem/controllers/order.controller';
import { CreateOrderDto, UpdateOrderStatusDto } from '@systems/MarketplaceSystem/dtos/order.dto';

class OrderRoute implements Routes {
  public path = '/v1/marketplace/orders';
  public router = Router();
  public controller = new OrderController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authMiddleware);

    // Buyer
    this.router.post('/', csrfMiddleware, validationMiddleware(CreateOrderDto, 'body'), this.controller.createOrder);
    this.router.get('/me', this.controller.getMyOrders);
    this.router.get('/:id', this.controller.getOrderById);

    // Store owner
    this.router.get('/store/:storeId', this.controller.getStoreOrders);

    // Status updates (owner or buyer depending on status)
    this.router.put('/:id/status', csrfMiddleware, validationMiddleware(UpdateOrderStatusDto, 'body'), this.controller.updateOrderStatus);

    // Admin
    this.router.get('/admin/all', adminMiddleware, this.controller.adminGetOrders);
    this.router.put('/admin/:id/resolve', adminMiddleware, csrfMiddleware, this.controller.adminResolveDispute);
  }
}

export default OrderRoute;
