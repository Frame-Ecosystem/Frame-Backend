import { NextFunction, Request, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import { v4 as uuidv4 } from 'uuid';
import { NODE_ENV } from '@config';

/**
 * CSRF Protection Middleware using Double-Submit Cookie Pattern
 *
 * How it works:
 * 1. Server sets a CSRF token in a non-HttpOnly cookie (readable by JS)
 * 2. Client sends the token via:
 *    - X-CSRF-Token header (recommended for JSON requests)
 *    - csrf-token form field (for multipart/form-data)
 * 3. Server compares cookie value with the provided token
 * 4. If they match, request is legitimate (attacker can't read cross-site cookies)
 *
 * Note: In development mode, you can bypass CSRF by sending "dev-bypass" as the token.
 * This is ONLY for Swagger UI testing - the cookie is still required in production.
 *
 * Exceptions: Token refresh endpoints don't need CSRF protection since the
 * refresh token cookie itself provides sufficient security.
 */

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_FORM_FIELD = 'csrf-token';
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
    sameSite: 'strict', // Stronger protection: strict > lax > none
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
 *
 * Token can be provided via:
 * - X-CSRF-Token header (JSON requests)
 * - csrf-token form field (multipart requests)
 */
const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for safe HTTP methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Get CSRF token from cookie - ALWAYS required
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  if (!cookieToken) {
    return next(new HttpException(403, 'CSRF token missing from cookie'));
  }

  // Get client-provided CSRF token from header OR form field
  // Header takes precedence for JSON requests, form field for multipart
  const headerToken = req.header(CSRF_HEADER_NAME);
  const formToken = req.body?.[CSRF_FORM_FIELD] || (req as any).file?.fieldname === CSRF_FORM_FIELD ? (req.body?.[CSRF_FORM_FIELD]) : null;
  const clientToken = headerToken || formToken;

  if (!clientToken) {
    return next(new HttpException(403, 'CSRF token missing. Send via X-CSRF-Token header or csrf-token form field'));
  }

  // Development bypass for Swagger UI testing
  if (NODE_ENV === 'development' && clientToken === DEV_BYPASS_TOKEN) {
    return next();
  }

  // Tokens must match
  if (cookieToken !== clientToken) {
    return next(new HttpException(403, 'CSRF token validation failed'));
  }

  return next();
};

export default csrfMiddleware;
