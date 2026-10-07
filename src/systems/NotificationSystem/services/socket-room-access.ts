export interface SocketUser {
  _id: string;
  type: string;
  parentLounge?: string;
}

export async function canJoinQueueRoom(
  user: SocketUser | null,
  room: string,
  isAgentInLounge: (agentId: string, loungeId: string) => Promise<boolean>,
): Promise<boolean> {
  if (!user) return false;

  const agentQueueMatch = /^queue:agent:([^:]+)$/.exec(room);
  if (agentQueueMatch) {
    const agentId = agentQueueMatch[1];
    if (user.type === 'admin' || user.type === 'client') return true;
    if (user.type === 'agent') return user._id === agentId;
    if (user.type === 'lounge') return isAgentInLounge(agentId, user._id);
    return false;
  }

  const loungeQueueMatch = /^queue:lounge:([^:]+)$/.exec(room);
  if (loungeQueueMatch) {
    const loungeId = loungeQueueMatch[1];
    if (user.type === 'admin' || user.type === 'client') return true;
    return user.type === 'lounge' && user._id === loungeId;
  }

  return false;
}
