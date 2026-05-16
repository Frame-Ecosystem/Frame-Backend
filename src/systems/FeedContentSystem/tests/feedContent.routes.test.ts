/**
 * FeedContentSystem — HTTP Route Tests
 *
 * Covers:
 *   GET  /v1/feed
 *   GET  /v1/feed/explore
 *   GET  /v1/feed/saved
 *   GET  /v1/feed/hashtag/:tag
 *   GET  /v1/feed/hashtags/trending
 *   POST /v1/posts
 *   GET  /v1/posts/user/:userId
 *   GET  /v1/posts/:postId
 *   PUT  /v1/posts/:postId
 *   DELETE /v1/posts/:postId
 *   POST /v1/posts/:postId/like
 *   POST /v1/posts/:postId/save
 *   PUT  /v1/posts/:postId/hide   (admin)
 *   POST /v1/reels
 *   GET  /v1/reels/:reelId
 *   POST /v1/reels/:reelId/like
 *   POST /v1/comments/:targetType/:targetId
 *   GET  /v1/comments/:targetType/:targetId
 *   GET  /v1/comments/:commentId/replies
 *   DELETE /v1/comments/:commentId
 *   POST /v1/likes/:loungeId       (lounge like)
 *   GET  /v1/likes/me
 *   POST /v1/reports/:targetType/:targetId
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
  isAgent: (user: any) => user?.type === 'agent',
}));

// Service mocks
jest.mock('@systems/FeedContentSystem/services/post.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createPost: jest.fn().mockResolvedValue({ _id: 'post1', text: 'Test post' }),
    getPostById: jest.fn().mockResolvedValue({ _id: 'post1', text: 'Test post', likeCount: 0 }),
    getUserPosts: jest.fn().mockResolvedValue({ posts: [], total: 0 }),
    updatePost: jest.fn().mockResolvedValue({ _id: 'post1', text: 'Updated' }),
    deletePost: jest.fn().mockResolvedValue(undefined),
    toggleLike: jest.fn().mockResolvedValue({ liked: true }),
    toggleSave: jest.fn().mockResolvedValue({ saved: true }),
    hidePost: jest.fn().mockResolvedValue(undefined),
    unhidePost: jest.fn().mockResolvedValue(undefined),
    adminDeletePost: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/reel.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createReel: jest.fn().mockResolvedValue({ _id: 'reel1', caption: 'Test reel' }),
    getReelById: jest.fn().mockResolvedValue({ _id: 'reel1', caption: 'Test reel' }),
    getUserReels: jest.fn().mockResolvedValue({ reels: [], total: 0 }),
    getLoungeContent: jest.fn().mockResolvedValue({ posts: [], reels: [], totalPosts: 0, totalReels: 0 }),
    updateReel: jest.fn().mockResolvedValue({ _id: 'reel1', caption: 'Updated' }),
    deleteReel: jest.fn().mockResolvedValue(undefined),
    toggleLike: jest.fn().mockResolvedValue({ liked: true }),
    toggleSave: jest.fn().mockResolvedValue({ saved: true }),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/comment.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addComment: jest.fn().mockResolvedValue({ _id: 'comment1', text: 'Test comment' }),
    getComments: jest.fn().mockResolvedValue({ comments: [], total: 0 }),
    getReplies: jest.fn().mockResolvedValue({ replies: [], total: 0 }),
    toggleLike: jest.fn().mockResolvedValue({ liked: true }),
    deleteComment: jest.fn().mockResolvedValue(undefined),
    hideComment: jest.fn().mockResolvedValue(undefined),
    unhideComment: jest.fn().mockResolvedValue(undefined),
    adminDeleteComment: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/feed.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getFollowingFeed: jest.fn().mockResolvedValue({ posts: [], reels: [], total: 0 }),
    getExploreFeed: jest.fn().mockResolvedValue({ posts: [], reels: [], total: 0 }),
    getSavedContent: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getHashtagFeed: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getTrendingHashtags: jest.fn().mockResolvedValue([]),
    searchHashtags: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/like.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    toggleLike: jest.fn().mockResolvedValue({ liked: true }),
    getMyLikes: jest.fn().mockResolvedValue([]),
    hasLiked: jest.fn().mockResolvedValue(false),
    getLoungeLikers: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@systems/FeedContentSystem/services/report.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    createReport: jest.fn().mockResolvedValue({ _id: 'report1', targetType: 'post' }),
    getReports: jest.fn().mockResolvedValue({ reports: [], total: 0 }),
    reviewReport: jest.fn().mockResolvedValue({ _id: 'report1', status: 'reviewed' }),
  })),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import App from '@/app';
import PostRoute from '@systems/FeedContentSystem/routes/post.route';
import ReelRoute from '@systems/FeedContentSystem/routes/reel.route';
import CommentRoute from '@systems/FeedContentSystem/routes/comment.route';
import FeedRoute from '@systems/FeedContentSystem/routes/feed.route';
import LikeRoute from '@systems/FeedContentSystem/routes/like.route';
import ReportRoute from '@systems/FeedContentSystem/routes/report.route';
import userModel from '@systems/UserManager/models/user.model';
import { makeClientUser, makeLoungeUser, makeAdminUser, testIds } from '../../../tests/helpers/factories';
import { clientToken, adminToken, bearerHeader } from '../../../tests/helpers/jwt.helper';
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
  server = new App([new PostRoute(), new ReelRoute(), new CommentRoute(), new FeedRoute(), new LikeRoute(), new ReportRoute()]).getServer();
});

beforeEach(() => {
  jest.clearAllMocks();
  (userModel.findById as jest.Mock).mockImplementation((id: string) => {
    const user = id === testIds.lounge ? mockLounge : id === testIds.admin ? mockAdmin : mockClient;
    return { select: jest.fn().mockResolvedValue(user) };
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FeedContentSystem — Route Tests', () => {
  // ── Auth guard ───────────────────────────────────────────────────────────

  describe('Authentication enforcement', () => {
    it('GET /v1/feed → 401 without token', async () => {
      const res = await request(server).get('/v1/feed');
      expect(res.status).toBe(401);
    });

    it('GET /v1/posts/:postId → 401 without token', async () => {
      const res = await request(server).get(`/v1/posts/${testIds.post}`);
      expect(res.status).toBe(401);
    });
  });

  // ── Feed routes (/v1/feed) ───────────────────────────────────────────────

  describe('Feed (/v1/feed)', () => {
    it('GET /v1/feed → 200 following feed', async () => {
      const res = await request(server).get('/v1/feed').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/feed/explore → 200 explore feed', async () => {
      const res = await request(server).get('/v1/feed/explore').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/feed/saved → 200 saved content', async () => {
      const res = await request(server).get('/v1/feed/saved').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/feed/hashtag/:tag → 200 hashtag feed', async () => {
      const res = await request(server).get('/v1/feed/hashtag/beauty').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/feed/hashtags/trending → 200 trending hashtags', async () => {
      const res = await request(server).get('/v1/feed/hashtags/trending').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Post routes (/v1/posts) ──────────────────────────────────────────────

  describe('Posts (/v1/posts)', () => {
    it('POST /v1/posts → 201 creating a post', async () => {
      const res = await request(server)
        .post('/v1/posts')
        .set('Authorization', bearerHeader(clientToken()))
        .send({ text: 'Test post content', hashtags: ['beauty'] });
      expectRouteOk(res.status);
    });

    it('GET /v1/posts/user/:userId → 200 user posts', async () => {
      const res = await request(server).get(`/v1/posts/user/${testIds.client}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/posts/:postId → 200 single post', async () => {
      const res = await request(server).get(`/v1/posts/${testIds.post}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('PUT /v1/posts/:postId → 200 updating a post', async () => {
      const res = await request(server)
        .put(`/v1/posts/${testIds.post}`)
        .set('Authorization', bearerHeader(clientToken()))
        .send({ text: 'Updated post content' });
      expectRouteOk(res.status);
    });

    it('DELETE /v1/posts/:postId → 200 deleting a post', async () => {
      const res = await request(server).delete(`/v1/posts/${testIds.post}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('POST /v1/posts/:postId/like → 200 toggling like', async () => {
      const res = await request(server).post(`/v1/posts/${testIds.post}/like`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('POST /v1/posts/:postId/save → 200 toggling save', async () => {
      const res = await request(server).post(`/v1/posts/${testIds.post}/save`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('PUT /v1/posts/:postId/hide → 200 hiding post (admin only)', async () => {
      const res = await request(server).put(`/v1/posts/${testIds.post}/hide`).set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });

    it('PUT /v1/posts/:postId/hide → 403 for non-admin', async () => {
      const res = await request(server).put(`/v1/posts/${testIds.post}/hide`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Reel routes (/v1/reels) ──────────────────────────────────────────────

  describe('Reels (/v1/reels)', () => {
    it('POST /v1/reels → 201 creating a reel', async () => {
      const res = await request(server).post('/v1/reels').set('Authorization', bearerHeader(clientToken())).send({ caption: 'Test reel caption' });
      expectRouteOk(res.status);
    });

    it('GET /v1/reels/:reelId → 200 single reel', async () => {
      const res = await request(server).get(`/v1/reels/${testIds.reel}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/reels/lounge/:loungeId → 200 lounge reels', async () => {
      const res = await request(server).get(`/v1/reels/lounge/${testIds.lounge}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('POST /v1/reels/:reelId/like → 200 toggling like', async () => {
      const res = await request(server).post(`/v1/reels/${testIds.reel}/like`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('DELETE /v1/reels/:reelId → 200 deleting a reel', async () => {
      const res = await request(server).delete(`/v1/reels/${testIds.reel}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Comment routes (/v1/comments) ────────────────────────────────────────

  describe('Comments (/v1/comments)', () => {
    it('POST /v1/comments/post/:postId → 201 adding comment', async () => {
      const res = await request(server)
        .post(`/v1/comments/post/${testIds.post}`)
        .set('Authorization', bearerHeader(clientToken()))
        .send({ text: 'Test comment' });
      expectRouteOk(res.status);
    });

    it('GET /v1/comments/post/:postId → 200 getting comments', async () => {
      const res = await request(server).get(`/v1/comments/post/${testIds.post}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/comments/:commentId/replies → 200 getting replies', async () => {
      const res = await request(server).get(`/v1/comments/${testIds.comment}/replies`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('DELETE /v1/comments/:commentId → 200 deleting own comment', async () => {
      const res = await request(server).delete(`/v1/comments/${testIds.comment}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Like routes (/v1/likes) ──────────────────────────────────────────────

  describe('Likes (/v1/likes)', () => {
    it('POST /v1/likes/:loungeId → 200 toggling lounge like (client)', async () => {
      const res = await request(server).post(`/v1/likes/${testIds.lounge}`).set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/likes/me → 200 my likes (client)', async () => {
      const res = await request(server).get('/v1/likes/me').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });

  // ── Report routes (/v1/reports) ──────────────────────────────────────────

  describe('Reports (/v1/reports)', () => {
    it('POST /v1/reports/post/:postId → 201 creating a report', async () => {
      const res = await request(server)
        .post(`/v1/reports/post/${testIds.post}`)
        .set('Authorization', bearerHeader(clientToken()))
        .send({ reason: 'spam', description: 'Test report' });
      expectRouteOk(res.status);
    });

    it('GET /v1/reports → 200 listing reports (admin)', async () => {
      const res = await request(server).get('/v1/reports').set('Authorization', bearerHeader(adminToken()));
      expectRouteOk(res.status);
    });

    it('GET /v1/reports → 403 for non-admin', async () => {
      const res = await request(server).get('/v1/reports').set('Authorization', bearerHeader(clientToken()));
      expectRouteOk(res.status);
    });
  });
});
