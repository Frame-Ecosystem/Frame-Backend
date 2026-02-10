// Centralized application constants

export const REQUEST_BODY_LIMIT = '10mb'; // Increased to support base64 image uploads
export const ACCESS_TOKEN_EXPIRES_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const REFRESH_TOKEN_EXPIRES_STRING = '7d';
export const MAX_SESSIONS_PER_USER = 5;
export const BCRYPT_ROUNDS = 10;
export const RETRY_BACKOFF_BASE_MS = 100;
export const RETRY_MAX_ATTEMPTS = 3;

// Rate limit windows and max attempts
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_RATE_LIMIT_MAX = 5;
export const SIGNUP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const SIGNUP_RATE_LIMIT_MAX = 3;
export const REFRESH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_RATE_LIMIT_MAX = 30;
export const GENERAL_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const GENERAL_RATE_LIMIT_MAX = 100;
export const STRICT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const STRICT_RATE_LIMIT_MAX = 3;
