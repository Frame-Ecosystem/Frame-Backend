/**
 * Test data factories for the Frame Beauty backend test suite.
 * Provides consistent, reusable mock objects for all domain entities.
 */
import { Types } from 'mongoose';

// ── Fixed IDs used throughout tests ─────────────────────────────────────────
export const testIds = {
  client: new Types.ObjectId().toHexString(),
  lounge: new Types.ObjectId().toHexString(),
  admin: new Types.ObjectId().toHexString(),
  agent: new Types.ObjectId().toHexString(),
  client2: new Types.ObjectId().toHexString(),
  notification: new Types.ObjectId().toHexString(),
  post: new Types.ObjectId().toHexString(),
  reel: new Types.ObjectId().toHexString(),
  comment: new Types.ObjectId().toHexString(),
  booking: new Types.ObjectId().toHexString(),
  queue: new Types.ObjectId().toHexString(),
  store: new Types.ObjectId().toHexString(),
  product: new Types.ObjectId().toHexString(),
  order: new Types.ObjectId().toHexString(),
  service: new Types.ObjectId().toHexString(),
  serviceCategory: new Types.ObjectId().toHexString(),
  loungeService: new Types.ObjectId().toHexString(),
  serviceSuggestion: new Types.ObjectId().toHexString(),
};

// ── User factories ────────────────────────────────────────────────────────────

export const makeClientUser = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.client,
  email: 'client@test.com',
  type: 'client',
  firstName: 'Test',
  lastName: 'Client',
  phoneNumber: '+21650000001',
  isBlocked: false,
  isEmailVerified: true,
  passwordChangedAt: undefined,
  sessionTrack: { isOnline: true, devices: [] },
  refreshTokens: [],
  theme: 'light',
  language: 'en',
  ...overrides,
});

export const makeLoungeUser = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.lounge,
  email: 'lounge@test.com',
  type: 'lounge',
  firstName: 'Test',
  lastName: 'Lounge',
  loungeTitle: 'Test Lounge',
  isBlocked: false,
  isEmailVerified: true,
  passwordChangedAt: undefined,
  sessionTrack: { isOnline: true, devices: [] },
  refreshTokens: [],
  ...overrides,
});

export const makeAdminUser = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.admin,
  email: 'admin@test.com',
  type: 'admin',
  firstName: 'Test',
  lastName: 'Admin',
  isBlocked: false,
  isEmailVerified: true,
  passwordChangedAt: undefined,
  sessionTrack: { isOnline: true, devices: [] },
  refreshTokens: [],
  ...overrides,
});

// ── Notification factory ──────────────────────────────────────────────────────

export const makeNotification = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.notification,
  userId: testIds.client,
  title: 'Test Notification',
  body: 'This is a test notification',
  category: 'booking',
  isRead: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ── Post / Reel / Comment factories ──────────────────────────────────────────

export const makePost = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.post,
  authorId: testIds.client,
  authorType: 'client',
  text: 'Test post content',
  hashtags: ['test', 'beauty'],
  images: [],
  likeCount: 0,
  commentCount: 0,
  isHidden: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const makeReel = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.reel,
  authorId: testIds.client,
  authorType: 'client',
  caption: 'Test reel caption',
  videoUrl: 'http://example.com/video.mp4',
  likeCount: 0,
  isHidden: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const makeComment = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.comment,
  authorId: testIds.client,
  targetType: 'post',
  targetId: testIds.post,
  text: 'Test comment',
  isHidden: false,
  likeCount: 0,
  replyCount: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ── Booking / Queue factories ─────────────────────────────────────────────────

export const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.booking,
  clientId: testIds.client,
  loungeId: testIds.lounge,
  agentIds: [testIds.agent],
  status: 'pending',
  bookingDate: new Date().toISOString(),
  totalDuration: 60,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const makeQueue = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.queue,
  agentId: testIds.agent,
  date: new Date().toISOString(),
  persons: [],
  ...overrides,
});

// ── Marketplace factories ─────────────────────────────────────────────────────

export const makeStore = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.store,
  ownerId: testIds.client,
  name: 'Test Store',
  slug: 'test-store',
  description: 'A test store',
  status: 'active',
  isVerified: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.product,
  storeId: testIds.store,
  name: 'Test Product',
  description: 'A test product',
  price: 49.99,
  stock: 100,
  status: 'active',
  images: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.order,
  buyerId: testIds.client,
  storeId: testIds.store,
  items: [{ productId: testIds.product, quantity: 1, price: 49.99 }],
  totalAmount: 49.99,
  status: 'pending',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const makeCart = (overrides: Record<string, unknown> = {}) => ({
  userId: testIds.client,
  items: [],
  ...overrides,
});

// ── ServiceCatalog factories ──────────────────────────────────────────────────

export const makeService = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.service,
  name: 'Test Service',
  description: 'A test service',
  categoryId: testIds.serviceCategory,
  duration: 30,
  price: 25.0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const makeServiceCategory = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.serviceCategory,
  name: 'Test Category',
  description: 'A test category',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const makeLoungeService = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.loungeService,
  loungeId: testIds.lounge,
  serviceId: testIds.service,
  price: 30.0,
  duration: 45,
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ── Agent factory ─────────────────────────────────────────────────────────────

export const makeAgent = (overrides: Record<string, unknown> = {}) => ({
  _id: testIds.agent,
  agentName: 'test-agent',
  loungeId: testIds.lounge,
  idLoungeService: [testIds.loungeService],
  isBlocked: false,
  acceptQueueBooking: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ── Paginated result factory ──────────────────────────────────────────────────

export const paginated = <T>(data: T[], total?: number) => ({
  data,
  total: total ?? data.length,
  page: 1,
  limit: 20,
  totalPages: 1,
});
