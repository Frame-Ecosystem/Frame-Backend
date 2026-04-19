import mongoose from 'mongoose';
import { BadRequestException, NotFoundException, ForbiddenException } from '@exceptions/HttpException';
import orderModel from '@models/marketplace/order.model';
import productModel from '@models/marketplace/product.model';
import storeModel from '@models/marketplace/store.model';
import cartModel from '@models/marketplace/cart.model';
import { Order, OrderStatus, PaymentStatus, ProductStatus, StoreStatus } from '@interfaces/marketplace/marketplace.interface';
import { CreateOrderDto } from '@dtos/marketplace/order.dto';

class OrderService {
  private orders = orderModel;
  private products = productModel;
  private stores = storeModel;
  private carts = cartModel;

  /* ───────── Order Number Generator ───────── */

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const prefix = `FR${date.getFullYear().toString().slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.orders.countDocuments({
      createdAt: { $gte: new Date(date.getFullYear(), date.getMonth(), 1) },
    });
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  /* ───────── Create ───────── */

  public async createOrder(buyerId: string, dto: CreateOrderDto): Promise<Order> {
    if (!mongoose.Types.ObjectId.isValid(dto.storeId)) throw new BadRequestException('Invalid store ID', 'INVALID_STORE_ID');

    // Verify store exists and is active
    const store = await this.stores.findById(dto.storeId);
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');
    if (store.status !== StoreStatus.ACTIVE) throw new BadRequestException('Store is not active', 'STORE_NOT_ACTIVE');

    // Prevent buying from own store
    if (store.ownerId.toString() === buyerId) throw new BadRequestException('Cannot buy from your own store', 'SELF_PURCHASE');

    // Validate and build order items
    const orderItems: any[] = [];
    let subtotal = 0;

    for (const item of dto.items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        throw new BadRequestException(`Invalid product ID: ${item.productId}`, 'INVALID_PRODUCT_ID');
      }

      const product = await this.products.findById(item.productId);
      if (!product) throw new NotFoundException(`Product not found: ${item.productId}`, 'PRODUCT_NOT_FOUND');
      if (product.storeId.toString() !== dto.storeId) throw new BadRequestException('Product does not belong to this store', 'PRODUCT_STORE_MISMATCH');
      if (product.status !== ProductStatus.ACTIVE) throw new BadRequestException(`Product is not available: ${product.name}`, 'PRODUCT_NOT_ACTIVE');

      let price = product.price;
      let availableStock = product.stock;

      // Handle variant
      if (item.variantIndex !== undefined) {
        if (item.variantIndex < 0 || item.variantIndex >= product.variants.length) {
          throw new BadRequestException('Invalid variant index', 'INVALID_VARIANT');
        }
        const variant = product.variants[item.variantIndex];
        price = variant.price;
        availableStock = variant.stock;
      }

      if (availableStock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`, 'INSUFFICIENT_STOCK');
      }

      const primaryImage = product.images.find((img: any) => img.isPrimary) || product.images[0];

      orderItems.push({
        productId: product._id,
        variantIndex: item.variantIndex,
        name: product.name,
        price,
        quantity: item.quantity,
        image: primaryImage?.url || '',
      });

      subtotal += price * item.quantity;
    }

    const orderNumber = await this.generateOrderNumber();
    const shippingCost = 0; // Can be calculated based on location/weight later
    const total = subtotal + shippingCost;

    const order = await this.orders.create({
      orderNumber,
      buyerId,
      storeId: dto.storeId,
      items: orderItems,
      subtotal,
      shippingCost,
      total,
      paymentMethod: dto.paymentMethod,
      shippingAddress: dto.shippingAddress,
      notes: dto.notes || '',
    });

    // Deduct stock
    for (const item of dto.items) {
      if (item.variantIndex !== undefined) {
        await this.products.findByIdAndUpdate(item.productId, {
          $inc: {
            [`variants.${item.variantIndex}.stock`]: -item.quantity,
            stock: -item.quantity,
          },
        });
      } else {
        await this.products.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity },
        });
      }
    }

    // Update store stats
    await this.stores.findByIdAndUpdate(dto.storeId, {
      $inc: { 'stats.totalOrders': 1 },
    });

    // Clear these items from buyer's cart
    await this.carts.findOneAndUpdate(
      { userId: buyerId },
      { $pull: { items: { storeId: dto.storeId } } },
    );

    return order;
  }

  /* ───────── Read ───────── */

  public async getOrderById(id: string, userId: string, isAdmin: boolean = false): Promise<Order> {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid order ID', 'INVALID_ORDER_ID');

    const order = await this.orders.findById(id)
      .populate('buyerId', 'firstName lastName profileImage')
      .populate('storeId', 'name slug logo ownerId');

    if (!order) throw new NotFoundException('Order not found', 'ORDER_NOT_FOUND');

    // Verify access: buyer, store owner, or admin
    if (!isAdmin) {
      const isBuyer = order.buyerId._id?.toString() === userId || (order.buyerId as any).toString() === userId;
      const isStoreOwner = (order.storeId as any).ownerId?.toString() === userId;
      if (!isBuyer && !isStoreOwner) throw new ForbiddenException('Access denied');
    }

    return order;
  }

  public async getMyOrders(buyerId: string, query: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ orders: Order[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { buyerId };
    if (query.status) filter.status = query.status;

    const [orders, total] = await Promise.all([
      this.orders.find(filter).populate('storeId', 'name slug logo').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.orders.countDocuments(filter),
    ]);

    return { orders, total };
  }

  public async getStoreOrders(storeId: string, ownerId: string, query: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ orders: Order[]; total: number }> {
    if (!mongoose.Types.ObjectId.isValid(storeId)) throw new BadRequestException('Invalid store ID', 'INVALID_STORE_ID');

    const store = await this.stores.findById(storeId);
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');
    if (store.ownerId.toString() !== ownerId) throw new ForbiddenException('You do not own this store');

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { storeId };
    if (query.status) filter.status = query.status;

    const [orders, total] = await Promise.all([
      this.orders.find(filter).populate('buyerId', 'firstName lastName profileImage').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.orders.countDocuments(filter),
    ]);

    return { orders, total };
  }

  /* ───────── Status Updates ───────── */

  public async updateOrderStatus(orderId: string, userId: string, status: OrderStatus, data?: {
    reason?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  }): Promise<Order> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) throw new BadRequestException('Invalid order ID', 'INVALID_ORDER_ID');

    const order = await this.orders.findById(orderId).populate('storeId', 'ownerId');
    if (!order) throw new NotFoundException('Order not found', 'ORDER_NOT_FOUND');

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.DISPUTED],
      [OrderStatus.DISPUTED]: [OrderStatus.REFUNDED, OrderStatus.DELIVERED],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${order.status} to ${status}`, 'INVALID_STATUS_TRANSITION');
    }

    // Verify permissions
    const isStoreOwner = (order.storeId as any).ownerId?.toString() === userId;
    const isBuyer = order.buyerId.toString() === userId;

    // Seller can: confirm, process, ship
    // Buyer can: cancel (before shipped), mark delivered, dispute
    if ([OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED].includes(status) && !isStoreOwner) {
      throw new ForbiddenException('Only the store owner can update this status');
    }
    if (status === OrderStatus.CANCELLED && !isBuyer && !isStoreOwner) {
      throw new ForbiddenException('Only buyer or store owner can cancel');
    }
    if (status === OrderStatus.DELIVERED && !isBuyer) {
      throw new ForbiddenException('Only buyer can confirm delivery');
    }
    if (status === OrderStatus.DISPUTED && !isBuyer) {
      throw new ForbiddenException('Only buyer can open a dispute');
    }

    order.status = status;

    if (status === OrderStatus.CANCELLED) {
      order.cancelReason = data?.reason || '';
      // Restore stock
      for (const item of order.items) {
        if (item.variantIndex !== undefined) {
          await this.products.findByIdAndUpdate(item.productId, {
            $inc: {
              [`variants.${item.variantIndex}.stock`]: item.quantity,
              stock: item.quantity,
            },
          });
        } else {
          await this.products.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity },
          });
        }
      }
    }

    if (status === OrderStatus.SHIPPED) {
      order.trackingNumber = data?.trackingNumber || '';
      order.trackingUrl = data?.trackingUrl || '';
    }

    if (status === OrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
      order.paymentStatus = PaymentStatus.PAID;
      // Update store revenue and product stats
      await this.stores.findByIdAndUpdate(order.storeId, {
        $inc: { 'stats.totalRevenue': order.total },
      });
      for (const item of order.items) {
        await this.products.findByIdAndUpdate(item.productId, {
          $inc: { 'stats.totalSold': item.quantity, 'stats.totalRevenue': item.price * item.quantity },
        });
      }
    }

    if (status === OrderStatus.DISPUTED) {
      order.disputeReason = data?.reason || '';
    }

    await order.save();
    return order;
  }

  /* ───────── Admin ───────── */

  public async adminGetOrders(query: {
    page?: number;
    limit?: number;
    status?: string;
    storeId?: string;
  }): Promise<{ orders: Order[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.storeId) filter.storeId = query.storeId;

    const [orders, total] = await Promise.all([
      this.orders.find(filter)
        .populate('buyerId', 'firstName lastName email')
        .populate('storeId', 'name slug ownerId')
        .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.orders.countDocuments(filter),
    ]);

    return { orders, total };
  }

  public async adminResolveDispute(orderId: string, resolution: OrderStatus, notes?: string, refundAmount?: number): Promise<Order> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) throw new BadRequestException('Invalid order ID', 'INVALID_ORDER_ID');

    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundException('Order not found', 'ORDER_NOT_FOUND');
    if (order.status !== OrderStatus.DISPUTED) throw new BadRequestException('Order is not in disputed state', 'NOT_DISPUTED');

    order.status = resolution;
    order.disputeResolution = notes || '';

    if (resolution === OrderStatus.REFUNDED) {
      order.refundAmount = refundAmount || order.total;
      order.refundReason = notes || '';
      order.paymentStatus = PaymentStatus.REFUNDED;

      // Restore stock
      for (const item of order.items) {
        if (item.variantIndex !== undefined) {
          await this.products.findByIdAndUpdate(item.productId, {
            $inc: {
              [`variants.${item.variantIndex}.stock`]: item.quantity,
              stock: item.quantity,
            },
          });
        } else {
          await this.products.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity },
          });
        }
      }
    }

    await order.save();
    return order;
  }
}

export default OrderService;
