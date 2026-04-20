/**
 * MarketplaceSystem — HTTP Route Tests
 *
 * Covers:
 *   GET  /v1/marketplace/stores/discover     (public)
 *   GET  /v1/marketplace/stores/slug/:slug   (public)
 *   GET  /v1/marketplace/stores/:id          (public)
 *   POST /v1/marketplace/stores              (client only)
 *   PUT  /v1/marketplace/stores/:id          (owner)
 *   DELETE /v1/marketplace/stores/:id        (owner/admin)
 *   GET  /v1/marketplace/stores/:storeId/products
 *   POST /v1/marketplace/products            (store owner)
 *   GET  /v1/marketplace/products/search
 *   GET  /v1/marketplace/products/:id
 *   PUT  /v1/marketplace/products/:id
 *   DELETE /v1/marketplace/products/:id
 *   GET  /v1/marketplace/cart
 *   POST /v1/marketplace/cart/items
 *   PUT  /v1/marketplace/cart/items/:productId
 *   DELETE /v1/marketplace/cart/items/:productId
 *   DELETE /v1/marketplace/cart
 *   POST /v1/marketplace/orders
 *   GET  /v1/marketplace/orders
 *   GET  /v1/marketplace/orders/:id
 *   PUT  /v1/marketplace/orders/:id/cancel
 *   GET  /v1/marketplace/orders/store/:storeId  (store owner)
 *   POST /v1/marketplace/reviews/:productId
 *   GET  /v1/marketplace/reviews/:productId
 *   GET  /v1/marketplace/wishlist
 *   POST /v1/marketplace/wishlist/:productId
 *   DELETE /v1/marketplace/wishlist/:productId
 *   GET  /v1/marketplace/analytics/store/:storeId  (store owner/admin)
 */

// ── Hoist mocks ───────────────────────────────────────────────────────────────

jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  connect: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue(undefined),
  set: jest.fn(),
  connection: { readyState: 1, host: 'test', name: 'test' },
}));

jest.mock('@utils/initAdmin', () => ({
  ensureAdminExists: jest.fn().mockResolvedValue(undefined),
  ensureCollectionExists: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@systems/NotificationSystem/services/socket.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      initialize: jest.fn(),
      emitToUser: jest.fn(),
      getOnlineUsers: jest.fn().mockReturnValue(new Set()),
      getOnlineUsersCount: jest.fn().mockReturnValue(0),
    }),
  },
}));

jest.mock('@middlewares/csrf.middleware', () => ({
  __esModule: true,
  default: jest.fn((_req: any, _res: any, next: any) => next()),
}));

jest.mock('@middlewares/rateLimit.middleware', () => ({
  loginRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  signupRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  forgotPasswordRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  generalRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  strictRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  likeRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  followRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  contentCreateRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  commentRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
  reportRateLimiter: jest.fn((_req: any, _res: any, next: any) => next()),
}));

jest.mock('@middlewares/imageUpload.middleware', () => ({
  __esModule: true,
  default: {
    single: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
    array: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  },
  optionalUpload: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
}));

jest.mock('@systems/UserManager/models/user.model', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
  isAdmin: (user: any) => user?.type === 'admin',
  isLounge: (user: any) => user?.type === 'lounge',
  isClient: (user: any) => user?.type === 'client',
}));

