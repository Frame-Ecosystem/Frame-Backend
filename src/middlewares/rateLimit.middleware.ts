import rateLimit, { Options, ipKeyGenerator } from 'express-rate-limit';
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
  LIKE_RATE_LIMIT_WINDOW_MS,
  LIKE_RATE_LIMIT_MAX,
  RATING_RATE_LIMIT_WINDOW_MS,
  RATING_RATE_LIMIT_MAX,
  FOLLOW_RATE_LIMIT_WINDOW_MS,
  FOLLOW_RATE_LIMIT_MAX,
  CONTENT_CREATE_RATE_LIMIT_WINDOW_MS,
  CONTENT_CREATE_RATE_LIMIT_MAX,
  COMMENT_RATE_LIMIT_WINDOW_MS,
  COMMENT_RATE_LIMIT_MAX,
  REPORT_RATE_LIMIT_WINDOW_MS,
  REPORT_RATE_LIMIT_MAX,
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS,
  FORGOT_PASSWORD_RATE_LIMIT_MAX,
  FEED_READ_RATE_LIMIT_WINDOW_MS,
  FEED_READ_RATE_LIMIT_MAX,
  FEED_DISCOVERY_RATE_LIMIT_WINDOW_MS,
  FEED_DISCOVERY_RATE_LIMIT_MAX,
  SEARCH_RATE_LIMIT_WINDOW_MS,
  SEARCH_RATE_LIMIT_MAX,
} from '@config/constants';

/**
 * Key generator that identifies requests by authenticated user ID when available,
 * falling back to IP for unauthenticated requests.
 * This prevents shared-carrier / shared-WiFi IP starvation on social feed endpoints.
 */
const userOrIpKey = (req: Request): string => {
  const user = (req as any).user;
  const ip = ipKeyGenerator(req);
  return user?._id?.toString() || ip || req.socket?.remoteAddress || 'anonymous';
};

/* ───────── Factory ───────── */

function createLimiter(name: string, windowMs: number, max: number, message: string, extra?: Partial<Options>) {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit exceeded for ${name}`, {
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
    },
    ...extra,
  });
}

/* ───────── Exported limiters ───────── */

/** 5 attempts / 15 min — brute-force prevention */
export const loginRateLimiter = createLimiter(
  'login',
  LOGIN_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX,
  'Too many login attempts. Please try again after 15 minutes.',
  { skipSuccessfulRequests: false },
);

/** 3 signups / hour — spam prevention */
export const signupRateLimiter = createLimiter(
  'signup',
  SIGNUP_RATE_LIMIT_WINDOW_MS,
  SIGNUP_RATE_LIMIT_MAX,
  'Too many accounts created. Please try again after an hour.',
);

/** 30 refreshes / 15 min */
export const refreshTokenRateLimiter = createLimiter(
  'refresh-token',
  REFRESH_RATE_LIMIT_WINDOW_MS,
  REFRESH_RATE_LIMIT_MAX,
  'Too many token refresh requests. Please try again later.',
);

/** 100 requests / 15 min — general endpoints */
export const generalRateLimiter = createLimiter(
  'general',
  GENERAL_RATE_LIMIT_WINDOW_MS,
  GENERAL_RATE_LIMIT_MAX,
  'Too many requests. Please slow down.',
);

/** 3 attempts / hour — sensitive operations */
export const strictRateLimiter = createLimiter(
  'strict',
  STRICT_RATE_LIMIT_WINDOW_MS,
  STRICT_RATE_LIMIT_MAX,
  'Too many attempts. Please try again after an hour.',
);

/** 30 toggles / 15 min — like spam prevention */
export const likeRateLimiter = createLimiter('like', LIKE_RATE_LIMIT_WINDOW_MS, LIKE_RATE_LIMIT_MAX, 'Too many like requests. Please slow down.');

/** 30 rating writes / 15 min — rating spam prevention */
export const ratingRateLimiter = createLimiter('rating', RATING_RATE_LIMIT_WINDOW_MS, RATING_RATE_LIMIT_MAX, 'Too many rating requests. Please slow down.');

/** 30 follow/unfollow / 15 min — follow spam prevention */
export const followRateLimiter = createLimiter(
  'follow',
  FOLLOW_RATE_LIMIT_WINDOW_MS,
  FOLLOW_RATE_LIMIT_MAX,
  'Too many follow requests. Please slow down.',
);

/** 20 posts or reels / hour — content spam prevention */
export const contentCreateRateLimiter = createLimiter(
  'content-create',
  CONTENT_CREATE_RATE_LIMIT_WINDOW_MS,
  CONTENT_CREATE_RATE_LIMIT_MAX,
  'Too many posts created. Please slow down.',
);

/** 30 comments / 15 min — comment spam prevention */
export const commentRateLimiter = createLimiter(
  'comment',
  COMMENT_RATE_LIMIT_WINDOW_MS,
  COMMENT_RATE_LIMIT_MAX,
  'Too many comments. Please slow down.',
);

/** 10 reports / hour — report spam prevention */
export const reportRateLimiter = createLimiter('report', REPORT_RATE_LIMIT_WINDOW_MS, REPORT_RATE_LIMIT_MAX, 'Too many reports. Please slow down.');

/** 3 requests / 15 min — forgot password abuse prevention */
export const forgotPasswordRateLimiter = createLimiter(
  'forgot-password',
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS,
  FORGOT_PASSWORD_RATE_LIMIT_MAX,
  'Too many password reset requests. Please try again later.',
);

/**
 * Core scroll feeds (GET /feed, GET /feed/explore)
 * 600 requests / 15 min ≈ 40 req/min per user.
 * Keyed by authenticated user ID to prevent shared-IP starvation on mobile networks.
 */
export const feedReadLimiter = createLimiter(
  'feed-read',
  FEED_READ_RATE_LIMIT_WINDOW_MS,
  FEED_READ_RATE_LIMIT_MAX,
  'Too many feed requests. Please slow down.',
  { keyGenerator: userOrIpKey },
);

/**
 * Discovery feeds (GET /feed/hashtag/:tag, GET /feed/hashtags/trending,
 *                  GET /feed/hashtags/search, GET /feed/saved)
 * 300 requests / 15 min ≈ 20 req/min per user.
 * Keyed by authenticated user ID.
 */
export const feedDiscoveryLimiter = createLimiter(
  'feed-discovery',
  FEED_DISCOVERY_RATE_LIMIT_WINDOW_MS,
  FEED_DISCOVERY_RATE_LIMIT_MAX,
  'Too many discovery requests. Please slow down.',
  { keyGenerator: userOrIpKey },
);

/**
 * UltraSearch — 60 requests / 15 min ≈ 4 req/min per user.
 * Keyed by authenticated user ID. Search is intentionally kept lower
 * than feed limits because the query fans out across 8+ collections.
 */
export const searchRateLimiter = createLimiter(
  'search',
  SEARCH_RATE_LIMIT_WINDOW_MS,
  SEARCH_RATE_LIMIT_MAX,
  'Too many search requests. Please slow down.',
  { keyGenerator: userOrIpKey },
);
