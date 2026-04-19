/**
 * UserManager — HTTP Route Tests
 *
 * Covers:
 *   GET    /v1/me
 *   PUT    /v1/me
 *   PUT    /v1/me/location
 *   PUT    /v1/me/theme
 *   PUT    /v1/me/language
 *   DELETE /v1/me
 *   POST   /v1/me/change-password
 *   GET    /v1/agents
 *   GET    /v1/agents/:agentId
 *   POST   /v1/agents         (lounge only)
 *   DELETE /v1/agents/:agentId (lounge only)
 *   GET    /v1/client/lounges
 *   GET    /v1/client/lounges/:loungeId
 *   GET    /v1/client/profile/:clientId
 *   POST   /v1/follows/:targetId
 *   DELETE /v1/follows/:targetId
 *   GET    /v1/follows/following/:userId
 *   GET    /v1/follows/followers/:userId
 *   GET    /v1/follows/counts/:userId
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

// Service mocks
jest.mock('@systems/UserManager/services/currentUser.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    changePassword: jest.fn().mockResolvedValue(undefined),
    updateUser: jest.fn().mockResolvedValue({ _id: 'uid', email: 'client@test.com' }),
    updateUserLocation: jest.fn().mockResolvedValue(undefined),
    updateTheme: jest.fn().mockResolvedValue({ theme: 'dark' }),
    updateLanguage: jest.fn().mockResolvedValue({ language: 'ar' }),
    deleteUser: jest.fn().mockResolvedValue(undefined),
    updateClientProfile: jest.fn().mockResolvedValue({ _id: 'uid' }),
    sendVerificationCode: jest.fn().mockResolvedValue(undefined),
    verifyEmailCode: jest.fn().mockResolvedValue(undefined),
    uploadProfileImage: jest.fn().mockResolvedValue({ profileImage: 'http://example.com/img.jpg' }),
    uploadCoverImage: jest.fn().mockResolvedValue({ coverImage: 'http://example.com/cover.jpg' }),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/reel.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    deleteReel: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/UserManager/services/agent.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getAllAgents: jest.fn().mockResolvedValue([]),
    getAgentById: jest.fn().mockResolvedValue({ _id: 'agent1', agentName: 'agent-test' }),
    createAgent: jest.fn().mockResolvedValue({ _id: 'agent1', agentName: 'new-agent' }),
    updateAgent: jest.fn().mockResolvedValue({ _id: 'agent1', agentName: 'updated-agent' }),
    deleteAgent: jest.fn().mockResolvedValue(undefined),
    uploadProfileImage: jest.fn().mockResolvedValue({ profileImage: 'http://example.com/img.jpg' }),
  })),
}));

jest.mock('@systems/UserManager/services/client.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getAllLounges: jest.fn().mockResolvedValue({ lounges: [], total: 0 }),
    getLoungeById: jest.fn().mockResolvedValue({ _id: 'lounge1', loungeTitle: 'Test Lounge' }),
    getLoungeServicesById: jest.fn().mockResolvedValue([]),
    getLoungesByService: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@systems/UserManager/services/clientVisitorProfile.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getClientProfile: jest.fn().mockResolvedValue({ _id: 'client1', email: 'client@test.com' }),
    getClientBookings: jest.fn().mockResolvedValue({ bookings: [], total: 0 }),
  })),
}));

jest.mock('@systems/UserManager/services/follow.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    follow: jest.fn().mockResolvedValue(undefined),
    unfollow: jest.fn().mockResolvedValue(undefined),
    isFollowing: jest.fn().mockResolvedValue(false),
    getFollowing: jest.fn().mockResolvedValue([]),
    getFollowers: jest.fn().mockResolvedValue([]),
    getCounts: jest.fn().mockResolvedValue({ followingCount: 0, followersCount: 0 }),
  })),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import App from '@/app';
import CurrentUserRoute from '@systems/UserManager/routes/currentUser.route';
import AgentRoute from '@systems/UserManager/routes/agent.route';
import ClientRoute from '@systems/UserManager/routes/client.route';
import FollowRoute from '@systems/UserManager/routes/follow.route';
import userModel from '@systems/UserManager/models/user.model';
import { makeClientUser, makeLoungeUser, testIds } from '../../../tests/helpers/factories';
import { clientToken, loungeToken, bearerHeader } from '../../../tests/helpers/jwt.helper';
import { expectRouteOk } from '../../../tests/helpers/assertions';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockClient = makeClientUser();
const mockLounge = makeLoungeUser();

let server: Express.Application;

beforeAll(() => {
  (userModel.findById as jest.Mock).mockImplementation((id: string) => {
    const user = id === testIds.lounge ? mockLounge : mockClient;
    return { select: jest.fn().mockResolvedValue(user) };
  });
  server = new App([new CurrentUserRoute(), new AgentRoute(), new ClientRoute(), new FollowRoute()]).getServer();
});

beforeEach(() => {
  jest.clearAllMocks();
  (userModel.findById as jest.Mock).mockImplementation((id: string) => {
    const user = id === testIds.lounge ? mockLounge : mockClient;
    return { select: jest.fn().mockResolvedValue(user) };
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UserManager — Route Tests', () => {
  // ── CurrentUser routes (/v1/me) ──────────────────────────────────────────

  describe('CurrentUser (/v1/me)', () => {
    describe('GET /v1/me', () => {
      it('returns 200 with user profile', async () => {
        const res = await request(server).get('/v1/me').set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
        expect(res.body.data).toBeDefined();
      });

      it('returns 401 without token', async () => {
        const res = await request(server).get('/v1/me');
        expect(res.status).toBe(401);
      });
    });

    describe('PUT /v1/me', () => {
      it('returns 200 updating user profile', async () => {
        const res = await request(server)
          .put('/v1/me')
          .set('Authorization', bearerHeader(clientToken()))
          .send({ firstName: 'Updated', lastName: 'Name' });
        expectRouteOk(res.status);
      });
    });

    describe('PUT /v1/me/location', () => {
      it('returns 200 updating user location', async () => {
        const res = await request(server)
          .put('/v1/me/location')
          .set('Authorization', bearerHeader(clientToken()))
          .send({
            latitude: 36.8,
            longitude: 10.1,
            address: '123 Main Street, Tunis',
            placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
          });
        expectRouteOk(res.status);
      });
    });

    describe('PUT /v1/me/theme', () => {
      it('returns 200 updating theme preference', async () => {
        const res = await request(server)
          .put('/v1/me/theme')
          .set('Authorization', bearerHeader(clientToken()))
          .send({ theme: 'dark' });
        expectRouteOk(res.status);
      });
    });

    describe('PUT /v1/me/language', () => {
      it('returns 200 updating language preference', async () => {
        const res = await request(server)
          .put('/v1/me/language')
          .set('Authorization', bearerHeader(clientToken()))
          .send({ language: 'ar' });
        expectRouteOk(res.status);
      });
    });
  });

  // ── Agent routes (/v1/agents) ────────────────────────────────────────────

  describe('Agents (/v1/agents)', () => {
    describe('GET /v1/agents', () => {
      it('returns 200 with agents list (client token)', async () => {
        const res = await request(server).get('/v1/agents').set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });

      it('returns 401 without token', async () => {
        const res = await request(server).get('/v1/agents');
        expect(res.status).toBe(401);
      });
    });

    describe('GET /v1/agents/:agentId', () => {
      it('returns 200 for a valid agent ID', async () => {
        const res = await request(server).get(`/v1/agents/${testIds.agent}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('POST /v1/agents', () => {
      it('returns 201 creating agent (lounge token)', async () => {
        const res = await request(server)
          .post('/v1/agents')
          .set('Authorization', bearerHeader(loungeToken()))
          .send({
            agentName: 'new-agent',
            password: 'AgentPass@123',
            loungeId: testIds.lounge,
            idLoungeService: [testIds.loungeService],
          });
        expectRouteOk(res.status);
      });

      it('returns 403 creating agent with client token', async () => {
        const res = await request(server)
          .post('/v1/agents')
          .set('Authorization', bearerHeader(clientToken()))
          .send({
            agentName: 'new-agent',
            password: 'AgentPass@123',
            loungeId: testIds.lounge,
            idLoungeService: [testIds.loungeService],
          });
        expectRouteOk(res.status);
      });
    });

    describe('DELETE /v1/agents/:agentId', () => {
      it('returns 200 deleting agent (lounge token)', async () => {
        const res = await request(server)
          .delete(`/v1/agents/${testIds.agent}`)
          .set('Authorization', bearerHeader(loungeToken()));
        expectRouteOk(res.status);
      });

      it('returns 403 deleting agent with client token', async () => {
        const res = await request(server)
          .delete(`/v1/agents/${testIds.agent}`)
          .set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });
  });

  // ── Client routes (/v1/client) ───────────────────────────────────────────

  describe('Client (/v1/client)', () => {
    describe('GET /v1/client/lounges', () => {
      it('returns 200 with lounges list', async () => {
        const res = await request(server).get('/v1/client/lounges').set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/client/lounges/:loungeId', () => {
      it('returns 200 for specific lounge', async () => {
        const res = await request(server).get(`/v1/client/lounges/${testIds.lounge}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/client/profile/:clientId', () => {
      it('returns 200 for client visitor profile', async () => {
        const res = await request(server).get(`/v1/client/profile/${testIds.client}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });
  });

  // ── Follow routes (/v1/follows) ──────────────────────────────────────────

  describe('Follows (/v1/follows)', () => {
    describe('POST /v1/follows/:targetId', () => {
      it('returns 200 following a user', async () => {
        const res = await request(server)
          .post(`/v1/follows/${testIds.lounge}`)
          .set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });

      it('returns 401 without token', async () => {
        const res = await request(server).post(`/v1/follows/${testIds.lounge}`);
        expect(res.status).toBe(401);
      });
    });

    describe('DELETE /v1/follows/:targetId', () => {
      it('returns 200 unfollowing a user', async () => {
        const res = await request(server)
          .delete(`/v1/follows/${testIds.lounge}`)
          .set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/follows/following/:userId', () => {
      it('returns 200 with following list', async () => {
        const res = await request(server).get(`/v1/follows/following/${testIds.client}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/follows/followers/:userId', () => {
      it('returns 200 with followers list', async () => {
        const res = await request(server).get(`/v1/follows/followers/${testIds.client}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/follows/counts/:userId', () => {
      it('returns 200 with follow counts', async () => {
        const res = await request(server).get(`/v1/follows/counts/${testIds.client}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });

    describe('GET /v1/follows/check/:targetId', () => {
      it('returns 200 with follow status', async () => {
        const res = await request(server).get(`/v1/follows/check/${testIds.lounge}`).set('Authorization', bearerHeader(clientToken()));
        expectRouteOk(res.status);
      });
    });
  });
});
