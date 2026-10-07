import { canJoinQueueRoom, SocketUser } from '../services/socket-room-access';

describe('canJoinQueueRoom', () => {
  const agentInLounge = jest.fn<Promise<boolean>, [string, string]>();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows an agent to join only their own agent queue', async () => {
    const agent: SocketUser = { _id: 'agent1', type: 'agent' };

    await expect(canJoinQueueRoom(agent, 'queue:agent:agent1', agentInLounge)).resolves.toBe(true);
    await expect(canJoinQueueRoom(agent, 'queue:agent:agent2', agentInLounge)).resolves.toBe(false);
  });

  it('allows a lounge to join its lounge queue and its assigned agents queues only', async () => {
    const lounge: SocketUser = { _id: 'lounge1', type: 'lounge' };
    agentInLounge.mockImplementation(async (agentId, loungeId) => agentId === 'agent1' && loungeId === 'lounge1');

    await expect(canJoinQueueRoom(lounge, 'queue:lounge:lounge1', agentInLounge)).resolves.toBe(true);
    await expect(canJoinQueueRoom(lounge, 'queue:lounge:lounge2', agentInLounge)).resolves.toBe(false);
    await expect(canJoinQueueRoom(lounge, 'queue:agent:agent1', agentInLounge)).resolves.toBe(true);
    await expect(canJoinQueueRoom(lounge, 'queue:agent:agent2', agentInLounge)).resolves.toBe(false);
  });

  it('denies unauthenticated, malformed, and unsupported queue rooms', async () => {
    await expect(canJoinQueueRoom(null, 'queue:agent:agent1', agentInLounge)).resolves.toBe(false);
    await expect(canJoinQueueRoom({ _id: 'user1', type: 'client' }, 'queue:agent:', agentInLounge)).resolves.toBe(false);
    await expect(canJoinQueueRoom({ _id: 'agent1', type: 'agent' }, 'queue:unknown:agent1', agentInLounge)).resolves.toBe(false);
  });

  it('preserves existing queue read access for clients and admins', async () => {
    for (const type of ['client', 'admin']) {
      const user: SocketUser = { _id: `${type}1`, type };
      await expect(canJoinQueueRoom(user, 'queue:agent:agent1', agentInLounge)).resolves.toBe(true);
      await expect(canJoinQueueRoom(user, 'queue:lounge:lounge1', agentInLounge)).resolves.toBe(true);
    }
  });
});