// Marketplace service mocks
jest.mock('@systems/MarketplaceSystem/services/store.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    discoverStores: jest.fn().mockResolvedValue({ stores: [], total: 0 }),
    getStoreBySlug: jest.fn().mockResolvedValue({ _id: 'store1', slug: 'test-store', name: 'Test Store' }),
    getStoreById: jest.fn().mockResolvedValue({ _id: 'store1', name: 'Test Store' }),
    createStore: jest.fn().mockResolvedValue({ _id: 'store1', name: 'New Store', slug: 'new-store' }),
    updateStore: jest.fn().mockResolvedValue({ _id: 'store1', name: 'Updated Store' }),
    deleteStore: jest.fn().mockResolvedValue(undefined),
    searchStores: jest.fn().mockResolvedValue({ stores: [], total: 0 }),
    getMyStore: jest.fn().mockResolvedValue({ _id: 'store1', name: 'My Store' }),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/product.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createProduct: jest.fn().mockResolvedValue({ _id: 'product1', name: 'Test Product', price: 50 }),
    getProductById: jest.fn().mockResolvedValue({ _id: 'product1', name: 'Test Product', price: 50 }),
    getStoreProducts: jest.fn().mockResolvedValue({ products: [], total: 0 }),
    searchProducts: jest.fn().mockResolvedValue({ products: [], total: 0 }),
    updateProduct: jest.fn().mockResolvedValue({ _id: 'product1', name: 'Updated Product' }),
    deleteProduct: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/cart.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getCart: jest.fn().mockResolvedValue({ _id: 'cart1', items: [], total: 0 }),
    addToCart: jest.fn().mockResolvedValue({ _id: 'cart1', items: [{ productId: 'p1', quantity: 1 }], total: 50 }),
    updateCartItem: jest.fn().mockResolvedValue({ _id: 'cart1', items: [], total: 0 }),
    removeFromCart: jest.fn().mockResolvedValue({ _id: 'cart1', items: [], total: 0 }),
    clearCart: jest.fn().mockResolvedValue(undefined),
    addItem: jest.fn().mockResolvedValue({ _id: 'cart1', items: [], total: 0 }),
    updateItemQuantity: jest.fn().mockResolvedValue({ _id: 'cart1', items: [], total: 0 }),
    removeItem: jest.fn().mockResolvedValue({ _id: 'cart1', items: [], total: 0 }),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/order.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createOrder: jest.fn().mockResolvedValue({ _id: 'order1', status: 'pending', total: 100 }),
    getClientOrders: jest.fn().mockResolvedValue({ orders: [], total: 0 }),
    getOrderById: jest.fn().mockResolvedValue({ _id: 'order1', status: 'pending', total: 100 }),
    cancelOrder: jest.fn().mockResolvedValue({ _id: 'order1', status: 'cancelled' }),
    getStoreOrders: jest.fn().mockResolvedValue({ orders: [], total: 0 }),
    updateOrderStatus: jest.fn().mockResolvedValue({ _id: 'order1', status: 'shipped' }),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/review.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createReview: jest.fn().mockResolvedValue({ _id: 'review1', rating: 5, comment: 'Great product!' }),
    getProductReviews: jest.fn().mockResolvedValue({ reviews: [], total: 0, avgRating: 0 }),
    updateReview: jest.fn().mockResolvedValue({ _id: 'review1', rating: 4, comment: 'Updated review' }),
    deleteReview: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/wishlist.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getWishlist: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    addToWishlist: jest.fn().mockResolvedValue({ _id: 'wish1', productId: 'product1' }),
    removeFromWishlist: jest.fn().mockResolvedValue(undefined),
    isInWishlist: jest.fn().mockResolvedValue(false),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/analytics.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getStoreAnalytics: jest.fn().mockResolvedValue({ revenue: 0, orders: 0, topProducts: [] }),
    getDashboard: jest.fn().mockResolvedValue({ revenue: 0, orders: 0, newCustomers: 0 }),
  })),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import App from '@/app';
import StoreRoute from '@systems/MarketplaceSystem/routes/store.route';
import ProductRoute from '@systems/MarketplaceSystem/routes/product.route';
import CartRoute from '@systems/MarketplaceSystem/routes/cart.route';
import OrderRoute from '@systems/MarketplaceSystem/routes/order.route';
import ReviewRoute from '@systems/MarketplaceSystem/routes/review.route';
import WishlistRoute from '@systems/MarketplaceSystem/routes/wishlist.route';
import AnalyticsRoute from '@systems/MarketplaceSystem/routes/analytics.route';
import userModel from '@systems/UserManager/models/user.model';
import { makeClientUser, makeAdminUser, testIds } from '../../../tests/helpers/factories';
import { clientToken, adminToken, bearerHeader } from '../../../tests/helpers/jwt.helper';
import { expectRouteOk } from '../../../tests/helpers/assertions';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockClient = makeClientUser();
const mockAdmin = makeAdminUser();

