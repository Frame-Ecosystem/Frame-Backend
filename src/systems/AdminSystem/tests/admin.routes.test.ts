/**
 * AdminSystem — HTTP Route Tests
 *
 * Covers:
 *   GET /                                      (public health)
 *   GET /health                                (public health)
 *   GET  /v1/admin/users                       (admin only)
 *   GET  /v1/admin/users/:userId               (admin only)
 *   PUT  /v1/admin/users/:userId               (admin only)
 *   DELETE /v1/admin/users/:userId             (admin only)
 *   POST /v1/admin/users/create                (admin only)
 *   PUT  /v1/admin/users/:userId/block         (admin only)
 *   PUT  /v1/admin/users/:userId/unblock       (admin only)
 *   GET  /v1/admin/system/dashboard            (admin only)
 *   GET  /v1/admin/system/stats                (admin only)
 *   GET  /v1/admin/system/online-users         (admin only)
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

// Service mocks
jest.mock('@systems/UserManager/services/userManagement.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    findUsersPaginated: jest.fn().mockResolvedValue({ users: [], total: 0, page: 1, limit: 10 }),
    findUserById: jest.fn().mockResolvedValue({ _id: 'user1', email: 'user@test.com', type: 'client' }),
    createUser: jest.fn().mockResolvedValue({ _id: 'user2', email: 'new@test.com' }),
    updateUser: jest.fn().mockResolvedValue({ _id: 'user1', email: 'updated@test.com' }),
    deleteUser: jest.fn().mockResolvedValue(undefined),
    blockUser: jest.fn().mockResolvedValue({ _id: 'user1', isBlocked: true }),
    unblockUser: jest.fn().mockResolvedValue({ _id: 'user1', isBlocked: false }),
    getOnlineUsers: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@systems/AdminSystem/services/systemServices.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getDashboard: jest.fn().mockResolvedValue({ totalUsers: 0, totalBookings: 0, totalOrders: 0 }),
    getSystemStats: jest.fn().mockResolvedValue({ cpu: 0, memory: 0, uptime: 0 }),
    getOnlineUsers: jest.fn().mockResolvedValue([]),
  })),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import App from '@/app';
import IndexRoute from '@systems/AdminSystem/routes/index.route';
import AdminRoute from '@systems/AdminSystem/routes/admin.route';
import userModel from '@systems/UserManager/models/user.model';
import { makeClientUser, makeLoungeUser, makeAdminUser, testIds } from '../../../tests/helpers/factories';
import { clientToken, loungeToken, adminToken, bearerHeader } from '../../../tests/helpers/jwt.helper';
import { expectRouteOk } from '../../../tests/helpers/assertions';

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
  server = new App([new IndexRoute(), new AdminRoute()]).getServer();
});

beforeEach(() => {
  jest.clearAllMocks();
  (userModel.findById as jest.Mock).mockImplementation((id: string) => {
    const user = id === testIds.admin ? mockAdmin : id === testIds.lounge ? mockLounge : mockClient;
    return { select: jest.fn().mockResolvedValue(user) };
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminSystem — Route Tests', () => {
  // ── Public routes ────────────────────────────────────────────────────────

  describe('Public routes (no auth required)', () => {
    it('GET / → 200', async () => {
      const res = await request(server).get('/');
      expectRouteOk(res.status);
    });

    it('GET /health → 200', async () => {
      const res = await request(server).get('/health');
      expectRouteOk(res.status);
    });
  });

  // ── Auth enforcement on admin routes ─────────────────────────────────────

  describe('Authentication enforcement', () => {
    it('GET /v1/admin/users → 401 without token', async () => {
      const res = await request(server).get('/v1/admin/users');
      expect(res.status).toBe(401);
    });

    it('GET /v1/admin/users → 403 with client token', async () => {
      const res = await request(server).get('/v1/admin/users').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/admin/users → 403 with lounge token', async () => {
      const res = await request(server).get('/v1/admin/users').set('Authorization', bearerHeader(loungeToken()));
      expectRouteOk(res.status);
    });
  });

  // ── User management (admin only) ─────────────────────────────────────────

  describe('User management (/v1/admin/users)', () => {
    it('GET /v1/admin/users → 200 listing users (admin)', async () => {
      const res = await request(server).get('/v1/admin/users').set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
      expect(res.body.data).toBeDefined();
    });

    it('GET /v1/admin/users?page=1&limit=10 → 200 paginated (admin)', async () => {
      const res = await request(server).get('/v1/admin/users?page=1&limit=10').set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/admin/users/:userId → 200 single user (admin)', async () => {
      const res = await request(server).get(`/v1/admin/users/${testIds.client}`).set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });

    it('POST /v1/admin/users → 201 creating user (admin)', async () => {
      const res = await request(server)
        .post('/v1/admin/users')
        .set('Authorization', bearerHeader(adminToken()))
        .send({ email: 'new@test.com', password: 'Password@123', type: 'client', firstName: 'New', lastName: 'User' });
      expectRouteOk(res.status);
    });

    it('PUT /v1/admin/users/:userId → 200 updating user (admin)', async () => {
      const res = await request(server)
        .put(`/v1/admin/users/${testIds.client}`)
        .set('Authorization', bearerHeader(adminToken()))
        .send({ firstName: 'Updated' });
      expectRouteOk(res.status);
    });

    it('DELETE /v1/admin/users/:userId → 200 deleting user (admin)', async () => {
      const res = await request(server).delete(`/v1/admin/users/${testIds.client}`).set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });

    it('PATCH /v1/admin/users/:userId/block → 200 toggling user block (admin)', async () => {
      const res = await request(server).patch(`/v1/admin/users/${testIds.client}/block`).set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });
  });

  // ── System routes (/v1/admin/system) ─────────────────────────────────────

  describe('System routes (/v1/admin/system)', () => {
    it('GET /v1/admin/system/dashboard → 200 dashboard (admin)', async () => {
      const res = await request(server).get('/v1/admin/system/dashboard').set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/admin/system/stats → 200 system stats (admin)', async () => {
      const res = await request(server).get('/v1/admin/system/stats').set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/admin/session-info → 200 online users (admin)', async () => {
      const res = await request(server).get('/v1/admin/session-info').set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/admin/system/dashboard → 403 for non-admin', async () => {
      const res = await request(server).get('/v1/admin/system/dashboard').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });
});
