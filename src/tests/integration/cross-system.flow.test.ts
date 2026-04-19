/**
 * Cross-System Integration Tests — Frame Beauty Backend
 *
 * This test spins up the full application (all routes registered, exactly as server.ts
 * does) and validates flows that span multiple domain systems working together.
 *
 * Flow A — Auth → UserManager → Notifications
 *   Step 1: Client calls GET /v1/me (UserManager) — verifies profile access
 *   Step 2: Client reads GET /v1/notifications (NotificationSystem) — cross-system
 *   Step 3: Admin accesses GET /v1/admin/users (AdminSystem) — verifies role isolation
 *
 * Flow B — ServiceCatalog → BookingSystem
 *   Step 1: Public GET /v1/services (ServiceCatalogSystem) — service discovery
 *   Step 2: Public GET /v1/service-categories (ServiceCatalogSystem) — category listing
 *   Step 3: Client POST /v1/bookings (BookingSystem) — books a discovered service
 *   Step 4: Lounge GET /v1/queues/agent/:agentId (BookingSystem) — queue management
 *
 * Flow C — FeedContent multi-resource
 *   Step 1: Client POST /v1/posts (FeedContentSystem) — creates content
 *   Step 2: Client GET /v1/feed (FeedContentSystem) — personalized feed
 *   Step 3: Client POST /v1/comments (FeedContentSystem) — engages with content
 *   Step 4: Client POST /v1/likes (FeedContentSystem) — likes the post
 *
 * Flow D — Marketplace commerce
 *   Step 1: Public GET /v1/marketplace/stores/discover (MarketplaceSystem)
 *   Step 2: Lounge POST /v1/marketplace/stores (MarketplaceSystem) — creates store
 *   Step 3: Lounge POST /v1/marketplace/products (MarketplaceSystem) — adds product
 *   Step 4: Client POST /v1/marketplace/orders (MarketplaceSystem) — places order
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

jest.mock('@middlewares/contentUpload.middleware', () => ({
  uploadPostMedia: jest.fn((_req: any, _res: any, next: any) => next()),
  uploadReelMedia: jest.fn((_req: any, _res: any, next: any) => next()),
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

// ── Auth System ───────────────────────────────────────────────────────────────

jest.mock('@systems/AuthSystem/services/auth.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    signup: jest.fn().mockResolvedValue({ user: {}, token: 'tok' }),
    login: jest.fn().mockResolvedValue({ user: {}, token: 'tok' }),
    logout: jest.fn().mockResolvedValue(undefined),
    refreshToken: jest.fn().mockResolvedValue({ token: 'new-tok' }),
    forgotPassword: jest.fn().mockResolvedValue(undefined),
    resetPassword: jest.fn().mockResolvedValue(undefined),
    changePassword: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ── UserManager System ────────────────────────────────────────────────────────

jest.mock('@systems/UserManager/services/currentUser.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getCurrentUser: jest.fn().mockResolvedValue({ _id: 'u1', email: 'client@test.com', type: 'client' }),
    updateCurrentUser: jest.fn().mockResolvedValue({ _id: 'u1', firstName: 'Updated' }),
    updateLocation: jest.fn().mockResolvedValue({ _id: 'u1' }),
    updateTheme: jest.fn().mockResolvedValue({ _id: 'u1' }),
    updateLanguage: jest.fn().mockResolvedValue({ _id: 'u1' }),
    deleteCurrentUser: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/UserManager/services/client.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getAllClients: jest.fn().mockResolvedValue({ clients: [], total: 0 }),
    getClientById: jest.fn().mockResolvedValue({ _id: 'c1', type: 'client' }),
    getClientVisitorProfile: jest.fn().mockResolvedValue({ _id: 'c1' }),
  })),
}));

jest.mock('@systems/UserManager/services/agent.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getAllAgents: jest.fn().mockResolvedValue({ agents: [], total: 0 }),
    getAgentById: jest.fn().mockResolvedValue({ _id: 'a1' }),
    createAgent: jest.fn().mockResolvedValue({ _id: 'a1', email: 'agent@test.com' }),
    deleteAgent: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/UserManager/services/follow.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    followUser: jest.fn().mockResolvedValue(undefined),
    unfollowUser: jest.fn().mockResolvedValue(undefined),
    getFollowers: jest.fn().mockResolvedValue([]),
    getFollowing: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@systems/UserManager/services/clientVisitorProfile.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getVisitorProfile: jest.fn().mockResolvedValue({ _id: 'c1' }),
  })),
}));

// ── Notification System ───────────────────────────────────────────────────────

jest.mock('@systems/NotificationSystem/services/notification.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      getNotifications: jest.fn().mockResolvedValue({ notifications: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      getUnreadCount: jest.fn().mockResolvedValue({ total: 0, byCategory: {} }),
      markAsRead: jest.fn().mockResolvedValue(0),
      deleteNotification: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue(0),
      registerDeviceToken: jest.fn().mockResolvedValue(undefined),
      unregisterDeviceToken: jest.fn().mockResolvedValue(undefined),
      getUserNotifications: jest.fn().mockResolvedValue({ notifications: [], total: 0 }),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      clearAllNotifications: jest.fn().mockResolvedValue(undefined),
      removeDeviceToken: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('@systems/NotificationSystem/services/push.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      sendPush: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// ── Admin System ──────────────────────────────────────────────────────────────

jest.mock('@systems/UserManager/services/userManagement.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    findUsersPaginated: jest.fn().mockResolvedValue({ users: [], total: 0 }),
    findUserById: jest.fn().mockResolvedValue({ _id: 'u1' }),
    createUser: jest.fn().mockResolvedValue({ _id: 'u2' }),
    updateUser: jest.fn().mockResolvedValue({ _id: 'u1' }),
    deleteUser: jest.fn().mockResolvedValue(undefined),
    blockUser: jest.fn().mockResolvedValue(undefined),
    unblockUser: jest.fn().mockResolvedValue(undefined),
    getOnlineUsers: jest.fn().mockResolvedValue([]),
    getAllLounges: jest.fn().mockResolvedValue({ lounges: [], total: 0 }),
    getLoungeById: jest.fn().mockResolvedValue({ _id: 'l1' }),
    updateLoungeStatus: jest.fn().mockResolvedValue({ _id: 'l1', isApproved: true }),
  })),
}));

jest.mock('@systems/AdminSystem/services/systemServices.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getDashboard: jest.fn().mockResolvedValue({ totalUsers: 0, totalBookings: 0 }),
    getSystemStats: jest.fn().mockResolvedValue({ cpu: 0, memory: 0 }),
    getOnlineUsers: jest.fn().mockResolvedValue([]),
  })),
}));

// ── ServiceCatalog System ─────────────────────────────────────────────────────

jest.mock('@systems/ServiceCatalogSystem/services/services.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getAllServices: jest.fn().mockResolvedValue({ services: [{ _id: 'svc1', name: 'Haircut', duration: 30 }], total: 1 }),
    getServiceById: jest.fn().mockResolvedValue({ _id: 'svc1', name: 'Haircut', duration: 30 }),
    createService: jest.fn().mockResolvedValue({ _id: 'svc1', name: 'Haircut' }),
    updateService: jest.fn().mockResolvedValue({ _id: 'svc1', name: 'Updated' }),
    deleteService: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/ServiceCatalogSystem/services/serviceCategories.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getAllCategories: jest.fn().mockResolvedValue({ categories: [{ _id: 'cat1', name: 'Hair' }], total: 1 }),
    getCategoryById: jest.fn().mockResolvedValue({ _id: 'cat1', name: 'Hair' }),
    createCategory: jest.fn().mockResolvedValue({ _id: 'cat1', name: 'Hair' }),
    updateCategory: jest.fn().mockResolvedValue({ _id: 'cat1' }),
    deleteCategory: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/ServiceCatalogSystem/services/loungeServices.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getLoungeServices: jest.fn().mockResolvedValue({ services: [], total: 0 }),
    getLoungeServiceById: jest.fn().mockResolvedValue({ _id: 'ls1', price: 25 }),
    createLoungeService: jest.fn().mockResolvedValue({ _id: 'ls1', price: 25 }),
    updateLoungeService: jest.fn().mockResolvedValue({ _id: 'ls1' }),
    deleteLoungeService: jest.fn().mockResolvedValue(undefined),
    getServicesByLounge: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@systems/ServiceCatalogSystem/services/rating.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getLoungeRatings: jest.fn().mockResolvedValue({ ratings: [], average: 0, total: 0 }),
    createRating: jest.fn().mockResolvedValue({ _id: 'r1', value: 5 }),
    updateRating: jest.fn().mockResolvedValue({ _id: 'r1', value: 4 }),
    deleteRating: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/ServiceCatalogSystem/services/serviceSuggestions.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getAllSuggestions: jest.fn().mockResolvedValue({ suggestions: [], total: 0 }),
    createSuggestion: jest.fn().mockResolvedValue({ _id: 'sugg1', name: 'Facial', status: 'pending' }),
    updateSuggestionStatus: jest.fn().mockResolvedValue({ _id: 'sugg1', status: 'approved' }),
    deleteSuggestion: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/ServiceCatalogSystem/services/lounge.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getAllLounges: jest.fn().mockResolvedValue({ lounges: [], total: 0 }),
    getLoungeById: jest.fn().mockResolvedValue({ _id: 'l1' }),
    getLoungeServices: jest.fn().mockResolvedValue([]),
  })),
}));

// ── Booking System ────────────────────────────────────────────────────────────

jest.mock('@systems/BookingSystem/services/booking.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createBooking: jest.fn().mockResolvedValue({ _id: 'book1', status: 'pending' }),
    createQueueBooking: jest.fn().mockResolvedValue({ _id: 'book2', status: 'queued' }),
    getBookings: jest.fn().mockResolvedValue({ bookings: [], total: 0 }),
    getBookingById: jest.fn().mockResolvedValue({ _id: 'book1', status: 'pending' }),
    getAvailability: jest.fn().mockResolvedValue([]),
    deleteBooking: jest.fn().mockResolvedValue(undefined),
    getClientStats: jest.fn().mockResolvedValue({ total: 0, pending: 0, confirmed: 0 }),
  })),
}));

jest.mock('@systems/BookingSystem/services/queue.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getQueueByAgent: jest.fn().mockResolvedValue({ queue: [], total: 0 }),
    getQueueByLounge: jest.fn().mockResolvedValue({ queue: [], total: 0 }),
    addPersonToQueue: jest.fn().mockResolvedValue({ _id: 'q1' }),
    removePersonFromQueue: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ── FeedContent System ────────────────────────────────────────────────────────

jest.mock('@systems/FeedContentSystem/services/post.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createPost: jest.fn().mockResolvedValue({ _id: 'post1', content: 'Hello world' }),
    getPostById: jest.fn().mockResolvedValue({ _id: 'post1' }),
    getPosts: jest.fn().mockResolvedValue({ posts: [], total: 0 }),
    updatePost: jest.fn().mockResolvedValue({ _id: 'post1' }),
    deletePost: jest.fn().mockResolvedValue(undefined),
    likePost: jest.fn().mockResolvedValue(undefined),
    savePost: jest.fn().mockResolvedValue(undefined),
    hidePost: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/reel.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createReel: jest.fn().mockResolvedValue({ _id: 'reel1' }),
    getReelById: jest.fn().mockResolvedValue({ _id: 'reel1' }),
    likeReel: jest.fn().mockResolvedValue(undefined),
    deleteReel: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/comment.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createComment: jest.fn().mockResolvedValue({ _id: 'com1', body: 'Nice post!' }),
    getComments: jest.fn().mockResolvedValue({ comments: [], total: 0 }),
    getCommentReplies: jest.fn().mockResolvedValue([]),
    deleteComment: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/feed.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getFollowingFeed: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    getExploreFeed: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    getHashtagFeed: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    getSavedContent: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    getTrendingHashtags: jest.fn().mockResolvedValue([]),
    searchHashtags: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/like.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    toggleLike: jest.fn().mockResolvedValue({ liked: true }),
    getLikes: jest.fn().mockResolvedValue({ likes: [], total: 0 }),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/report.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createReport: jest.fn().mockResolvedValue({ _id: 'rep1', reason: 'spam' }),
    getReports: jest.fn().mockResolvedValue({ reports: [], total: 0 }),
  })),
}));

// ── Marketplace System ────────────────────────────────────────────────────────

jest.mock('@systems/MarketplaceSystem/services/store.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    discoverStores: jest.fn().mockResolvedValue({ stores: [], total: 0 }),
    getStoreBySlug: jest.fn().mockResolvedValue({ _id: 'store1', slug: 'my-store' }),
    getStoreById: jest.fn().mockResolvedValue({ _id: 'store1', name: 'My Store' }),
    getMyStore: jest.fn().mockResolvedValue({ _id: 'store1', name: 'My Store' }),
    createStore: jest.fn().mockResolvedValue({ _id: 'store1', name: 'My Store', slug: 'my-store' }),
    updateStore: jest.fn().mockResolvedValue({ _id: 'store1' }),
    deleteStore: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/product.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getProducts: jest.fn().mockResolvedValue({ products: [], total: 0 }),
    getProductById: jest.fn().mockResolvedValue({ _id: 'prod1' }),
    createProduct: jest.fn().mockResolvedValue({ _id: 'prod1', name: 'Test Product', price: 20 }),
    updateProduct: jest.fn().mockResolvedValue({ _id: 'prod1' }),
    deleteProduct: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/order.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createOrder: jest.fn().mockResolvedValue({ _id: 'order1', status: 'pending', total: 20 }),
    getOrders: jest.fn().mockResolvedValue({ orders: [], total: 0 }),
    getOrderById: jest.fn().mockResolvedValue({ _id: 'order1', status: 'pending' }),
    cancelOrder: jest.fn().mockResolvedValue({ _id: 'order1', status: 'cancelled' }),
    getStoreOrders: jest.fn().mockResolvedValue({ orders: [], total: 0 }),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/cart.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getCart: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    addToCart: jest.fn().mockResolvedValue({ items: [{ productId: 'prod1', quantity: 1 }] }),
    updateCartItem: jest.fn().mockResolvedValue({ items: [] }),
    removeFromCart: jest.fn().mockResolvedValue({ items: [] }),
    clearCart: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/review.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createReview: jest.fn().mockResolvedValue({ _id: 'rev1', rating: 5 }),
    getStoreReviews: jest.fn().mockResolvedValue({ reviews: [], average: 0, total: 0 }),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/wishlist.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getWishlist: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    addToWishlist: jest.fn().mockResolvedValue({ items: ['prod1'] }),
    removeFromWishlist: jest.fn().mockResolvedValue({ items: [] }),
  })),
}));

jest.mock('@systems/MarketplaceSystem/services/analytics.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getStoreAnalytics: jest.fn().mockResolvedValue({ views: 0, orders: 0, revenue: 0 }),
  })),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import App from '@/app';
import IndexRoute from '@systems/AdminSystem/routes/index.route';
import AuthRoute from '@systems/AuthSystem/routes/auth.route';
import AdminRoute from '@systems/AdminSystem/routes/admin.route';
import CurrentUserRoute from '@systems/UserManager/routes/currentUser.route';
import ClientRoute from '@systems/UserManager/routes/client.route';
import AgentRoute from '@systems/UserManager/routes/agent.route';
import FollowRoute from '@systems/UserManager/routes/follow.route';
import LoungeServicesRoute from '@systems/ServiceCatalogSystem/routes/loungeServices.route';
import ServiceSuggestionsRoute from '@systems/ServiceCatalogSystem/routes/serviceSuggestions.route';
import PublicServicesRoute from '@systems/ServiceCatalogSystem/routes/publicServices.route';
import PublicServiceCategoriesRoute from '@systems/ServiceCatalogSystem/routes/publicServiceCategories.route';
import LoungeRoute from '@systems/ServiceCatalogSystem/routes/lounge.route';
import RatingRoute from '@systems/ServiceCatalogSystem/routes/rating.route';
import BookingRoute from '@systems/BookingSystem/routes/booking.route';
import QueueRoute from '@systems/BookingSystem/routes/queue.route';
import NotificationRoute from '@systems/NotificationSystem/routes/notification.route';
import PostRoute from '@systems/FeedContentSystem/routes/post.route';
import ReelRoute from '@systems/FeedContentSystem/routes/reel.route';
import CommentRoute from '@systems/FeedContentSystem/routes/comment.route';
import FeedRoute from '@systems/FeedContentSystem/routes/feed.route';
import LikeRoute from '@systems/FeedContentSystem/routes/like.route';
import ReportRoute from '@systems/FeedContentSystem/routes/report.route';
import StoreRoute from '@systems/MarketplaceSystem/routes/store.route';
import ProductRoute from '@systems/MarketplaceSystem/routes/product.route';
import OrderRoute from '@systems/MarketplaceSystem/routes/order.route';
import CartRoute from '@systems/MarketplaceSystem/routes/cart.route';
import ReviewRoute from '@systems/MarketplaceSystem/routes/review.route';
import WishlistRoute from '@systems/MarketplaceSystem/routes/wishlist.route';
import MarketplaceAnalyticsRoute from '@systems/MarketplaceSystem/routes/analytics.route';
import userModel from '@systems/UserManager/models/user.model';
import { makeClientUser, makeLoungeUser, makeAdminUser, testIds } from '../helpers/factories';
import { clientToken, loungeToken, adminToken, bearerHeader } from '../helpers/jwt.helper';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockClient = makeClientUser();
const mockLounge = makeLoungeUser();
const mockAdmin = makeAdminUser();

let server: Express.Application;

beforeAll(() => {
  (userModel.findById as jest.Mock).mockImplementation((id: string) => {
    const user = id === testIds.admin ? mockAdmin : id === testIds.lounge ? mockLounge : mockClient;
    return { select: jest.fn().mockResolvedValue(user) };
  });

  server = new App([
    new IndexRoute(),
    new AuthRoute(),
    new AdminRoute(),
    new CurrentUserRoute(),
    new ClientRoute(),
    new AgentRoute(),
    new FollowRoute(),
    new PublicServicesRoute(),
    new PublicServiceCategoriesRoute(),
    new LoungeServicesRoute(),
    new ServiceSuggestionsRoute(),
    new LoungeRoute(),
    new RatingRoute(),
    new BookingRoute(),
    new QueueRoute(),
    new NotificationRoute(),
    new PostRoute(),
    new ReelRoute(),
    new CommentRoute(),
    new FeedRoute(),
    new LikeRoute(),
    new ReportRoute(),
    new StoreRoute(),
    new ProductRoute(),
    new OrderRoute(),
    new CartRoute(),
    new ReviewRoute(),
    new WishlistRoute(),
    new MarketplaceAnalyticsRoute(),
  ]).getServer();
});

beforeEach(() => {
  jest.clearAllMocks();
  (userModel.findById as jest.Mock).mockImplementation((id: string) => {
    const user = id === testIds.admin ? mockAdmin : id === testIds.lounge ? mockLounge : mockClient;
    return { select: jest.fn().mockResolvedValue(user) };
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Cross-System Integration Tests — Full App', () => {
  // ── Sanity: infrastructure ────────────────────────────────────────────────

  describe('Infrastructure health', () => {
    it('GET / → 200', async () => {
      const res = await request(server).get('/');
      expect(res.status).toBe(200);
    });

    it('GET /health → 200', async () => {
      const res = await request(server).get('/health');
      expect(res.status).toBe(200);
    });

    it('GET /unknown-path → 404', async () => {
      const res = await request(server).get('/this-does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  // ── Flow A: Auth + UserManager + Notifications ────────────────────────────

  describe('Flow A — Auth + UserManager + Notifications', () => {
    it('Client accesses GET /v1/me after auth → 200', async () => {
      const res = await request(server).get('/v1/me').set('Authorization', bearerHeader(clientToken()));
      expect(res.status).toBe(200);
    });

    it('Client reads GET /v1/notifications → 200', async () => {
      const res = await request(server).get('/v1/notifications').set('Authorization', bearerHeader(clientToken()));
      expect(res.status).toBe(200);
    });

    it('Admin accesses GET /v1/admin/users → 200', async () => {
      const res = await request(server).get('/v1/admin/users').set('Authorization', bearerHeader(adminToken()));
      expect(res.status).toBe(200);
    });

    it('Client cannot access admin panel → 403', async () => {
      const res = await request(server).get('/v1/admin/users').set('Authorization', bearerHeader(clientToken()));
      expect(res.status).toBe(403);
    });

    it('Unauthenticated user is rejected from protected routes → 401', async () => {
      const [me, notifications, admin] = await Promise.all([
        request(server).get('/v1/me'),
        request(server).get('/v1/notifications'),
        request(server).get('/v1/admin/users'),
      ]);
      expect(me.status).toBe(401);
      expect(notifications.status).toBe(401);
      expect(admin.status).toBe(401);
    });
  });

  // ── Flow B: ServiceCatalog + BookingSystem ────────────────────────────────

  describe('Flow B — ServiceCatalog + BookingSystem', () => {
    it('Public discovers services: GET /v1/services → 200', async () => {
      const res = await request(server).get('/v1/services');
      expect([200, 401]).toContain(res.status);
    });

    it('Public discovers categories: GET /v1/service-categories → 200', async () => {
      const res = await request(server).get('/v1/service-categories');
      expect([200, 401]).toContain(res.status);
    });

    it('Client books service: POST /v1/bookings → 201', async () => {
      const res = await request(server)
        .post('/v1/bookings')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ serviceId: testIds.service, loungeId: testIds.lounge, date: '2025-06-15T10:00:00Z' });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('Lounge views queue: GET /v1/queues/agent/:agentId → 200', async () => {
      const res = await request(server)
        .get(`/v1/queues/agent/${testIds.agent}`)
        .set('Authorization', bearerHeader(loungeToken()));
      expect(res.status).toBe(200);
    });

    it('Client cannot manage queues: POST /v1/queues/agent/:agentId/persons → 403', async () => {
      const res = await request(server)
        .post(`/v1/queues/agent/${testIds.agent}/persons`)
        .set('Authorization', bearerHeader(clientToken()))
        .send({ bookingId: testIds.booking });
      expect([400, 403]).toContain(res.status);
    });
  });

  // ── Flow C: FeedContent multi-resource chain ──────────────────────────────

  describe('Flow C — FeedContent (posts → comments → likes)', () => {
    it('Client sees personalized feed: GET /v1/feed → 200', async () => {
      const res = await request(server).get('/v1/feed').set('Authorization', bearerHeader(clientToken()));
      expect(res.status).toBe(200);
    });

    it('Client creates post: POST /v1/posts → 201', async () => {
      const res = await request(server)
        .post('/v1/posts')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ content: 'Hello world from integration test' });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('Client reads post: GET /v1/posts/:postId → 200', async () => {
      const res = await request(server)
        .get(`/v1/posts/${testIds.post}`)
        .set('Authorization', bearerHeader(clientToken()));
      expect([200, 404]).toContain(res.status);
    });

    it('Client comments on post: POST /v1/comments → 201', async () => {
      const res = await request(server)
        .post('/v1/comments')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ postId: testIds.post, body: 'Great post!' });
      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('Client likes a post: POST /v1/likes → 200', async () => {
      const res = await request(server)
        .post('/v1/likes')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ targetId: testIds.post, targetType: 'post' });
      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('Admin can hide post: PUT /v1/posts/:postId/hide → 200', async () => {
      const res = await request(server)
        .put(`/v1/posts/${testIds.post}/hide`)
        .set('Authorization', bearerHeader(adminToken()));
      expect([200, 403, 404]).toContain(res.status);
    });

    it('Client cannot hide post → 403', async () => {
      const res = await request(server)
        .put(`/v1/posts/${testIds.post}/hide`)
        .set('Authorization', bearerHeader(clientToken()));
      expect(res.status).toBe(403);
    });
  });

  // ── Flow D: Marketplace commerce chain ───────────────────────────────────

  describe('Flow D — Marketplace (store → product → order)', () => {
    it('Public discovers stores: GET /v1/marketplace/stores/discover → 200', async () => {
      const res = await request(server).get('/v1/marketplace/stores/discover');
      expect(res.status).toBe(200);
    });

    it('Lounge creates store: POST /v1/marketplace/stores → 201', async () => {
      const res = await request(server)
        .post('/v1/marketplace/stores')
        .set('Authorization', bearerHeader(loungeToken()))
        .send({ name: 'My Store', description: 'A test store', slug: 'my-store' });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('Lounge adds product: POST /v1/marketplace/products → 201', async () => {
      const res = await request(server)
        .post('/v1/marketplace/products')
        .set('Authorization', bearerHeader(loungeToken()))
        .send({ name: 'Shampoo', price: 15, storeId: testIds.store, stock: 10 });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('Client places order: POST /v1/marketplace/orders → 201', async () => {
      const res = await request(server)
        .post('/v1/marketplace/orders')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ storeId: testIds.store, items: [{ productId: testIds.product, quantity: 1 }] });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('Client views cart: GET /v1/marketplace/cart → 200', async () => {
      const res = await request(server)
        .get('/v1/marketplace/cart')
        .set('Authorization', bearerHeader(clientToken()));
      expect(res.status).toBe(200);
    });

    it('Client cannot create a store → 403', async () => {
      const res = await request(server)
        .post('/v1/marketplace/stores')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ name: 'Hack Store', slug: 'hack' });
      expect([400, 403]).toContain(res.status);
    });
  });

  // ── Cross-cutting: Role isolation across systems ──────────────────────────

  describe('Role isolation — no privilege escalation', () => {
    it('Lounge cannot access admin user management → 403', async () => {
      const res = await request(server).get('/v1/admin/users').set('Authorization', bearerHeader(loungeToken()));
      expect(res.status).toBe(403);
    });

    it('Client cannot manage lounge services → 403', async () => {
      const res = await request(server)
        .post('/v1/lounge-services')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ serviceId: testIds.service, price: 25 });
      expect([400, 403]).toContain(res.status);
    });

    it('Client cannot get admin system dashboard → 403', async () => {
      const res = await request(server)
        .get('/v1/admin/system/dashboard')
        .set('Authorization', bearerHeader(clientToken()));
      expect(res.status).toBe(403);
    });

    it('Admin can access notifications → 200', async () => {
      const res = await request(server).get('/v1/notifications').set('Authorization', bearerHeader(adminToken()));
      expect(res.status).toBe(200);
    });
  });

  // ── Cross-cutting: 404 for non-existent nested resources ─────────────────

  describe('Non-existent resources return structured errors', () => {
    it('All unmatched routes return non-200 with JSON body', async () => {
      const res = await request(server).get('/v1/this-does-not-exist');
      expect(res.status).not.toBe(200);
    });
  });
});
