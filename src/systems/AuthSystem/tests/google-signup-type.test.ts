import { GOOGLE_SIGNUP_ALLOWED_TYPES, sanitizeGoogleSignupType } from '@utils/google-signup-type';

describe('sanitizeGoogleSignupType', () => {
  it('exposes only self-service signup roles', () => {
    expect(GOOGLE_SIGNUP_ALLOWED_TYPES).toEqual(['client', 'lounge', 'agent']);
  });

  it.each(['client', 'lounge', 'agent'])('keeps the allowed role %s', type => {
    expect(sanitizeGoogleSignupType(type)).toBe(type);
  });

  it.each(['admin', 'superAdmin', 'Admin', 'user'])('falls back to client for the disallowed role %s', type => {
    expect(sanitizeGoogleSignupType(type)).toBe('client');
  });

  it('falls back to client for missing or empty values', () => {
    expect(sanitizeGoogleSignupType(undefined)).toBe('client');
    expect(sanitizeGoogleSignupType(null)).toBe('client');
    expect(sanitizeGoogleSignupType('')).toBe('client');
    expect(sanitizeGoogleSignupType('   ')).toBe('client');
  });

  it('falls back to client for non-string input', () => {
    expect(sanitizeGoogleSignupType(42)).toBe('client');
    expect(sanitizeGoogleSignupType({ toString: () => 'admin' })).toBe('client');
    expect(sanitizeGoogleSignupType(['admin'])).toBe('client');
    expect(sanitizeGoogleSignupType(['lounge'])).toBe('lounge');
  });

  it('normalizes case and surrounding whitespace for allowed roles', () => {
    expect(sanitizeGoogleSignupType(' Agent ')).toBe('agent');
    expect(sanitizeGoogleSignupType('LOUNGE')).toBe('lounge');
    expect(sanitizeGoogleSignupType(' Client ')).toBe('client');
  });
});
