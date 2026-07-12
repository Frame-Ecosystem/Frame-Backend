/**
 * Rating System — Matrix Guard & Aggregation Tests
 *
 * Verifies the rating matrix, self-rating prevention, duplicate handling,
 * and summary aggregation for the generalized rating system.
 *
 * Allowed rating pairs:
 *   client → lounge
 *   client → agent
 *   agent  → lounge
 *   lounge → agent
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
      notifyLoungeRated: jest.fn().mockResolvedValue(undefined),
      notifyAgentRated: jest.fn().mockResolvedValue(undefined),
      notifyRatingReceived: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// ── Model mocks ───────────────────────────────────────────────────────────────

const mockUserFindById = jest.fn();
const mockRatingFindOneAndUpdate = jest.fn();
const mockRatingFindOneAndDelete = jest.fn();
const mockRatingFindOne = jest.fn();
const mockRatingFind = jest.fn();
const mockRatingAggregate = jest.fn();
const mockRatingCountDocuments = jest.fn();
const mockUserFindByIdAndUpdate = jest.fn();

jest.mock('@systems/UserManager/models/user.model', () => ({
  __esModule: true,
  default: {
    findById: mockUserFindById,
    findByIdAndUpdate: mockUserFindByIdAndUpdate,
  },
}));

jest.mock('@systems/ServiceCatalogSystem/models/rating.model', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: mockRatingFindOneAndUpdate,
    findOneAndDelete: mockRatingFindOneAndDelete,
    findOne: mockRatingFindOne,
    find: mockRatingFind,
    aggregate: mockRatingAggregate,
    countDocuments: mockRatingCountDocuments,
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import RatingService from '@systems/ServiceCatalogSystem/services/rating.service';
import { isAllowedRatingPair } from '@systems/ServiceCatalogSystem/interfaces/rating.interface';
import { Types } from 'mongoose';

// ── Helpers ───────────────────────────────────────────────────────────────────

const id = () => new Types.ObjectId().toHexString();

const chainable = (val: any) => {
  const obj: any = {};
  for (const m of ['lean', 'select', 'populate', 'sort', 'skip', 'limit', 'exec']) {
    obj[m] = jest
      .fn()
      .mockReturnValue(typeof val?.then === 'function' ? val : obj);
  }
  obj.then = (resolve: any, reject?: any) => Promise.resolve(val).then(resolve, reject);
  return obj;
};

const ok = (val: any) => chainable(val);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RatingService — Rating Matrix & Aggregation', () => {
  let svc: RatingService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new RatingService();
  });

  // ── Rating matrix validation ──────────────────────────────────────────────

  describe('isAllowedRatingPair', () => {
    it('allows client → lounge', () => {
      expect(isAllowedRatingPair('client', 'lounge')).toBe(true);
    });

    it('allows client → agent', () => {
      expect(isAllowedRatingPair('client', 'agent')).toBe(true);
    });

    it('allows agent → lounge', () => {
      expect(isAllowedRatingPair('agent', 'lounge')).toBe(true);
    });

    it('allows lounge → agent', () => {
      expect(isAllowedRatingPair('lounge', 'agent')).toBe(true);
    });

    it('rejects agent → client', () => {
      expect(isAllowedRatingPair('agent', 'client')).toBe(false);
    });

    it('rejects lounge → client', () => {
      expect(isAllowedRatingPair('lounge', 'client')).toBe(false);
    });

    it('rejects client → client', () => {
      expect(isAllowedRatingPair('client', 'client')).toBe(false);
    });

    it('rejects agent → agent', () => {
      expect(isAllowedRatingPair('agent', 'agent')).toBe(false);
    });

    it('rejects lounge → lounge', () => {
      expect(isAllowedRatingPair('lounge', 'lounge')).toBe(false);
    });
  });

  // ── upsertRating ──────────────────────────────────────────────────────────

  describe('upsertRating', () => {
    const raterId = id();
    const targetId = id();

    const setupUsers = (raterType: string, targetType: string) => {
      mockUserFindById.mockImplementation((uid: string) => {
        if (uid === raterId) return ok({ type: raterType, firstName: 'Rater' });
        return ok({ type: targetType, isBlocked: false });
      });
    };

    it('creates a rating for client → lounge', async () => {
      setupUsers('client', 'lounge');
      mockRatingFindOneAndUpdate.mockReturnValue(ok({ _id: id(), score: 5 }));
      mockRatingAggregate.mockResolvedValue([{ avg: 5, count: 1 }]);

      const result = await svc.upsertRating(raterId, { targetId, score: 5 });
      expect(result.score).toBe(5);
      expect(mockRatingFindOneAndUpdate).toHaveBeenCalled();
    });

    it('creates a rating for client → agent', async () => {
      setupUsers('client', 'agent');
      mockRatingFindOneAndUpdate.mockReturnValue(ok({ _id: id(), score: 4 }));
      mockRatingAggregate.mockResolvedValue([{ avg: 4, count: 1 }]);

      const result = await svc.upsertRating(raterId, { targetId, score: 4 });
      expect(result.score).toBe(4);
    });

    it('creates a rating for agent → lounge', async () => {
      setupUsers('agent', 'lounge');
      mockRatingFindOneAndUpdate.mockReturnValue(ok({ _id: id(), score: 3 }));
      mockRatingAggregate.mockResolvedValue([{ avg: 3, count: 1 }]);

      const result = await svc.upsertRating(raterId, { targetId, score: 3 });
      expect(result.score).toBe(3);
    });

    it('creates a rating for lounge → agent', async () => {
      setupUsers('lounge', 'agent');
      mockRatingFindOneAndUpdate.mockReturnValue(ok({ _id: id(), score: 5 }));
      mockRatingAggregate.mockResolvedValue([{ avg: 5, count: 1 }]);

      const result = await svc.upsertRating(raterId, { targetId, score: 5 });
      expect(result.score).toBe(5);
    });

    it('blocks self-rating', async () => {
      await expect(svc.upsertRating(raterId, { targetId: raterId, score: 5 })).rejects.toThrow('You cannot rate yourself');
      expect(mockRatingFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects agent → client (client is not rateable)', async () => {
      setupUsers('agent', 'client');
      await expect(svc.upsertRating(raterId, { targetId, score: 5 })).rejects.toThrow('Target user is not rateable');
      expect(mockRatingFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects lounge → client (client is not rateable)', async () => {
      setupUsers('lounge', 'client');
      await expect(svc.upsertRating(raterId, { targetId, score: 5 })).rejects.toThrow('Target user is not rateable');
    });

    it('rejects client → client (client is not rateable)', async () => {
      setupUsers('client', 'client');
      await expect(svc.upsertRating(raterId, { targetId, score: 5 })).rejects.toThrow('Target user is not rateable');
    });

    it('rejects agent → agent (same type not allowed)', async () => {
      setupUsers('agent', 'agent');
      await expect(svc.upsertRating(raterId, { targetId, score: 5 })).rejects.toThrow('A agent cannot rate a agent');
    });

    it('rejects lounge → lounge (same type not allowed)', async () => {
      setupUsers('lounge', 'lounge');
      await expect(svc.upsertRating(raterId, { targetId, score: 5 })).rejects.toThrow('A lounge cannot rate a lounge');
    });

    it('rejects blocked target', async () => {
      mockUserFindById.mockImplementation((uid: string) => {
        if (uid === raterId) return ok({ type: 'client', firstName: 'Rater' });
        return ok({ type: 'lounge', isBlocked: true });
      });

      await expect(svc.upsertRating(raterId, { targetId, score: 5 })).rejects.toThrow('User not found');
    });

    it('refreshes target summary after rating', async () => {
      setupUsers('client', 'lounge');
      mockRatingFindOneAndUpdate.mockReturnValue(ok({ _id: id(), score: 5 }));
      mockRatingAggregate.mockResolvedValue([{ avg: 4.5, count: 3 }]);

      await svc.upsertRating(raterId, { targetId, score: 5 });

      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(targetId, {
        averageRating: 4.5,
        ratingCount: 3,
      });
    });
  });

  // ── deleteRating ──────────────────────────────────────────────────────────

  describe('deleteRating', () => {
    it('deletes and refreshes summary', async () => {
      const raterId = id();
      const targetId = id();

      mockRatingFindOneAndDelete.mockReturnValue(ok({ _id: id() }));
      mockRatingAggregate.mockResolvedValue([{ avg: 3, count: 2 }]);

      await svc.deleteRating(raterId, targetId);

      expect(mockRatingFindOneAndDelete).toHaveBeenCalledWith({ raterId, targetId });
      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(targetId, {
        averageRating: 3,
        ratingCount: 2,
      });
    });

    it('throws when rating not found', async () => {
      const raterId = id();
      const targetId = id();
      mockRatingFindOneAndDelete.mockReturnValue(ok(null));

      await expect(svc.deleteRating(raterId, targetId)).rejects.toThrow('Rating not found');
    });
  });

  // ── getTargetRatings ──────────────────────────────────────────────────────

  describe('getTargetRatings', () => {
    it('returns paginated ratings for a target', async () => {
      const targetId = id();
      const ratings = [{ _id: id(), score: 5 }, { _id: id(), score: 4 }];

      mockRatingFind.mockReturnValue(ok(ratings));
      mockRatingCountDocuments.mockReturnValue(ok(2));

      const result = await svc.getTargetRatings(targetId, 1, 20);
      expect(result.ratings).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  // ── getMyRating ───────────────────────────────────────────────────────────

  describe('getMyRating', () => {
    it('returns the rater\'s rating for a target', async () => {
      const raterId = id();
      const targetId = id();
      const rating = { _id: id(), score: 5 };

      mockRatingFindOne.mockReturnValue(ok(rating));

      const result = await svc.getMyRating(raterId, targetId);
      expect(result).toBeDefined();
      expect(mockRatingFindOne).toHaveBeenCalledWith({ raterId, targetId });
    });

    it('returns null when no rating exists', async () => {
      const raterId = id();
      const targetId = id();
      mockRatingFindOne.mockReturnValue(ok(null));

      const result = await svc.getMyRating(raterId, targetId);
      expect(result).toBeNull();
    });
  });

  // ── refreshTargetSummary (via upsert) ─────────────────────────────────────

  describe('refreshTargetSummary', () => {
    it('resets to 0 when no ratings exist', async () => {
      const raterId = id();
      const targetId = id();

      mockUserFindById.mockImplementation((uid: string) => {
        if (uid === raterId) return ok({ type: 'client', firstName: 'Rater' });
        return ok({ type: 'lounge', isBlocked: false });
      });

      mockRatingFindOneAndUpdate.mockReturnValue(ok({ _id: id(), score: 5 }));
      mockRatingAggregate.mockResolvedValue([]); // no ratings

      await svc.upsertRating(raterId, { targetId, score: 5 });

      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(targetId, {
        averageRating: 0,
        ratingCount: 0,
      });
    });

    it('rounds average to 1 decimal', async () => {
      const raterId = id();
      const targetId = id();

      mockUserFindById.mockImplementation((uid: string) => {
        if (uid === raterId) return ok({ type: 'client', firstName: 'Rater' });
        return ok({ type: 'lounge', isBlocked: false });
      });

      mockRatingFindOneAndUpdate.mockReturnValue(ok({ _id: id(), score: 4 }));
      mockRatingAggregate.mockResolvedValue([{ avg: 4.33333, count: 5 }]);

      await svc.upsertRating(raterId, { targetId, score: 4 });

      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(targetId, {
        averageRating: 4.3,
        ratingCount: 5,
      });
    });
  });
});
