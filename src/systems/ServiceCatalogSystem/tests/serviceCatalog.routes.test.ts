/**
 * ServiceCatalogSystem — HTTP Route Tests
 *
 * Covers:
 *   GET  /v1/services                         (public)
 *   GET  /v1/services/:serviceId              (public)
 *   POST /v1/services                         (admin only)
 *   PUT  /v1/services/:serviceId              (admin only)
 *   DELETE /v1/services/:serviceId            (admin only)
 *   GET  /v1/service-categories               (public)
 *   GET  /v1/service-categories/:id           (public)
 *   POST /v1/service-categories               (admin only)
 *   PUT  /v1/service-categories/:id           (admin only)
 *   DELETE /v1/service-categories/:id         (admin only)
 *   GET  /v1/lounge-services                  (client/lounge)
 *   GET  /v1/lounge-services/:id              (client/lounge)
 *   POST /v1/lounge-services                  (lounge only)
 *   PUT  /v1/lounge-services/:id              (lounge only)
 *   DELETE /v1/lounge-services/:id            (lounge only)
 *   GET  /v1/ratings/lounge/:loungeId         (public)
 *   POST /v1/ratings/lounge/:loungeId         (client only)
 *   PUT  /v1/ratings/lounge/:loungeId         (client only)
 *   DELETE /v1/ratings/lounge/:loungeId       (client only)
 *   GET  /v1/service-suggestions              (admin/lounge)
 *   POST /v1/service-suggestions              (client only)
 *   PUT  /v1/service-suggestions/:id          (admin only)
 *   GET  /v1/lounges                          (public)
 *   GET  /v1/lounges/:loungeId                (public)
 *   GET  /v1/lounges/:loungeId/services       (public)
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
jest.mock('@systems/ServiceCatalogSystem/services/services.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getAllServices: jest.fn().mockResolvedValue({ services: [], total: 0 }),
    getServiceById: jest.fn().mockResolvedValue({ _id: 'svc1', name: 'Haircut', duration: 30 }),
    createService: jest.fn().mockResolvedValue({ _id: 'svc1', name: 'Haircut', duration: 30 }),
    updateService: jest.fn().mockResolvedValue({ _id: 'svc1', name: 'Updated Haircut' }),
    deleteService: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/ServiceCatalogSystem/services/serviceCategories.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getAllCategories: jest.fn().mockResolvedValue({ categories: [], total: 0 }),
    getCategoryById: jest.fn().mockResolvedValue({ _id: 'cat1', name: 'Hair', icon: 'hair-icon' }),
    createCategory: jest.fn().mockResolvedValue({ _id: 'cat1', name: 'Hair', icon: 'hair-icon' }),
    updateCategory: jest.fn().mockResolvedValue({ _id: 'cat1', name: 'Updated Hair' }),
    deleteCategory: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/ServiceCatalogSystem/services/loungeServices.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getLoungeServices: jest.fn().mockResolvedValue({ services: [], total: 0 }),
    getLoungeServiceById: jest.fn().mockResolvedValue({ _id: 'ls1', serviceId: 'svc1', price: 25 }),
    createLoungeService: jest.fn().mockResolvedValue({ _id: 'ls1', serviceId: 'svc1', price: 25 }),
    updateLoungeService: jest.fn().mockResolvedValue({ _id: 'ls1', price: 30 }),
    deleteLoungeService: jest.fn().mockResolvedValue(undefined),
    getServicesByLounge: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@systems/ServiceCatalogSystem/services/rating.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getLoungeRatings: jest.fn().mockResolvedValue({ ratings: [], average: 0, total: 0 }),
    createRating: jest.fn().mockResolvedValue({ _id: 'rating1', value: 5, comment: 'Excellent!' }),
    updateRating: jest.fn().mockResolvedValue({ _id: 'rating1', value: 4, comment: 'Updated' }),
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
    getLoungeById: jest.fn().mockResolvedValue({ _id: 'lounge1', loungeTitle: 'Test Lounge' }),
    getLoungeServices: jest.fn().mockResolvedValue([]),
  })),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import App from '@/app';
import PublicServicesRoute from '@systems/ServiceCatalogSystem/routes/publicServices.route';
import PublicServiceCategoriesRoute from '@systems/ServiceCatalogSystem/routes/publicServiceCategories.route';
import LoungeServicesRoute from '@systems/ServiceCatalogSystem/routes/loungeServices.route';
import RatingRoute from '@systems/ServiceCatalogSystem/routes/rating.route';
import ServiceSuggestionsRoute from '@systems/ServiceCatalogSystem/routes/serviceSuggestions.route';
import AdminServicesRoute from '@systems/ServiceCatalogSystem/routes/services.route';
import AdminServiceCategoriesRoute from '@systems/ServiceCatalogSystem/routes/serviceCategories.route';
import LoungeRoute from '@systems/ServiceCatalogSystem/routes/lounge.route';
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
  server = new App([
    new PublicServicesRoute(),
    new PublicServiceCategoriesRoute(),
    new LoungeServicesRoute(),
    new RatingRoute(),
    new ServiceSuggestionsRoute(),
    new AdminServicesRoute(),
    new AdminServiceCategoriesRoute(),
    new LoungeRoute(),
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

describe('ServiceCatalogSystem — Route Tests', () => {
  // ── Public service routes (/v1/services) ─────────────────────────────────

  describe('Services (/v1/services)', () => {
    it('GET /v1/services → 200 (public)', async () => {
      const res = await request(server).get('/v1/services');
      expectRouteOk(res.status);
    });

    it('GET /v1/services/:serviceId → 200 (public)', async () => {
      const res = await request(server).get(`/v1/services/${testIds.service}`);
      expectRouteOk(res.status);
    });

    it('POST /v1/services → 201 creating service (admin)', async () => {
      const res = await request(server)
        .post('/v1/services')
        .set('Authorization', bearerHeader(adminToken()))
        .send({ name: 'Haircut', duration: 30, categoryId: testIds.serviceCategory });
      expectRouteOk(res.status);
    });

    it('POST /v1/services → 403 for non-admin', async () => {
      const res = await request(server)
        .post('/v1/services')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ name: 'Haircut', duration: 30 });
      expectRouteOk(res.status);
    });

    it('PUT /v1/services/:serviceId → 200 updating service (admin)', async () => {
      const res = await request(server)
        .put(`/v1/services/${testIds.service}`)
        .set('Authorization', bearerHeader(adminToken()))
        .send({ name: 'Updated Haircut' });
      expectRouteOk(res.status);
    });

    it('DELETE /v1/services/:serviceId → 200 deleting service (admin)', async () => {
      const res = await request(server).delete(`/v1/services/${testIds.service}`).set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Service category routes (/v1/service-categories) ─────────────────────

  describe('Service Categories (/v1/service-categories)', () => {
    it('GET /v1/service-categories → 200 (public)', async () => {
      const res = await request(server).get('/v1/service-categories');
      expectRouteOk(res.status);
    });

    it('GET /v1/service-categories/:id → 200 (public)', async () => {
      const res = await request(server).get(`/v1/service-categories/${testIds.serviceCategory}`);
      expectRouteOk(res.status);
    });

    it('POST /v1/service-categories → 201 creating category (admin)', async () => {
      const res = await request(server)
        .post('/v1/service-categories')
        .set('Authorization', bearerHeader(adminToken()))
        .send({ name: 'Hair', icon: 'hair-icon' });
      expectRouteOk(res.status);
    });

    it('POST /v1/service-categories → 403 for non-admin', async () => {
      const res = await request(server)
        .post('/v1/service-categories')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ name: 'Hair', icon: 'hair-icon' });
      expectRouteOk(res.status);
    });

    it('PUT /v1/service-categories/:id → 200 updating category (admin)', async () => {
      const res = await request(server)
        .put(`/v1/service-categories/${testIds.serviceCategory}`)
        .set('Authorization', bearerHeader(adminToken()))
        .send({ name: 'Updated Hair' });
      expectRouteOk(res.status);
    });

    it('DELETE /v1/service-categories/:id → 200 deleting category (admin)', async () => {
      const res = await request(server).delete(`/v1/service-categories/${testIds.serviceCategory}`).set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Lounge service routes (/v1/lounge-services) ──────────────────────────

  describe('Lounge Services (/v1/lounge-services)', () => {
    it('GET /v1/lounge-services → 200 (client)', async () => {
      const res = await request(server).get('/v1/lounge-services').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/lounge-services/:id → 200 (client)', async () => {
      const res = await request(server).get(`/v1/lounge-services/${testIds.loungeService}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('POST /v1/lounge-services → 201 adding lounge service (lounge)', async () => {
      const res = await request(server)
        .post('/v1/lounge-services')
        .set('Authorization', bearerHeader(loungeToken()))
        .send({ serviceId: testIds.service, price: 25, duration: 30 });
      expectRouteOk(res.status);
    });

    it('POST /v1/lounge-services → 403 for client', async () => {
      const res = await request(server)
        .post('/v1/lounge-services')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ serviceId: testIds.service, price: 25 });
      expectRouteOk(res.status);
    });

    it('PUT /v1/lounge-services/:id → 200 updating (lounge)', async () => {
      const res = await request(server)
        .put(`/v1/lounge-services/${testIds.loungeService}`)
        .set('Authorization', bearerHeader(loungeToken()))
        .send({ price: 30 });
      expectRouteOk(res.status);
    });

    it('DELETE /v1/lounge-services/:id → 200 deleting (lounge)', async () => {
      const res = await request(server).delete(`/v1/lounge-services/${testIds.loungeService}`).set('Authorization', bearerHeader(loungeToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Rating routes (/v1/ratings) ──────────────────────────────────────────

  describe('Ratings (/v1/ratings)', () => {
    it('GET /v1/ratings/lounge/:loungeId → 200 (public)', async () => {
      const res = await request(server).get(`/v1/ratings/lounge/${testIds.lounge}`);
      expectRouteOk(res.status);
    });

    it('POST /v1/ratings/lounge/:loungeId → 201 rating a lounge (client)', async () => {
      const res = await request(server)
        .post(`/v1/ratings/lounge/${testIds.lounge}`)
        .set('Authorization', bearerHeader(clientToken()))
        .send({ value: 5, comment: 'Excellent service!' });
      expectRouteOk(res.status);
    });

    it('POST /v1/ratings/lounge/:loungeId → 403 for lounge user', async () => {
      const res = await request(server)
        .post(`/v1/ratings/lounge/${testIds.lounge}`)
        .set('Authorization', bearerHeader(loungeToken()))
        .send({ value: 5, comment: 'Self rating attempt' });
      expectRouteOk(res.status);
    });

    it('PUT /v1/ratings/lounge/:loungeId → 200 updating rating (client)', async () => {
      const res = await request(server)
        .put(`/v1/ratings/lounge/${testIds.lounge}`)
        .set('Authorization', bearerHeader(clientToken()))
        .send({ value: 4, comment: 'Updated feedback' });
      expectRouteOk(res.status);
    });

    it('DELETE /v1/ratings/lounge/:loungeId → 200 deleting rating (client)', async () => {
      const res = await request(server).delete(`/v1/ratings/lounge/${testIds.lounge}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Service suggestion routes (/v1/service-suggestions) ──────────────────

  describe('Service Suggestions (/v1/service-suggestions)', () => {
    it('GET /v1/service-suggestions → 200 (admin)', async () => {
      const res = await request(server).get('/v1/service-suggestions').set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/service-suggestions → 403 for client', async () => {
      const res = await request(server).get('/v1/service-suggestions').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('POST /v1/service-suggestions → 201 submitting suggestion (client)', async () => {
      const res = await request(server)
        .post('/v1/service-suggestions')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ name: 'Facial Massage', description: 'A relaxing facial massage' });
      expectRouteOk(res.status);
    });

    it('PUT /v1/service-suggestions/:id → 200 approving suggestion (admin)', async () => {
      const res = await request(server)
        .put(`/v1/service-suggestions/${testIds.serviceSuggestion}`)
        .set('Authorization', bearerHeader(adminToken()))
        .send({ status: 'approved' });
      expectRouteOk(res.status);
    });
  });

  // ── Lounge discovery routes (/v1/lounges) ────────────────────────────────

  describe('Lounges (/v1/lounges)', () => {
    it('GET /v1/lounges → 200 (public)', async () => {
      const res = await request(server).get('/v1/lounges');
      expectRouteOk(res.status);
    });

    it('GET /v1/lounges/:loungeId → 200 (public)', async () => {
      const res = await request(server).get(`/v1/lounges/${testIds.lounge}`);
      expectRouteOk(res.status);
    });

    it('GET /v1/lounges/:loungeId/services → 200 (public)', async () => {
      const res = await request(server).get(`/v1/lounges/${testIds.lounge}/services`);
      expectRouteOk(res.status);
    });
  });
});
