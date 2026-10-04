/**
 * Account types a self-service Google signup is allowed to create.
 *
 * The signup flow reads the requested type from the OAuth `state` query
 * parameter, which is fully client-controlled. Without an allowlist, anyone
 * could call `/v1/auth/google/signup?type=admin` with a fresh Google account
 * and have a privileged user created. `admin` is therefore never allowed here.
 */
export const GOOGLE_SIGNUP_ALLOWED_TYPES = ['client', 'lounge', 'agent'] as const;

export type GoogleSignupType = (typeof GOOGLE_SIGNUP_ALLOWED_TYPES)[number];

const DEFAULT_GOOGLE_SIGNUP_TYPE: GoogleSignupType = 'client';

/**
 * Coerce an untrusted value into an allowed signup type.
 *
 * Anything unexpected (privileged role, empty value, array, object) collapses
 * to `client`, which is the only safe default for self-service signup.
 */
export function sanitizeGoogleSignupType(value: unknown): GoogleSignupType {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw !== 'string') return DEFAULT_GOOGLE_SIGNUP_TYPE;

  const candidate = raw.trim().toLowerCase();
  return (GOOGLE_SIGNUP_ALLOWED_TYPES as readonly string[]).includes(candidate) ? (candidate as GoogleSignupType) : DEFAULT_GOOGLE_SIGNUP_TYPE;
}
