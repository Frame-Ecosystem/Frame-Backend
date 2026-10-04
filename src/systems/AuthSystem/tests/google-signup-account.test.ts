import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@systems/UserManager/models/user.model', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
  },
  isAdmin: (user: any) => user?.type === 'admin',
  isLounge: (user: any) => user?.type === 'lounge',
  isClient: (user: any) => user?.type === 'client',
  isAgent: (user: any) => user?.type === 'agent',
}));

import passport from 'passport';
import userModel from '@systems/UserManager/models/user.model';

// Importing the module registers the 'google' strategy on passport.
import '@config/passport';

const profile = {
  id: 'google-oauth-id-123',
  displayName: 'Frame Tester',
  photos: [{ value: 'https://example.com/photo.jpg' }],
  emails: [{ value: 'lounge.choose@frame.test', verified: true }],
};

/**
 * Drive the real passport Google verify callback and report the `type` that
 * would be persisted on the newly created account.
 */
async function typeCreatedForState(state: string): Promise<string | undefined> {
  const strategy: any = (passport as any)._strategy('google');
  const created: any[] = [];
  (userModel.create as any).mockImplementation(async (doc: any) => {
    created.push(doc);
    return doc;
  });

  await new Promise<void>((resolve, reject) => {
    strategy._verify({ query: { state } } as any, 'access-token', null, profile, (err: any) =>
      err ? reject(err) : resolve(),
    );
  });

  return created[0]?.type;
}

describe('Google signup account creation', () => {
  beforeEach(() => {
    // No existing account by google id, and none by email -> a brand new signup.
    (userModel.findOne as any).mockResolvedValue(null);
    (userModel.create as any).mockReset();
  });

  it.each(['client', 'lounge', 'agent'])('creates the account with type %s', async type => {
    expect(await typeCreatedForState(`signup:${type}`)).toBe(type);
  });

  it('never creates a self-service account with the admin role', async () => {
    expect(await typeCreatedForState('signup:admin')).toBe('client');
  });

  it('never creates an account with the removed user role', async () => {
    expect(await typeCreatedForState('signup:user')).toBe('client');
  });

  it('defaults to client when the state carries no type', async () => {
    expect(await typeCreatedForState('login')).toBeUndefined();
  });
});
