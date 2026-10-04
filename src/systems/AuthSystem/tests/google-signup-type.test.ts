import { GOOGLE_SIGNUP_ALLOWED_TYPES, sanitizeGoogleSignupType } from '@utils/google-signup-type';

describe('sanitizeGoogleSignupType', () => {
  it('exposes only self-service signup roles', () => {
    expect(GOOGLE_SIGNUP_ALLOWED_TYPES).toEqual(['user', 'agent']);
  });

  it.each(['user', 'agent'])('keeps the allowed role %s', type => {
    expect(sanitizeGoogleSignupType(type)).toBe(type);
  });

  it.each(['admin', 'lounge', 'client', 'superAdmin', 'Admin'])('falls back to user for the privileged role %s', type => {
    expect(sanitizeGoogleSignupType(type)).toBe('user');
  });

  it('falls back to user for missing or empty values', () => {
    expect(sanitizeGoogleSignupType(undefined)).toBe('user');
    expect(sanitizeGoogleSignupType(null)).toBe('user');
    expect(sanitizeGoogleSignupType('')).toBe('user');
    expect(sanitizeGoogleSignupType('   ')).toBe('user');
  });

  it('falls back to user for non-string input', () => {
    expect(sanitizeGoogleSignupType(42)).toBe('user');
    expect(sanitizeGoogleSignupType({ toString: () => 'admin' })).toBe('user');
    expect(sanitizeGoogleSignupType(['admin'])).toBe('user');
    expect(sanitizeGoogleSignupType(['agent'])).toBe('agent');
  });

  it('normalizes case and surrounding whitespace for allowed roles', () => {
    expect(sanitizeGoogleSignupType(' Agent ')).toBe('agent');
    expect(sanitizeGoogleSignupType('USER')).toBe('user');
  });
});
