/**
 * NotificationSystem — HTTP Route Tests
 *
 * Tests all 7 notification endpoints:
 *   GET    /v1/notifications
 *   GET    /v1/notifications/unread-count
 *   PATCH  /v1/notifications/read
 *   POST   /v1/notifications/device-token
 *   DELETE /v1/notifications/device-token
 *   DELETE /v1/notifications
 *   DELETE /v1/notifications/:id
 *
 * Strategy: Service layer is mocked; the full Express middleware chain
 * (authMiddleware → controller → mocked service) runs end-to-end.
 */

// ── Hoist mocks (before any imports) ─────────────────────────────────────────

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

// userModel mock — needed by authMiddleware and roleMiddleware
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

// NotificationService singleton mock
jest.mock('@systems/NotificationSystem/services/notification.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      getNotifications: jest.fn().mockResolvedValue({ notifications: [], total: 0, unreadCount: 0 }),
      getUnreadCount: jest.fn().mockResolvedValue({ total: 0, categories: {} }),
      markAsRead: jest.fn().mockResolvedValue(0),
      registerDeviceToken: jest.fn().mockResolvedValue(undefined),
      unregisterDeviceToken: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue(0),
      deleteNotification: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// PushNotificationService singleton mock
jest.mock('@systems/NotificationSystem/services/push.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      registerDeviceToken: jest.fn().mockResolvedValue(undefined),
      unregisterDeviceToken: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import request from 'supertest';
import App from '@/app';
import NotificationRoute from '@systems/NotificationSystem/routes/notification.route';
import userModel from '@systems/UserManager/models/user.model';
import NotificationService from '@systems/NotificationSystem/services/notification.service';
import { makeClientUser, makeNotification, testIds } from '../../../tests/helpers/factories';
import { clientToken, bearerHeader } from '../../../tests/helpers/jwt.helper';
import { expectRouteOk } from '../../../tests/helpers/assertions';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const mockClient = makeClientUser();
const mockNotif = makeNotification();
const notifService = (NotificationService as any).getInstance();

// ── App setup ─────────────────────────────────────────────────────────────────

let server: Express.Application;

beforeAll(() => {
  (userModel.findById as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(mockClient) });
  server = new App([new NotificationRoute()]).getServer();
});

beforeEach(() => {
  jest.clearAllMocks();
  (userModel.findById as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(mockClient) });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationSystem — Route Tests', () => {
  const token = clientToken();

  // ── Authentication guard ─────────────────────────────────────────────────

  describe('Authentication enforcement', () => {
    it('GET /v1/notifications → 401 without token', async () => {
      const res = await request(server).get('/v1/notifications');
      expect(res.status).toBe(401);
    });

    it('GET /v1/notifications → 401 with malformed token', async () => {
      const res = await request(server).get('/v1/notifications').set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /v1/notifications ────────────────────────────────────────────────

  describe('GET /v1/notifications', () => {
    it('returns 200 with empty notifications list', async () => {
      notifService.getNotifications.mockResolvedValueOnce({ notifications: [], total: 0, unreadCount: 0 });

      const res = await request(server).get('/v1/notifications').set('Authorization', bearerHeader(token));

      expectRouteOk(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('returns 200 with notifications list', async () => {
      notifService.getNotifications.mockResolvedValueOnce({ notifications: [mockNotif], total: 1, unreadCount: 1 });

      const res = await request(server).get('/v1/notifications').set('Authorization', bearerHeader(token));

      expectRouteOk(res.status);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.unreadCount).toBe(1);
    });

    it('supports ?page and ?limit query params', async () => {
      notifService.getNotifications.mockResolvedValueOnce({ notifications: [], total: 0, unreadCount: 0 });

      const res = await request(server).get('/v1/notifications?page=2&limit=5').set('Authorization', bearerHeader(token));

      expectRouteOk(res.status);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(5);
    });
  });

  // ── GET /v1/notifications/unread-count ───────────────────────────────────

  describe('GET /v1/notifications/unread-count', () => {
    it('returns 200 with unread count breakdown', async () => {
      notifService.getUnreadCount.mockResolvedValueOnce({ total: 3, categories: { booking: 2, system: 1 } });

      const res = await request(server).get('/v1/notifications/unread-count').set('Authorization', bearerHeader(token));

      expectRouteOk(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(3);
    });

    it('returns 401 without token', async () => {
      const res = await request(server).get('/v1/notifications/unread-count');
      expect(res.status).toBe(401);
    });
  });

  // ── PATCH /v1/notifications/read ─────────────────────────────────────────

  describe('PATCH /v1/notifications/read', () => {
    it('returns 200 marking specific notifications as read', async () => {
      notifService.markAsRead.mockResolvedValueOnce(2);

      const res = await request(server)
        .patch('/v1/notifications/read')
        .set('Authorization', bearerHeader(token))
        .send({ notificationIds: [testIds.notification] });

      expectRouteOk(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.modifiedCount).toBe(2);
    });

    it('returns 200 marking all as read (no body)', async () => {
      notifService.markAsRead.mockResolvedValueOnce(5);

      const res = await request(server).patch('/v1/notifications/read').set('Authorization', bearerHeader(token)).send({});

      expectRouteOk(res.status);
    });
  });

  // ── POST /v1/notifications/device-token ──────────────────────────────────

  describe('POST /v1/notifications/device-token', () => {
    it('returns 200 registering a device token', async () => {
      notifService.registerDeviceToken.mockResolvedValueOnce(undefined);

      const res = await request(server)
        .post('/v1/notifications/device-token')
        .set('Authorization', bearerHeader(token))
        .send({ token: 'fcm-device-token-abc123', platform: 'android' });

      expectRouteOk(res.status);
    });

    it('returns 401 without token', async () => {
      const res = await request(server).post('/v1/notifications/device-token').send({ token: 'fcm-token' });
      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /v1/notifications/device-token ────────────────────────────────

  describe('DELETE /v1/notifications/device-token', () => {
    it('returns 200 removing a device token', async () => {
      notifService.unregisterDeviceToken.mockResolvedValueOnce(undefined);

      const res = await request(server)
        .delete('/v1/notifications/device-token')
        .set('Authorization', bearerHeader(token))
        .send({ token: 'fcm-device-token-abc123' });

      expectRouteOk(res.status);
    });
  });

  // ── DELETE /v1/notifications ─────────────────────────────────────────────

  describe('DELETE /v1/notifications', () => {
    it('returns 200 deleting all notifications', async () => {
      notifService.deleteAllNotifications.mockResolvedValueOnce(10);

      const res = await request(server).delete('/v1/notifications').set('Authorization', bearerHeader(token));

      expectRouteOk(res.status);
      expect(res.body.data.deletedCount).toBe(10);
    });

    it('returns 401 without token', async () => {
      const res = await request(server).delete('/v1/notifications');
      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /v1/notifications/:id ─────────────────────────────────────────

  describe('DELETE /v1/notifications/:id', () => {
    it('returns 200 deleting a single notification', async () => {
      notifService.deleteNotification.mockResolvedValueOnce(undefined);

      const res = await request(server).delete(`/v1/notifications/${testIds.notification}`).set('Authorization', bearerHeader(token));

      expectRouteOk(res.status);
      expect(res.body.message).toMatch(/deleted/i);
    });
  });
});
