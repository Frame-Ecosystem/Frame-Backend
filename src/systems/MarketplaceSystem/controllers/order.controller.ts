import { Response, NextFunction } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import OrderService from '@systems/MarketplaceSystem/services/order.service';
import { OrderStatus } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

class OrderController {
  private orderService = new OrderService();

  /* ───────── Buyer ───────── */

  public createOrder = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const order = await this.orderService.createOrder(req.user._id.toString(), req.body);
      res.status(201).json({ data: order, message: 'Order placed' });
    } catch (error) {
      next(error);
    }
  };

  public getMyOrders = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { orders, total } = await this.orderService.getMyOrders(req.user._id.toString(), req.query as any);
      res.status(200).json({ data: orders, count: total, message: 'Orders retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public getOrderById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user.type === 'admin';
      const order = await this.orderService.getOrderById(req.params.id, req.user._id.toString(), isAdmin);
      res.status(200).json({ data: order, message: 'Order retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /* ───────── Store Owner ───────── */

  public getStoreOrders = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { orders, total } = await this.orderService.getStoreOrders(req.params.storeId, req.user._id.toString(), req.query as any);
      res.status(200).json({ data: orders, count: total, message: 'Orders retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /* ───────── Status Updates ───────── */

  public updateOrderStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const order = await this.orderService.updateOrderStatus(req.params.id, req.user._id.toString(), req.body.status as OrderStatus, {
        reason: req.body.reason,
        trackingNumber: req.body.trackingNumber,
        trackingUrl: req.body.trackingUrl,
      });
      res.status(200).json({ data: order, message: 'Order status updated' });
    } catch (error) {
      next(error);
    }
  };

  /* ───────── Admin ───────── */

  public adminGetOrders = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { orders, total } = await this.orderService.adminGetOrders(req.query as any);
      res.status(200).json({ data: orders, count: total, message: 'Orders retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public adminResolveDispute = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const order = await this.orderService.adminResolveDispute(
        req.params.id,
        req.body.resolution as OrderStatus,
        req.body.notes,
        req.body.refundAmount,
      );
      res.status(200).json({ data: order, message: 'Dispute resolved' });
    } catch (error) {
      next(error);
    }
  };
}

export default OrderController;
