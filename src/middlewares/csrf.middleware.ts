import { NextFunction, Request, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import { v4 as uuidv4 } from 'uuid';
import { NODE_ENV } from '@config';

/**
 * CSRF Protection Middleware using Double-Submit Cookie Pattern
 *
 * How it works:
 * 1. Server sets a CSRF token in a non-HttpOnly cookie (readable by JS)
 * 2. Client reads the cookie and sends the token in X-CSRF-Token header
 * 3. Server compares cookie value with header value
 * 4. If they match, request is legitimate (attacker can't read cross-site cookies)
 *
 * Note: In development mode, you can bypass CSRF by sending "dev-bypass" as the token
 * This is ONLY for Swagger UI testing - the cookie is still required in production
 *
 * Exceptions: Token refresh endpoints don't need CSRF protection since the
 * refresh token cookie itself provides sufficient security.
 */

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const DEV_BYPASS_TOKEN = 'dev-bypass'; // Only works in development mode

/**
 * Generate and set CSRF token cookie
 * Call this on login or when session starts
 */
export const setCsrfToken = (res: Response): string => {
  const csrfToken = uuidv4();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    secure: NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });
  return csrfToken;
};

/**
 * Clear CSRF token cookie (call on logout)
 */
export const clearCsrfToken = (res: Response): void => {
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
};

/**
 * CSRF Protection Middleware
 * Apply to state-changing routes (POST, PUT, DELETE, PATCH)
 */
const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF check for mobile clients (they use different auth patterns)
  const clientType = req.headers['x-client-type'];
  if (clientType === 'mobile') {
    return next();
  }

  // Skip CSRF check for authenticated requests (JWT provides sufficient protection)
  const authHeader = req.headers.authorization;
  const hasBearerToken = authHeader && authHeader.startsWith('Bearer ');
  const isAuthenticated = (req as any).user !== undefined;

  if (hasBearerToken || isAuthenticated) {
    return next();
  }

  // Get CSRF token from cookie and header
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER_NAME);

  // Development bypass for Swagger UI testing
  // In development, allow "dev-bypass" as a special token to skip CSRF
  if (NODE_ENV === 'development' && headerToken === DEV_BYPASS_TOKEN) {
    return next();
  }

  // Both must exist and match
  if (!cookieToken || !headerToken) {
    return next(new HttpException(403, 'CSRF token missing'));
  }

  if (cookieToken !== headerToken) {
    return next(new HttpException(403, 'CSRF token mismatch'));
  }

  return next();
};

export default csrfMiddleware;
