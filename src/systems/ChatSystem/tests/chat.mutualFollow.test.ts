/**
 * ChatSystem — Mutual Follow Guard Tests
 *
 * Verifies that `ensureMutualFollow` blocks DM creation and message
 * sending unless both participants follow each other.
 * Admins bypass the guard in both directions.
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

jest.mock('@systems/NotificationSystem/services/socket.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      getIO: jest.fn().mockReturnValue(null),
      emitChatMessage: jest.fn(),
      emitConversationUpdated: jest.fn(),
      emitChatRead: jest.fn(),
      emitChatMessageDeleted: jest.fn(),
      emitChatMessageEdited: jest.fn(),
      emitChatReaction: jest.fn(),
      emitChatTyping: jest.fn(),
    }),
  },
}));

jest.mock('@systems/NotificationSystem/services/notification.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      notifyChatMessage: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// ── Model mocks ───────────────────────────────────────────────────────────────

const mockUserFindById = jest.fn();
const mockConversationFindOne = jest.fn();
const mockConversationFindOneAndUpdate = jest.fn();
const mockConversationUpdateOne = jest.fn();
const mockConversationCountDocuments = jest.fn();
const mockConversationExists = jest.fn();
const mockMessageCreate = jest.fn();
const mockMessageFindById = jest.fn();
const mockFollowFindOne = jest.fn();

jest.mock('@systems/UserManager/models/user.model', () => ({
  __esModule: true,
  default: { findById: mockUserFindById },
}));

jest.mock('@systems/UserManager/models/follow.model', () => ({
  __esModule: true,
  default: { findOne: mockFollowFindOne },
}));

jest.mock('@systems/ChatSystem/models/chat.model', () => ({
  conversationModel: {
    findOne: mockConversationFindOne,
    findOneAndUpdate: mockConversationFindOneAndUpdate,
    updateOne: mockConversationUpdateOne,
    countDocuments: mockConversationCountDocuments,
    exists: mockConversationExists,
  },
  messageModel: {
    create: mockMessageCreate,
    findById: mockMessageFindById,
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import ChatService from '@systems/ChatSystem/services/chat.service';
import { Types } from 'mongoose';

// ── Helpers ───────────────────────────────────────────────────────────────────

const id = () => new Types.ObjectId().toHexString();

const makeUser = (type: string) => ({ _id: id(), type });

const chainable = (val: any) => {
  const obj: any = {};
  for (const m of ['lean', 'select', 'populate', 'sort', 'skip', 'limit', 'exec']) {
    obj[m] = jest
      .fn()
      .mockReturnValue(val !== undefined ? (typeof val === 'object' && val !== null && typeof val.then === 'function' ? val : obj) : obj);
  }
  obj.then = (resolve: any, reject?: any) => Promise.resolve(val).then(resolve, reject);
  return obj;
};

const ok = (val: any) => {
  const c: any = chainable(val);
  return c;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChatService — Mutual Follow Guard', () => {
  let svc: ChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new ChatService();
  });

  // ── findOrCreateConversation ────────────────────────────────────────────────

  describe('findOrCreateConversation', () => {
    const requesterId = id();
    const recipientId = id();

    const setupUserLookup = (requesterType = 'client', recipientType = 'lounge') => {
      mockUserFindById.mockImplementation((uid: string) => {
        if (uid === requesterId) return ok(makeUser(requesterType));
        if (uid === recipientId) return ok(makeUser(recipientType));
        return ok(null);
      });
    };

    const setupMutualFollows = () => {
      mockFollowFindOne.mockImplementation((q: any) => {
        if (q.followerId === requesterId && q.followingId === recipientId) return ok({ _id: id() });
        if (q.followerId === recipientId && q.followingId === requesterId) return ok({ _id: id() });
        return ok(null);
      });
    };

    it('allows conversation when both follow each other', async () => {
      setupUserLookup('client', 'lounge');
      setupMutualFollows();

      mockConversationFindOne.mockReturnValue(ok(null));
      const conv = { _id: id(), slug: 'a_b', participants: [new Types.ObjectId(requesterId), new Types.ObjectId(recipientId)], deletedFor: [] };
      mockConversationFindOneAndUpdate.mockReturnValue(ok(conv));

      const result = await svc.findOrCreateConversation(requesterId, recipientId);
      expect(result.conversation._id).toBe(conv._id);
      expect(result.wasCreated).toBe(true);
    });

    it('blocks when requester does not follow recipient', async () => {
      setupUserLookup('client', 'lounge');
      mockFollowFindOne.mockImplementation((q: any) => {
        if (q.followerId === recipientId && q.followingId === requesterId) return ok({ _id: id() });
        return ok(null);
      });

      await expect(svc.findOrCreateConversation(requesterId, recipientId)).rejects.toThrow('You must follow each other to send messages');
    });

    it('blocks when recipient does not follow requester', async () => {
      setupUserLookup('client', 'lounge');
      mockFollowFindOne.mockImplementation((q: any) => {
        if (q.followerId === requesterId && q.followingId === recipientId) return ok({ _id: id() });
        return ok(null);
      });

      await expect(svc.findOrCreateConversation(requesterId, recipientId)).rejects.toThrow('You must follow each other to send messages');
    });

    it('blocks when neither follows the other', async () => {
      setupUserLookup('client', 'lounge');
      mockFollowFindOne.mockReturnValue(ok(null));

      await expect(svc.findOrCreateConversation(requesterId, recipientId)).rejects.toThrow('You must follow each other to send messages');
    });

    it('bypasses guard when requester is admin', async () => {
      const adminId = id();
      setupUserLookup('admin', 'lounge');
      mockUserFindById.mockImplementation((uid: string) => {
        if (uid === adminId) return ok(makeUser('admin'));
        if (uid === recipientId) return ok(makeUser('lounge'));
        return ok(null);
      });
      mockFollowFindOne.mockReturnValue(ok(null)); // no follows at all

      mockConversationFindOne.mockReturnValue(ok(null));
      const conv = { _id: id(), slug: 'a_b', participants: [], deletedFor: [] };
      mockConversationFindOneAndUpdate.mockReturnValue(ok(conv));

      const result = await svc.findOrCreateConversation(adminId, recipientId);
      expect(result.wasCreated).toBe(true);
    });

    it('bypasses guard when recipient is admin', async () => {
      setupUserLookup('client', 'admin');
      mockFollowFindOne.mockReturnValue(ok(null)); // no follows at all

      mockConversationFindOne.mockReturnValue(ok(null));
      const conv = { _id: id(), slug: 'a_b', participants: [], deletedFor: [] };
      mockConversationFindOneAndUpdate.mockReturnValue(ok(conv));

      const result = await svc.findOrCreateConversation(requesterId, recipientId);
      expect(result.wasCreated).toBe(true);
    });
  });

  // ── sendMessage ─────────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    const senderId = id();
    const recipientId = id();
    const conversationId = id();

    const setupConversation = () => {
      const participants = [new Types.ObjectId(senderId), new Types.ObjectId(recipientId)];
      mockConversationFindOne.mockReturnValue(ok({ _id: conversationId, participants }));
    };

    const setupUserLookup = (senderType = 'client', recipientType = 'lounge') => {
      mockUserFindById.mockImplementation((uid: string) => {
        if (uid === senderId) return ok(makeUser(senderType));
        if (uid === recipientId) return ok(makeUser(recipientType));
        return ok(null);
      });
    };

    const setupMutualFollows = () => {
      mockFollowFindOne.mockImplementation((q: any) => {
        if (q.followerId === senderId && q.followingId === recipientId) return ok({ _id: id() });
        if (q.followerId === recipientId && q.followingId === senderId) return ok({ _id: id() });
        return ok(null);
      });
    };

    const setupMessagePersist = () => {
      const msg = { _id: id(), conversationId, senderId: new Types.ObjectId(senderId), text: 'Hello', contentType: 'text', createdAt: new Date() };
      mockMessageCreate.mockResolvedValue(msg);
      mockMessageFindById.mockReturnValue(ok(msg));
      mockConversationUpdateOne.mockResolvedValue({});
    };

    it('allows message when both follow each other', async () => {
      setupConversation();
      setupUserLookup('client', 'lounge');
      setupMutualFollows();
      setupMessagePersist();

      const result = await svc.sendMessage(conversationId, senderId, 'text', 'Hello');
      expect(result).toBeDefined();
      expect(mockMessageCreate).toHaveBeenCalled();
    });

    it('blocks message when requester does not follow recipient', async () => {
      setupConversation();
      setupUserLookup('client', 'lounge');
      mockFollowFindOne.mockImplementation((q: any) => {
        if (q.followerId === recipientId && q.followingId === senderId) return ok({ _id: id() });
        return ok(null);
      });

      await expect(svc.sendMessage(conversationId, senderId, 'text', 'Hello')).rejects.toThrow('You must follow each other to send messages');
      expect(mockMessageCreate).not.toHaveBeenCalled();
    });

    it('blocks message when recipient does not follow sender', async () => {
      setupConversation();
      setupUserLookup('client', 'lounge');
      mockFollowFindOne.mockImplementation((q: any) => {
        if (q.followerId === senderId && q.followingId === recipientId) return ok({ _id: id() });
        return ok(null);
      });

      await expect(svc.sendMessage(conversationId, senderId, 'text', 'Hello')).rejects.toThrow('You must follow each other to send messages');
      expect(mockMessageCreate).not.toHaveBeenCalled();
    });

    it('blocks message when neither follows the other', async () => {
      setupConversation();
      setupUserLookup('client', 'lounge');
      mockFollowFindOne.mockReturnValue(ok(null));

      await expect(svc.sendMessage(conversationId, senderId, 'text', 'Hello')).rejects.toThrow('You must follow each other to send messages');
      expect(mockMessageCreate).not.toHaveBeenCalled();
    });

    it('bypasses guard when sender is admin', async () => {
      setupConversation();
      const adminId = id();
      const otherId = id();
      // Update conversation mock to use admin
      mockConversationFindOne.mockReturnValue(
        ok({
          _id: conversationId,
          participants: [new Types.ObjectId(adminId), new Types.ObjectId(otherId)],
        }),
      );
      mockUserFindById.mockImplementation((uid: string) => {
        if (uid === adminId) return ok(makeUser('admin'));
        if (uid === otherId) return ok(makeUser('lounge'));
        return ok(null);
      });
      mockFollowFindOne.mockReturnValue(ok(null)); // no follows

      const msg = { _id: id(), conversationId, senderId: new Types.ObjectId(adminId), text: 'Hi', contentType: 'text', createdAt: new Date() };
      mockMessageCreate.mockResolvedValue(msg);
      mockMessageFindById.mockReturnValue(ok(msg));
      mockConversationUpdateOne.mockResolvedValue({});

      const result = await svc.sendMessage(conversationId, adminId, 'text', 'Hi');
      expect(result).toBeDefined();
      expect(mockMessageCreate).toHaveBeenCalled();
    });

    it('bypasses guard when recipient is admin', async () => {
      setupConversation();
      setupUserLookup('client', 'admin');
      mockFollowFindOne.mockReturnValue(ok(null)); // no follows

      const msg = { _id: id(), conversationId, senderId: new Types.ObjectId(senderId), text: 'Hi', contentType: 'text', createdAt: new Date() };
      mockMessageCreate.mockResolvedValue(msg);
      mockMessageFindById.mockReturnValue(ok(msg));
      mockConversationUpdateOne.mockResolvedValue({});

      const result = await svc.sendMessage(conversationId, senderId, 'text', 'Hi');
      expect(result).toBeDefined();
    });
  });
});
