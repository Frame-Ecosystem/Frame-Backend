/**
 * Re-export the canonical Agent interface from user.interface so that legacy
 * imports keep compiling. As of the User-Backed Agent refactor, agents are
 * just `User` documents with `type === 'agent'` plus the agent-specific fields:
 *   - parentLounge: reference to the owning Lounge
 *   - services: lounge services this agent is qualified to perform
 *   - agentName: optional display name
 *   - acceptQueueBooking: live availability toggle
 *
 * The standalone Agent collection (and its model) has been retired.
 */
export { Agent } from '@systems/UserManager/interfaces/user.interface';
