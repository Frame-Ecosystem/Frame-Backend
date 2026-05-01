/**
 * BookingSystem — HTTP Route Tests
 *
 * Covers:
 *   POST /v1/bookings
 *   POST /v1/bookings/queue
 *   GET  /v1/bookings
 *   GET  /v1/bookings/:id
 *   PUT  /v1/bookings/:id
 *   DELETE /v1/bookings/:id
 *   GET  /v1/bookings/stats/client/:clientId
 *   GET  /v1/bookings/availability
 *   GET  /v1/queues/agent/:agentId
 *   GET  /v1/queues/lounge/:loungeId
 *   POST /v1/queues/agent/:agentId/persons   (admin/lounge)
 *   PUT  /v1/queues/agent/:agentId/persons/:bookingId (admin/lounge)
 *   DELETE /v1/queues/agent/:agentId/persons/:bookingId (admin/lounge)
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

jest.mock('@systems/BookingSystem/services/booking.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createBooking: jest.fn().mockResolvedValue({ _id: 'booking1', status: 'pending' }),
    createQueueBooking: jest.fn().mockResolvedValue({ _id: 'booking1', status: 'in_queue' }),
    createLoungeQueueBooking: jest.fn().mockResolvedValue({ _id: 'booking1', status: 'in_queue' }),
    getAllBookings: jest.fn().mockResolvedValue({ bookings: [], total: 0 }),
    getAgentAvailability: jest.fn().mockResolvedValue({ slots: [] }),
    getBookingHistory: jest.fn().mockResolvedValue({ bookings: [], total: 0 }),
    getBookingById: jest.fn().mockResolvedValue({ _id: 'booking1', status: 'pending' }),
    updateBooking: jest.fn().mockResolvedValue({ _id: 'booking1', status: 'confirmed' }),
    deleteBooking: jest.fn().mockResolvedValue(undefined),
    getClientBookingStats: jest.fn().mockResolvedValue({ total: 0, completed: 0, cancelled: 0 }),
    getLoungeBookingStats: jest.fn().mockResolvedValue({ total: 0, completed: 0, cancelled: 0 }),
  })),
}));

jest.mock('@systems/BookingSystem/services/queue.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getQueueByAgent: jest.fn().mockResolvedValue({ _id: 'q1', agentId: 'agent1', persons: [] }),
    getQueuesByLounge: jest.fn().mockResolvedValue([]),
    addPersonToQueue: jest.fn().mockResolvedValue({ _id: 'q1', persons: [{ bookingId: 'b1' }] }),
    updatePersonStatus: jest.fn().mockResolvedValue({ _id: 'q1' }),
    reorderPerson: jest.fn().mockResolvedValue({ _id: 'q1' }),
    removePersonFromQueue: jest.fn().mockResolvedValue({ _id: 'q1', persons: [] }),
    populateDailyQueues: jest.fn().mockResolvedValue({ created: 5, skipped: 2 }),
  })),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import App from '@/app';
import BookingRoute from '@systems/BookingSystem/routes/booking.route';
import QueueRoute from '@systems/BookingSystem/routes/queue.route';
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
    const user = id === testIds.lounge ? mockLounge : id === testIds.admin ? mockAdmin : mockClient;
    return { select: jest.fn().mockResolvedValue(user) };
  });
  server = new App([new BookingRoute(), new QueueRoute()]).getServer();
});

beforeEach(() => {
  jest.clearAllMocks();
  (userModel.findById as jest.Mock).mockImplementation((id: string) => {
    const user = id === testIds.lounge ? mockLounge : id === testIds.admin ? mockAdmin : mockClient;
    return { select: jest.fn().mockResolvedValue(user) };
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BookingSystem — Route Tests', () => {
  // ── Auth guard ───────────────────────────────────────────────────────────

  describe('Authentication enforcement', () => {
    it('GET /v1/bookings → 401 without token', async () => {
      const res = await request(server).get('/v1/bookings');
      expect(res.status).toBe(401);
    });

    it('GET /v1/queues/agent/:agentId → 401 without token', async () => {
      const res = await request(server).get(`/v1/queues/agent/${testIds.agent}`);
      expect(res.status).toBe(401);
    });
  });

  // ── Booking routes (/v1/bookings) ────────────────────────────────────────

  describe('Bookings (/v1/bookings)', () => {
    describe('POST /v1/bookings', () => {
      it('returns 201 creating a booking', async () => {
        const res = await request(server)
          .post('/v1/bookings')
          .set('Authorization', bearerHeader(clientToken()))
          .send({
            loungeId: testIds.lounge,
            agentId: testIds.agent,
            serviceIds: [testIds.service],
            bookingDate: new Date().toISOString(),
          });
        expectRouteOk(res.status);
      });
    });

    describe('POST /v1/bookings/queue', () => {
      it('returns 201 creating a queue booking', async () => {
        const res = await request(server)
          .post('/v1/bookings/queue')
          .set('Authorization', bearerHeader(clientToken()))
          .send({ agentId: testIds.agent, serviceIds: [testIds.service] });
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/bookings', () => {
      it('returns 200 with bookings list', async () => {
        const res = await request(server).get('/v1/bookings').set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/bookings/availability', () => {
      it('returns 200 with agent availability', async () => {
        const res = await request(server)
          .get('/v1/bookings/availability')
          .set('Authorization', bearerHeader(clientToken()))
          .query({ agentId: testIds.agent, date: new Date().toISOString().split('T')[0] });
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/bookings/:id', () => {
      it('returns 200 for a valid booking', async () => {
        const res = await request(server).get(`/v1/bookings/${testIds.booking}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/bookings/stats/client/:clientId', () => {
      it('returns 200 with client booking stats', async () => {
        const res = await request(server).get(`/v1/bookings/stats/client/${testIds.client}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('DELETE /v1/bookings/:id', () => {
      it('returns 200 deleting a booking', async () => {
        const res = await request(server).delete(`/v1/bookings/${testIds.booking}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });
  });

  // ── Queue routes (/v1/queues) ────────────────────────────────────────────

  describe('Queues (/v1/queues)', () => {
    describe('GET /v1/queues/agent/:agentId', () => {
      it('returns 200 with agent queue (client token)', async () => {
        const res = await request(server).get(`/v1/queues/agent/${testIds.agent}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });

      it('returns 200 with agent queue (lounge token)', async () => {
        const res = await request(server).get(`/v1/queues/agent/${testIds.agent}`).set('Authorization', bearerHeader(loungeToken()));
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/queues/lounge/:loungeId', () => {
      it('returns 200 with lounge queues', async () => {
        const res = await request(server).get(`/v1/queues/lounge/${testIds.lounge}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('POST /v1/queues/agent/:agentId/persons', () => {
      it('returns 200 adding person to queue (lounge token)', async () => {
        const res = await request(server)
          .post(`/v1/queues/agent/${testIds.agent}/persons`)
          .set('Authorization', bearerHeader(loungeToken()))
          .send({ bookingId: testIds.booking });
        expectRouteOk(res.status);
      });

      it('returns 403 adding person with client token', async () => {
        const res = await request(server)
          .post(`/v1/queues/agent/${testIds.agent}/persons`)
          .set('Authorization', bearerHeader(clientToken()))
          .send({ bookingId: testIds.booking });
        expectRouteOk(res.status);
      });
    });

    describe('DELETE /v1/queues/agent/:agentId/persons/:bookingId', () => {
      it('returns 200 removing person from queue (admin token)', async () => {
        const res = await request(server)
          .delete(`/v1/queues/agent/${testIds.agent}/persons/${testIds.booking}`)
          .set('Authorization', bearerHeader(adminToken()));
        expectRouteOk(res.status);
      });
    });
  });
});
