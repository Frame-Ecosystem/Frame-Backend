import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '@utils/logger';
import {
  LOGIN_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX,
  SIGNUP_RATE_LIMIT_WINDOW_MS,
  SIGNUP_RATE_LIMIT_MAX,
  REFRESH_RATE_LIMIT_WINDOW_MS,
  REFRESH_RATE_LIMIT_MAX,
  GENERAL_RATE_LIMIT_WINDOW_MS,
  GENERAL_RATE_LIMIT_MAX,
  STRICT_RATE_LIMIT_WINDOW_MS,
  STRICT_RATE_LIMIT_MAX,
} from '../config/constants';

/**
 * Rate Limiting Middleware Factory
 * Protects against brute-force attacks and API abuse
 */

// Generic error message handler
const createRateLimitHandler = (type: string) => (req: Request, res: Response) => {
  logger.warn(`Rate limit exceeded for ${type}`, {
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    path: req.path,
    method: req.method,
  });
  res.status(429).json({
    message: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: res.getHeader('Retry-After'),
  });
};

/**
 * Login Rate Limiter
 * Strict limits to prevent brute-force password attacks
 * 5 attempts per 15 minutes per IP + identifier
 */
export const loginRateLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: createRateLimitHandler('login'),
});

/**
 * Signup Rate Limiter
 * Moderate limits to prevent spam account creation
 * 3 signups per hour per IP
 */
export const signupRateLimiter = rateLimit({
  windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS,
  max: SIGNUP_RATE_LIMIT_MAX,
  message: 'Too many accounts created. Please try again after an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('signup'),
});

/**
 * Token Refresh Rate Limiter
 * Moderate limits - should be called less frequently
 * 30 refreshes per 15 minutes per IP
 */
export const refreshTokenRateLimiter = rateLimit({
  windowMs: REFRESH_RATE_LIMIT_WINDOW_MS,
  max: REFRESH_RATE_LIMIT_MAX,
  message: 'Too many token refresh requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('refresh-token'),
});

/**
 * General API Rate Limiter
 * For all other endpoints - more lenient
 * 100 requests per 15 minutes per IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: GENERAL_RATE_LIMIT_WINDOW_MS,
  max: GENERAL_RATE_LIMIT_MAX,
  message: 'Too many requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('general'),
});

/**
 * Strict Rate Limiter for sensitive operations
 * Password change, account deletion, etc.
 * 3 attempts per hour per IP
 */
export const strictRateLimiter = rateLimit({
  windowMs: STRICT_RATE_LIMIT_WINDOW_MS,
  max: STRICT_RATE_LIMIT_MAX,
  message: 'Too many attempts. Please try again after an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('strict'),
});
