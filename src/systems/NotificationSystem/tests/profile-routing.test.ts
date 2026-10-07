const mockNotificationCreate = jest.fn();
const mockNotificationFind = jest.fn();
const mockNotificationCountDocuments = jest.fn();
const mockEmitNotification = jest.fn();
const mockSendToUser = jest.fn().mockResolvedValue(undefined);
const mockUserFind = jest.fn();

jest.mock('@systems/NotificationSystem/models/notification.model', () => ({
  __esModule: true,
  default: {
    create: mockNotificationCreate,
    find: mockNotificationFind,
    countDocuments: mockNotificationCountDocuments,
  },
}));

jest.mock('@systems/UserManager/models/user.model', () => ({
  __esModule: true,
  default: { find: mockUserFind },
}));

jest.mock('@systems/NotificationSystem/services/socket.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      emitNotification: mockEmitNotification,
    }),
  },
}));

jest.mock('@systems/NotificationSystem/services/push.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({ sendToUser: mockSendToUser }),
  },
}));

jest.mock('@utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import NotificationService from '@systems/NotificationSystem/services/notification.service';

const service = NotificationService.getInstance();

describe('profile notification destinations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationCreate.mockResolvedValue({ _id: 'notification1' });
    mockNotificationCountDocuments.mockResolvedValue(0);
  });

  const cases = [
    {
      name: 'new follower',
      notify: () => service.notifyNewFollower('recipient', 'actor', 'client', 'Actor'),
      expectedType: 'client',
      expectedPath: '/clients/actor',
    },
    {
      name: 'lounge like',
      notify: () => service.notifyLoungeLiked('recipient', 'actor', 'agent', 'Actor'),
      expectedType: 'agent',
      expectedPath: '/agents/actor',
    },
    {
      name: 'agent like',
      notify: () => service.notifyAgentLiked('recipient', 'actor', 'lounge', 'Actor'),
      expectedType: 'lounge',
      expectedPath: '/lounges/actor',
    },
    {
      name: 'lounge rating',
      notify: () => service.notifyLoungeRated('recipient', 'actor', 'client', 'Actor', 5),
      expectedType: 'client',
      expectedPath: '/clients/actor',
    },
    {
      name: 'agent rating',
      notify: () => service.notifyAgentRated('recipient', 'actor', 'agent', 'Actor', 5),
      expectedType: 'agent',
      expectedPath: '/agents/actor',
    },
  ];

  it.each(cases)('$name includes a direct profile route and actor type', async ({ notify, expectedType, expectedPath }) => {
    await notify();

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionUrl: expectedPath,
        metadata: expect.objectContaining({
          actorId: 'actor',
          actorType: expectedType,
        }),
      }),
    );
    expect(mockSendToUser).toHaveBeenCalledWith(
      'recipient',
      expect.objectContaining({
        data: expect.objectContaining({
          actionUrl: expectedPath,
          actorId: 'actor',
          actorType: expectedType,
        }),
      }),
    );
  });

  it('enriches legacy social notifications in one actor lookup', async () => {
    const oldNotifications = [
      {
        userId: 'recipient',
        actorId: 'actor-client',
        type: 'social:newFollower',
        metadata: { followerId: 'actor-client' },
        actionUrl: '/profile/actor-client',
      },
      {
        userId: 'recipient',
        actorId: 'actor-lounge',
        type: 'social:loungeLiked',
        metadata: { actorId: 'actor-lounge', loungeId: 'target-lounge' },
        actionUrl: '/profile/actor-lounge',
      },
      {
        userId: 'recipient',
        actorId: 'actor-agent',
        type: 'social:agentRated',
        metadata: { actorId: 'actor-agent', agentId: 'target-agent' },
        actionUrl: '/profile/actor-agent',
      },
    ];
    mockNotificationFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(oldNotifications),
    });
    mockUserFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        { _id: 'actor-client', type: 'client' },
        { _id: 'actor-lounge', type: 'lounge' },
        { _id: 'actor-agent', type: 'agent' },
      ]),
    });

    const result = await service.getNotifications('recipient');

    expect(mockUserFind).toHaveBeenCalledTimes(1);
    expect(mockUserFind).toHaveBeenCalledWith({
      _id: { $in: ['actor-client', 'actor-lounge', 'actor-agent'] },
    });
    expect(result.notifications.map(notification => notification.actionUrl)).toEqual([
      '/clients/actor-client',
      '/lounges/actor-lounge',
      '/agents/actor-agent',
    ]);
    expect(result.notifications.map(notification => notification.metadata.actorType)).toEqual(['client', 'lounge', 'agent']);
  });

  it('includes related reel and comment identifiers in push notification data', async () => {
    await service.notifyContentCommented('recipient', 'actor', 'Actor', 'reel', 'reel1', 'comment1', 'Nice video');

    expect(mockSendToUser).toHaveBeenCalledWith(
      'recipient',
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'content:reelCommented',
          reelId: 'reel1',
          commentId: 'comment1',
          targetType: 'reel',
        }),
      }),
    );
  });
});
