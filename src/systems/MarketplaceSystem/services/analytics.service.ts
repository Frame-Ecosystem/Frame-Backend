import mongoose from 'mongoose';
import { BadRequestException, NotFoundException, ForbiddenException } from '@exceptions/HttpException';
import storeModel from '@systems/MarketplaceSystem/models/store.model';
import productModel from '@systems/MarketplaceSystem/models/product.model';
import orderModel from '@systems/MarketplaceSystem/models/order.model';
import reviewModel from '@systems/MarketplaceSystem/models/review.model';
import { OrderStatus, StoreStatus } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

class MarketplaceAnalyticsService {
  private stores = storeModel;
  private products = productModel;
  private orders = orderModel;
  private reviews = reviewModel;

  /* ───────── Store Analytics (for store owner) ───────── */

  public async getStoreAnalytics(storeId: string, ownerId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(storeId)) throw new BadRequestException('Invalid store ID', 'INVALID_STORE_ID');

    const store = await this.stores.findById(storeId);
    if (!store) throw new NotFoundException('Store not found', 'STORE_NOT_FOUND');
    if (store.ownerId.toString() !== ownerId) throw new ForbiddenException('You do not own this store');

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const [revenueData, ordersByStatus, topProducts, recentOrders, dailyRevenue, totalProducts] = await Promise.all([
      // Revenue summary for last 30 days
      this.orders.aggregate([
        {
          $match: {
            storeId: storeObjId,
            status: { $in: [OrderStatus.DELIVERED, OrderStatus.SHIPPED, OrderStatus.PROCESSING] },
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            avgOrderValue: { $avg: '$total' },
          },
        },
      ]),

      // Orders by status
      this.orders.aggregate([{ $match: { storeId: storeObjId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),

      // Top 10 selling products
      this.products
        .find({ storeId })
        .sort({ 'stats.totalSold': -1 })
        .limit(10)
        .select('name slug price stats.totalSold stats.totalRevenue stats.averageRating images')
        .lean(),

      // Recent 5 orders
      this.orders.find({ storeId }).populate('buyerId', 'firstName lastName profileImage').sort({ createdAt: -1 }).limit(5).lean(),

      // Daily revenue for last 7 days
      this.orders.aggregate([
        {
          $match: {
            storeId: storeObjId,
            status: { $in: [OrderStatus.DELIVERED] },
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Product counts
      this.products.countDocuments({ storeId }),
    ]);

    const revenue = revenueData[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };

    return {
      overview: {
        totalRevenue: store.stats.totalRevenue,
        totalOrders: store.stats.totalOrders,
        totalProducts,
        averageRating: store.stats.averageRating,
        ratingCount: store.stats.ratingCount,
      },
      last30Days: {
        revenue: revenue.totalRevenue,
        orders: revenue.totalOrders,
        avgOrderValue: Math.round((revenue.avgOrderValue || 0) * 100) / 100,
      },
      ordersByStatus: ordersByStatus.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      topProducts,
      recentOrders,
      dailyRevenue,
    };
  }

  /* ───────── Admin Marketplace Analytics ───────── */

  public async getAdminAnalytics(): Promise<any> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [storesByStatus, totalProducts, totalOrders, revenueData, topStores, recentDisputes, dailyOrders] = await Promise.all([
      // Stores by status
      this.stores.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),

      this.products.countDocuments(),
      this.orders.countDocuments(),

      // Total marketplace revenue
      this.orders.aggregate([{ $match: { status: OrderStatus.DELIVERED } }, { $group: { _id: null, total: { $sum: '$total' } } }]),

      // Top 10 stores by revenue
      this.stores
        .find({ status: StoreStatus.ACTIVE })
        .sort({ 'stats.totalRevenue': -1 })
        .limit(10)
        .populate('ownerId', 'firstName lastName email type')
        .select('name slug stats badge isVerified category')
        .lean(),

      // Recent disputed orders
      this.orders
        .find({ status: OrderStatus.DISPUTED })
        .populate('buyerId', 'firstName lastName email')
        .populate('storeId', 'name slug ownerId')
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),

      // Daily orders for last 30 days
      this.orders.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$total' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      overview: {
        totalStores: storesByStatus.reduce((sum: number, s: any) => sum + s.count, 0),
        storesByStatus: storesByStatus.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        totalProducts,
        totalOrders,
        totalRevenue: revenueData[0]?.total || 0,
      },
      topStores,
      recentDisputes,
      dailyOrders,
    };
  }
}

export default MarketplaceAnalyticsService;