let server: Express.Application;

beforeAll(() => {
  (userModel.findById as jest.Mock).mockImplementation((id: string) => {
    const user = id === testIds.admin ? mockAdmin : mockClient;
    return { select: jest.fn().mockResolvedValue(user) };
  });
  server = new App([
    new StoreRoute(),
    new ProductRoute(),
    new CartRoute(),
    new OrderRoute(),
    new ReviewRoute(),
    new WishlistRoute(),
    new AnalyticsRoute(),
  ]).getServer();
});

beforeEach(() => {
  jest.clearAllMocks();
  (userModel.findById as jest.Mock).mockImplementation((id: string) => {
    const user = id === testIds.admin ? mockAdmin : mockClient;
    return { select: jest.fn().mockResolvedValue(user) };
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MarketplaceSystem — Route Tests', () => {
  // ── Auth guard ───────────────────────────────────────────────────────────

  describe('Authentication enforcement', () => {
    it('POST /v1/marketplace/stores → 401 without token', async () => {
      const res = await request(server).post('/v1/marketplace/stores').send({ name: 'Test', slug: 'test' });
      expect(res.status).toBe(401);
    });

    it('GET /v1/marketplace/cart → 401 without token', async () => {
      const res = await request(server).get('/v1/marketplace/cart');
      expect(res.status).toBe(401);
    });
  });

  // ── Store routes (/v1/marketplace/stores) ────────────────────────────────

  describe('Stores (/v1/marketplace/stores)', () => {
    it('GET /v1/marketplace/stores/discover → 200 (public, no auth)', async () => {
      const res = await request(server).get('/v1/marketplace/stores/discover');
      expectRouteOk(res.status);
    });

    it('GET /v1/marketplace/stores/slug/:slug → 200 (public)', async () => {
      const res = await request(server).get('/v1/marketplace/stores/slug/test-store');
      expectRouteOk(res.status);
    });

    it('GET /v1/marketplace/stores/:id → 200 (public)', async () => {
      const res = await request(server).get(`/v1/marketplace/stores/${testIds.store}`);
      expectRouteOk(res.status);
    });

    it('POST /v1/marketplace/stores → 201 creating store (client)', async () => {
      const res = await request(server)
        .post('/v1/marketplace/stores')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ name: 'My Store', slug: 'my-store', description: 'Test store' });
      expectRouteOk(res.status);
    });

    it('GET /v1/marketplace/stores/:storeId/products → 200', async () => {
      const res = await request(server)
        .get(`/v1/marketplace/stores/${testIds.store}/products`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('DELETE /v1/marketplace/stores/:id → 200 (client/owner)', async () => {
      const res = await request(server)
        .delete(`/v1/marketplace/stores/${testIds.store}`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Product routes (/v1/marketplace/products) ────────────────────────────

  describe('Products (/v1/marketplace/products)', () => {
    it('POST /v1/marketplace/products → 201 creating product (client/owner)', async () => {
      const res = await request(server)
        .post('/v1/marketplace/products')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ storeId: testIds.store, name: 'Test Product', price: 50, categoryId: '507f1f77bcf86cd799439011' });
      expectRouteOk(res.status);
    });

    it('GET /v1/marketplace/products/search → 200 searching products', async () => {
      const res = await request(server)
        .get('/v1/marketplace/products/search?q=beauty')
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/marketplace/products/:id → 200 single product', async () => {
      const res = await request(server)
        .get(`/v1/marketplace/products/${testIds.product}`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('PUT /v1/marketplace/products/:id → 200 updating product', async () => {
      const res = await request(server)
        .put(`/v1/marketplace/products/${testIds.product}`)
        .set('Authorization', bearerHeader(clientToken()))
        .send({ price: 75 });
      expectRouteOk(res.status);
    });

    it('DELETE /v1/marketplace/products/:id → 200 deleting product', async () => {
      const res = await request(server)
        .delete(`/v1/marketplace/products/${testIds.product}`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Cart routes (/v1/marketplace/cart) ──────────────────────────────────

  describe('Cart (/v1/marketplace/cart)', () => {
    it('GET /v1/marketplace/cart → 200 getting cart', async () => {
      const res = await request(server).get('/v1/marketplace/cart').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('POST /v1/marketplace/cart/items → 200 adding to cart', async () => {
      const res = await request(server)
        .post('/v1/marketplace/cart/items')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ productId: testIds.product, quantity: 2 });
      expectRouteOk(res.status);
    });

    it('PUT /v1/marketplace/cart/items/:productId → 200 updating quantity', async () => {
      const res = await request(server)
        .put(`/v1/marketplace/cart/items/${testIds.product}`)
        .set('Authorization', bearerHeader(clientToken()))
        .send({ quantity: 3 });
      expectRouteOk(res.status);
    });

    it('DELETE /v1/marketplace/cart/items/:productId → 200 removing item', async () => {
      const res = await request(server)
        .delete(`/v1/marketplace/cart/items/${testIds.product}`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('DELETE /v1/marketplace/cart → 200 clearing cart', async () => {
      const res = await request(server).delete('/v1/marketplace/cart').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Order routes (/v1/marketplace/orders) ────────────────────────────────

  describe('Orders (/v1/marketplace/orders)', () => {
    it('POST /v1/marketplace/orders → 201 creating order', async () => {
      const res = await request(server)
        .post('/v1/marketplace/orders')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ storeId: testIds.store, items: [{ productId: testIds.product, quantity: 1 }] });
      expectRouteOk(res.status);
    });

    it('GET /v1/marketplace/orders → 200 client orders', async () => {
      const res = await request(server).get('/v1/marketplace/orders').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/marketplace/orders/:id → 200 single order', async () => {
      const res = await request(server)
        .get(`/v1/marketplace/orders/${testIds.order}`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('PUT /v1/marketplace/orders/:id/cancel → 200 cancelling order', async () => {
      const res = await request(server)
        .put(`/v1/marketplace/orders/${testIds.order}/cancel`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/marketplace/orders/store/:storeId → 200 store orders', async () => {
      const res = await request(server)
        .get(`/v1/marketplace/orders/store/${testIds.store}`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Review routes (/v1/marketplace/reviews) ──────────────────────────────

  describe('Reviews (/v1/marketplace/reviews)', () => {
    it('POST /v1/marketplace/reviews/:productId → 201 creating review', async () => {
      const res = await request(server)
        .post(`/v1/marketplace/reviews/${testIds.product}`)
        .set('Authorization', bearerHeader(clientToken()))
        .send({ rating: 5, comment: 'Great product!' });
      expectRouteOk(res.status);
    });

    it('GET /v1/marketplace/reviews/:productId → 200 product reviews', async () => {
      const res = await request(server)
        .get(`/v1/marketplace/reviews/${testIds.product}`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Wishlist routes (/v1/marketplace/wishlist) ────────────────────────────

  describe('Wishlist (/v1/marketplace/wishlist)', () => {
    it('GET /v1/marketplace/wishlist → 200 getting wishlist', async () => {
      const res = await request(server).get('/v1/marketplace/wishlist').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('POST /v1/marketplace/wishlist/:productId → 200 adding to wishlist', async () => {
      const res = await request(server)
        .post(`/v1/marketplace/wishlist/${testIds.product}`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('DELETE /v1/marketplace/wishlist/:productId → 200 removing from wishlist', async () => {
      const res = await request(server)
        .delete(`/v1/marketplace/wishlist/${testIds.product}`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Analytics routes (/v1/marketplace/analytics) ─────────────────────────

  describe('Analytics (/v1/marketplace/analytics)', () => {
    it('GET /v1/marketplace/analytics/store/:storeId → 200 store analytics', async () => {
      const res = await request(server)
        .get(`/v1/marketplace/analytics/store/${testIds.store}`)
        .set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/marketplace/analytics/store/:storeId → 401 without token', async () => {
      const res = await request(server).get(`/v1/marketplace/analytics/store/${testIds.store}`);
      expect(res.status).toBe(401);
    });
  });
});
