/**
 * Like System — Matrix Guard & Aggregation Tests
 *
 * Verifies the like matrix, self-like prevention, toggle behavior,
 * and count aggregation for the generalized like system.
 *
 * Allowed like pairs:
 *   Any user → lounge | agent
 *   (clients, lounges, agents can all like lounges and agents)
 */

// ── Hoist mocks ───────────────────────────────────────────────────────────────

jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  connect: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue(undefined),
  set: jest.fn(),
  connection: { readyState: 1, host: 'test', name: 'test' },
}));

jest.mock('@utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@systems/NotificationSystem/services/notification.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      extractName: jest.fn().mockReturnValue('Test User'),
      notifyLoungeLiked: jest.fn().mockResolvedValue(undefined),
      notifyAgentLiked: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// ── Model mocks ───────────────────────────────────────────────────────────────

const mockUserFindById = jest.fn();
const mockUserFindByIdAndUpdate = jest.fn();
const mockLikeFindOne = jest.fn();
const mockLikeDeleteOne = jest.fn();
const mockLikeCreate = jest.fn();
const mockLikeCountDocuments = jest.fn();

jest.mock('@systems/UserManager/models/user.model', () => ({
  __esModule: true,
  default: {
    findById: mockUserFindById,
    findByIdAndUpdate: mockUserFindByIdAndUpdate,
  },
}));

jest.mock('@systems/FeedContentSystem/models/like.model', () => ({
  __esModule: true,
  default: {
    findOne: mockLikeFindOne,
    deleteOne: mockLikeDeleteOne,
    create: mockLikeCreate,
    countDocuments: mockLikeCountDocuments,
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import LikeService from '@systems/FeedContentSystem/services/like.service';
import { isAllowedLikePair } from '@systems/FeedContentSystem/interfaces/like.interface';
import { Types } from 'mongoose';

// ── Helpers ───────────────────────────────────────────────────────────────────

const id = () => new Types.ObjectId().toHexString();

const chainable = (val: any) => {
  const obj: any = {};
  for (const m of ['lean', 'select', 'populate', 'sort', 'skip', 'limit', 'exec']) {
    obj[m] = jest.fn().mockReturnValue(obj);
  }
  obj.then = (resolve: any, reject?: any) => Promise.resolve(val).then(resolve, reject);
  return obj;
};

const ok = (val: any) => chainable(val);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LikeService — Like Matrix & Toggle', () => {
  let svc: LikeService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new LikeService();
  });

  // ── Like matrix validation ──────────────────────────────────────────────

  describe('isAllowedLikePair', () => {
    it('allows client → lounge', () => {
      expect(isAllowedLikePair('client', 'lounge')).toBe(true);
    });

    it('allows client → agent', () => {
      expect(isAllowedLikePair('client', 'agent')).toBe(true);
    });

    it('allows lounge → agent', () => {
      expect(isAllowedLikePair('lounge', 'agent')).toBe(true);
    });

    it('rejects agent → client', () => {
      expect(isAllowedLikePair('agent', 'client')).toBe(false);
    });

    it('rejects lounge → client', () => {
      expect(isAllowedLikePair('lounge', 'client')).toBe(false);
    });

    it('allows agent → lounge', () => {
      expect(isAllowedLikePair('agent', 'lounge')).toBe(true);
    });

    it('allows lounge → lounge', () => {
      expect(isAllowedLikePair('lounge', 'lounge')).toBe(true);
    });

    it('rejects client → client', () => {
      expect(isAllowedLikePair('client', 'client')).toBe(false);
    });

    it('allows agent → agent', () => {
      expect(isAllowedLikePair('agent', 'agent')).toBe(true);
    });
  });

  // ── toggleLike ──────────────────────────────────────────────────────────

  describe('toggleLike', () => {
    const userId = id();
    const targetId = id();

    const setupUsers = (likerType: string, targetType: string) => {
      mockUserFindById.mockImplementation((uid: string) => {
        if (uid === userId) return ok({ type: likerType, firstName: 'Liker' });
        return ok({ type: targetType, isBlocked: false });
      });
    };

    it('creates a like for client → lounge', async () => {
      setupUsers('client', 'lounge');
      mockLikeFindOne.mockReturnValue(ok(null));
      mockLikeCreate.mockResolvedValue({ _id: id() });
      mockLikeCountDocuments.mockReturnValue(ok(1));

      const result = await svc.toggleLike(userId, targetId);
      expect(result.liked).toBe(true);
      expect(mockLikeCreate).toHaveBeenCalled();
    });

    it('creates a like for client → agent', async () => {
      setupUsers('client', 'agent');
      mockLikeFindOne.mockReturnValue(ok(null));
      mockLikeCreate.mockResolvedValue({ _id: id() });
      mockLikeCountDocuments.mockReturnValue(ok(1));

      const result = await svc.toggleLike(userId, targetId);
      expect(result.liked).toBe(true);
    });

    it('creates a like for lounge → agent', async () => {
      setupUsers('lounge', 'agent');
      mockLikeFindOne.mockReturnValue(ok(null));
      mockLikeCreate.mockResolvedValue({ _id: id() });
      mockLikeCountDocuments.mockReturnValue(ok(1));

      const result = await svc.toggleLike(userId, targetId);
      expect(result.liked).toBe(true);
    });

    it('removes an existing like (unlike)', async () => {
      setupUsers('client', 'lounge');
      const existingId = id();
      mockLikeFindOne.mockReturnValue(ok({ _id: existingId }));
      mockLikeDeleteOne.mockResolvedValue({ deletedCount: 1 });
      mockLikeCountDocuments.mockReturnValue(ok(0));

      const result = await svc.toggleLike(userId, targetId);
      expect(result.liked).toBe(false);
      expect(mockLikeDeleteOne).toHaveBeenCalledWith({ _id: existingId });
    });

    it('blocks self-like', async () => {
      await expect(svc.toggleLike(userId, userId)).rejects.toThrow('You cannot like yourself');
      expect(mockLikeCreate).not.toHaveBeenCalled();
    });

    it('rejects agent → client (client is not likeable)', async () => {
      setupUsers('agent', 'client');
      await expect(svc.toggleLike(userId, targetId)).rejects.toThrow('Target user is not likeable');
    });

    it('rejects lounge → client (client is not likeable)', async () => {
      setupUsers('lounge', 'client');
      await expect(svc.toggleLike(userId, targetId)).rejects.toThrow('Target user is not likeable');
    });

    it('creates a like for agent → lounge', async () => {
      setupUsers('agent', 'lounge');
      mockLikeFindOne.mockReturnValue(ok(null));
      mockLikeCreate.mockResolvedValue({ _id: id() });
      mockLikeCountDocuments.mockReturnValue(ok(1));

      const result = await svc.toggleLike(userId, targetId);
      expect(result.liked).toBe(true);
    });

    it('rejects client → client (client is not likeable)', async () => {
      setupUsers('client', 'client');
      await expect(svc.toggleLike(userId, targetId)).rejects.toThrow('Target user is not likeable');
    });

    it('creates a like for agent → agent', async () => {
      setupUsers('agent', 'agent');
      mockLikeFindOne.mockReturnValue(ok(null));
      mockLikeCreate.mockResolvedValue({ _id: id() });
      mockLikeCountDocuments.mockReturnValue(ok(1));

      const result = await svc.toggleLike(userId, targetId);
      expect(result.liked).toBe(true);
    });

    it('creates a like for lounge → lounge', async () => {
      setupUsers('lounge', 'lounge');
      mockLikeFindOne.mockReturnValue(ok(null));
      mockLikeCreate.mockResolvedValue({ _id: id() });
      mockLikeCountDocuments.mockReturnValue(ok(1));

      const result = await svc.toggleLike(userId, targetId);
      expect(result.liked).toBe(true);
    });

    it('rejects blocked target', async () => {
      mockUserFindById.mockImplementation((uid: string) => {
        if (uid === userId) return ok({ type: 'client', firstName: 'Liker' });
        return ok({ type: 'lounge', isBlocked: true });
      });

      await expect(svc.toggleLike(userId, targetId)).rejects.toThrow('User not found');
    });

    it('refreshes target count after like', async () => {
      setupUsers('client', 'lounge');
      mockLikeFindOne.mockReturnValue(ok(null));
      mockLikeCreate.mockResolvedValue({ _id: id() });
      mockLikeCountDocuments.mockReturnValue(ok(5));

      await svc.toggleLike(userId, targetId);

      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(targetId, { likeCount: 5 });
    });

    it('refreshes target count after unlike', async () => {
      setupUsers('client', 'lounge');
      mockLikeFindOne.mockReturnValue(ok({ _id: id() }));
      mockLikeDeleteOne.mockResolvedValue({ deletedCount: 1 });
      mockLikeCountDocuments.mockReturnValue(ok(2));

      await svc.toggleLike(userId, targetId);

      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(targetId, { likeCount: 2 });
    });
  });

  // ── hasLiked ────────────────────────────────────────────────────────────

  describe('hasLiked', () => {
    it('returns true when liked', async () => {
      const userId = id();
      const targetId = id();
      mockLikeFindOne.mockReturnValue(ok({ _id: id() }));

      const result = await svc.hasLiked(userId, targetId);
      expect(result).toBe(true);
    });

    it('returns false when not liked', async () => {
      const userId = id();
      const targetId = id();
      mockLikeFindOne.mockReturnValue(ok(null));

      const result = await svc.hasLiked(userId, targetId);
      expect(result).toBe(false);
    });
  });

  // ── getMyLikes ──────────────────────────────────────────────────────────

  describe('getMyLikes', () => {
    it('returns paginated liked targets', async () => {
      const userId = id();
      const likes = [{ _id: id(), targetId: { _id: id(), type: 'lounge' } }];

      mockLikeFindOne.mockReturnValue(ok(null));
      mockLikeCountDocuments.mockReturnValue(ok(1));

      // Mock the chainable query for getMyLikes
      const chainQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(likes),
      };
      const mockFind = jest.fn().mockReturnValue(chainQuery);
      (svc as any).likes = { find: mockFind, countDocuments: jest.fn().mockReturnValue(ok(1)) };

      const result = await svc.getMyLikes(userId, 1, 20);
      expect(result.likes).toHaveLength(1);
    });
  });

  // ── getTargetLikers ─────────────────────────────────────────────────────

  describe('getTargetLikers', () => {
    it('returns paginated likers for a target', async () => {
      const targetId = id();
      const likes = [{ _id: id(), likerId: { _id: id(), type: 'client' } }];

      const chainQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(likes),
      };
      const mockFind = jest.fn().mockReturnValue(chainQuery);
      (svc as any).likes = { find: mockFind, countDocuments: jest.fn().mockReturnValue(ok(1)) };

      const result = await svc.getTargetLikers(targetId, 1, 20);
      expect(result.likes).toHaveLength(1);
    });
  });
});
