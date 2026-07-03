// Centralized application constants
// All values can be overridden via environment variables

// ── Branding ──
export const SERVICE_NAME = 'frame-beauty-api';
export const SERVICE_BRAND = 'Frame Beauty';
export const SERVICE_DESCRIPTION = 'Enterprise API for the Frame Beauty salon & booking platform';
export const SERVICE_VERSION = process.env.npm_package_version || '1.1.7';

const envInt = (key: string, fallback: number): number => {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
};

export const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '10mb';
export const ACCESS_TOKEN_EXPIRES_SECONDS = envInt('ACCESS_TOKEN_EXPIRES_SECONDS', 15 * 60); // 15 minutes
export const REFRESH_TOKEN_EXPIRES_SECONDS = envInt('REFRESH_TOKEN_EXPIRES_SECONDS', 7 * 24 * 60 * 60); // 7 days
export const REFRESH_TOKEN_EXPIRES_STRING = process.env.REFRESH_TOKEN_EXPIRES_STRING || '7d';
export const MAX_SESSIONS_PER_USER = envInt('MAX_SESSIONS_PER_USER', 5);
export const BCRYPT_ROUNDS = envInt('BCRYPT_ROUNDS', 10);
export const RETRY_BACKOFF_BASE_MS = envInt('RETRY_BACKOFF_BASE_MS', 100);
export const RETRY_MAX_ATTEMPTS = envInt('RETRY_MAX_ATTEMPTS', 3);

// Account lockout
export const MAX_FAILED_LOGIN_ATTEMPTS = envInt('MAX_FAILED_LOGIN_ATTEMPTS', 5);
export const ACCOUNT_LOCKOUT_DURATION_MS = envInt('ACCOUNT_LOCKOUT_DURATION_MS', 15 * 60 * 1000); // 15 minutes

// Forgot-password rate limit
export const FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS = envInt('FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
export const FORGOT_PASSWORD_RATE_LIMIT_MAX = envInt('FORGOT_PASSWORD_RATE_LIMIT_MAX', 3);

// Rate limit windows and max attempts
export const LOGIN_RATE_LIMIT_WINDOW_MS = envInt('LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
export const LOGIN_RATE_LIMIT_MAX = envInt('LOGIN_RATE_LIMIT_MAX', 5);
export const SIGNUP_RATE_LIMIT_WINDOW_MS = envInt('SIGNUP_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000);
export const SIGNUP_RATE_LIMIT_MAX = envInt('SIGNUP_RATE_LIMIT_MAX', 3);
export const REFRESH_RATE_LIMIT_WINDOW_MS = envInt('REFRESH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
export const REFRESH_RATE_LIMIT_MAX = envInt('REFRESH_RATE_LIMIT_MAX', 10); // Lowered from 30 — 10 refresh attempts per 15min is generous
export const GENERAL_RATE_LIMIT_WINDOW_MS = envInt('GENERAL_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
export const GENERAL_RATE_LIMIT_MAX = envInt('GENERAL_RATE_LIMIT_MAX', 100);
export const STRICT_RATE_LIMIT_WINDOW_MS = envInt('STRICT_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000);
export const STRICT_RATE_LIMIT_MAX = envInt('STRICT_RATE_LIMIT_MAX', 3);
export const LIKE_RATE_LIMIT_WINDOW_MS = envInt('LIKE_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
export const LIKE_RATE_LIMIT_MAX = envInt('LIKE_RATE_LIMIT_MAX', 30);
export const FOLLOW_RATE_LIMIT_WINDOW_MS = envInt('FOLLOW_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
export const FOLLOW_RATE_LIMIT_MAX = envInt('FOLLOW_RATE_LIMIT_MAX', 30);
export const CONTENT_CREATE_RATE_LIMIT_WINDOW_MS = envInt('CONTENT_CREATE_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000);
export const CONTENT_CREATE_RATE_LIMIT_MAX = envInt('CONTENT_CREATE_RATE_LIMIT_MAX', 20);
export const COMMENT_RATE_LIMIT_WINDOW_MS = envInt('COMMENT_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
export const COMMENT_RATE_LIMIT_MAX = envInt('COMMENT_RATE_LIMIT_MAX', 30);
export const REPORT_RATE_LIMIT_WINDOW_MS = envInt('REPORT_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000);
export const REPORT_RATE_LIMIT_MAX = envInt('REPORT_RATE_LIMIT_MAX', 10);

// ── Feed-specific rate limits (high-traffic read paths) ──
// Keyed per authenticated user, not per IP, to prevent shared-carrier starvation.

/** Core scroll feeds (GET /feed, GET /feed/explore) — 600 req / 15 min ≈ 40/min */
export const FEED_READ_RATE_LIMIT_WINDOW_MS = envInt('FEED_READ_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
export const FEED_READ_RATE_LIMIT_MAX = envInt('FEED_READ_RATE_LIMIT_MAX', 600);

/** Discovery feeds (hashtag, trending, search, saved) — 300 req / 15 min ≈ 20/min */
export const FEED_DISCOVERY_RATE_LIMIT_WINDOW_MS = envInt('FEED_DISCOVERY_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
export const FEED_DISCOVERY_RATE_LIMIT_MAX = envInt('FEED_DISCOVERY_RATE_LIMIT_MAX', 300);

// ── Search rate limits ──
/** UltraSearch — 60 requests / 15 min ≈ 4/min per user (search is expensive) */
export const SEARCH_RATE_LIMIT_WINDOW_MS = envInt('SEARCH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
export const SEARCH_RATE_LIMIT_MAX = envInt('SEARCH_RATE_LIMIT_MAX', 60);
