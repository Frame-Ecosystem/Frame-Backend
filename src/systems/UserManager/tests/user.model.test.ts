/**
 * Regression tests for the user schema's `passwordStrength` field.
 *
 * Production failure this guards against:
 *   "User validation failed: passwordStrength: `null` is not a valid enum value
 *    for path `passwordStrength`"
 * which broke every Google OAuth login and signup. The field keeps
 * `default: null`, so the path is always defined and the enum must accept null —
 * passwordless (OAuth) accounts legitimately have no password to score.
 */

import userModel from '@systems/UserManager/models/user.model';

const googleOAuthPayload = {
  email: 'oauth.user@example.com',
  type: 'client',
  oauth: {
    google: {
      id: 'google-oauth-id-123',
      email: 'oauth.user@example.com',
      name: 'OAuth User',
      picture: 'https://example.com/avatar.png',
      verified: true,
    },
  },
  emailVerification: [{ isVerified: true }],
  sessionTrack: { isOnline: false, devices: [] },
};

describe('user model passwordStrength validation', () => {
  it('accepts a passwordless Google OAuth account (the default null value)', () => {
    const user = new userModel({ ...googleOAuthPayload });

    expect(user.passwordStrength).toBeNull();
    expect(user.validateSync()).toBeUndefined();
  });

  it('accepts an explicit null passwordStrength on an OAuth account', () => {
    const user = new userModel({ ...googleOAuthPayload, passwordStrength: null });

    expect(user.validateSync()).toBeUndefined();
  });

  it('accepts an OAuth account that later sets a password strength', () => {
    const user = new userModel({ ...googleOAuthPayload, passwordStrength: 'strong' });

    expect(user.validateSync()).toBeUndefined();
  });

  it('accepts a password user with each allowed strength', () => {
    (['weak', 'medium', 'strong'] as const).forEach(passwordStrength => {
      const user = new userModel({
        email: 'password.user@example.com',
        password: 'hashed-password',
        type: 'client',
        passwordStrength,
      });

      expect(user.validateSync()).toBeUndefined();
    });
  });

  it('still rejects values outside the allowed set', () => {
    const user = new userModel({ ...googleOAuthPayload, passwordStrength: 'super-strong' });

    expect(user.validateSync()?.errors).toHaveProperty('passwordStrength');
  });
});
