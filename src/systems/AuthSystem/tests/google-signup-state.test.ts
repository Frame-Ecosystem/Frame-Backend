import request from 'supertest';
import passport from 'passport';
import App from '@/app';
import AuthRoute from '@systems/AuthSystem/routes/auth.route';

/**
 * Regression guard for the reported bug: choosing "lounge" or "client" before
 * starting Google signup still produced an account with the type "user".
 *
 * The requested role travels through the OAuth `state` parameter, so these
 * tests assert on the exact state handed to passport, which is what the
 * callback later uses to create the account.
 */
describe('Google signup role propagation', () => {
  let capturedState: string | undefined;
  let spy: jest.SpyInstance;

  beforeEach(() => {
    capturedState = undefined;
    spy = jest.spyOn(passport, 'authenticate').mockImplementation(((_strategy: any, options: any) => {
      capturedState = options?.state;
      return (_req: any, res: any) => res.status(302).send();
    }) as any);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  const startSignup = async (query: string) => {
    const authRoute = new AuthRoute();
    const app = new App([authRoute]);
    await request(app.getServer()).get(`${authRoute.path}/google/signup${query}`);
    return capturedState;
  };

  it.each(['client', 'lounge'])('carries the chosen %s role into the OAuth state', async type => {
    expect(await startSignup(`?type=${type}`)).toBe(`signup:${type}`);
  });

  it('never lets a self-service signup request the admin role', async () => {
    expect(await startSignup('?type=admin')).toBe('signup:client');
  });

  it('never carries the removed user role', async () => {
    expect(await startSignup('?type=user')).toBe('signup:client');
  });

  it('falls back to client when no type is supplied', async () => {
    expect(await startSignup('')).toBe('signup:client');
  });

  it('normalizes casing from the query string', async () => {
    expect(await startSignup('?type=LOUNGE')).toBe('signup:lounge');
  });
});
