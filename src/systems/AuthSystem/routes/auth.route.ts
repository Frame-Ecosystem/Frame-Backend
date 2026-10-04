import { Router } from 'express';
import AuthController from '@systems/AuthSystem/controllers/auth.controller';
import { CreateUserDto } from '@systems/UserManager/dtos/user.dto';
import { LoginUserDto, ForgotPasswordDto, ResetPasswordDto, SwitchSessionDto, SendVerificationEmailDto } from '@systems/AuthSystem/dtos/auth.dto';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import {
  loginRateLimiter,
  signupRateLimiter,
  forgotPasswordRateLimiter,
  generalRateLimiter,
  refreshTokenRateLimiter,
  strictRateLimiter,
} from '@middlewares/rateLimit.middleware';
import passport from 'passport';
import { FRONTEND_BASE_URL } from '@config';
import { sanitizeGoogleSignupType } from '@utils/google-signup-type';
import { logger } from '@utils/logger';

/**
 * Google OAuth failure codes surfaced to the frontend callback page.
 *
 * Only codes from this allowlist ever reach the redirect URL, so nothing from
 * the provider error object is reflected verbatim. Unknown failures collapse to
 * `oauth_failed`; the frontend falls back to a generic message for codes it
 * does not recognise (see app/auth/google/callback/page.tsx).
 */
const OAUTH_ERROR_CODE_MAP: Record<string, string> = {
  access_denied: 'access_denied',
  invalid_client: 'oauth_config_error',
  invalid_grant: 'oauth_grant_invalid',
  redirect_uri_mismatch: 'oauth_redirect_mismatch',
};

/** OAuth error codes reported by passport / node-oauth (on the error or its wrapped cause). */
function readOAuthErrorCodes(err: unknown): string[] {
  const candidate = err as { code?: string; oauthError?: { code?: string } } | undefined;
  return [candidate?.code, candidate?.oauthError?.code].filter((code): code is string => typeof code === 'string' && code.length > 0);
}

/** Map a passport/OAuth failure onto a frontend-safe error code. */
function resolveOAuthErrorCode(err: unknown): string {
  for (const code of readOAuthErrorCodes(err)) {
    const mapped = OAUTH_ERROR_CODE_MAP[code];
    if (mapped) return mapped;
  }
  return 'oauth_failed';
}

class AuthRoute implements Routes {
  public path = '/v1/auth';
  public router = Router();
  public authController = new AuthController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Auth endpoints with rate limiting
    this.router.post('/signup', signupRateLimiter, validationMiddleware(CreateUserDto, 'body'), this.authController.signUp);
    this.router.post(
      '/resend-verification',
      signupRateLimiter,
      validationMiddleware(SendVerificationEmailDto, 'body'),
      this.authController.resendVerification,
    );
    this.router.get('/csrf-token', generalRateLimiter, this.authController.getCsrfToken);
    this.router.get('/verify', generalRateLimiter, this.authController.verifyMagicLink);
    this.router.post('/login', loginRateLimiter, validationMiddleware(LoginUserDto, 'body'), this.authController.logIn);
    this.router.post('/logout', authMiddleware, csrfMiddleware, this.authController.logOut);
    this.router.post('/logout-all', authMiddleware, csrfMiddleware, this.authController.logOutAllDevices);
    // Refresh token endpoint (no CSRF needed - refresh token cookie provides security)
    this.router.post('/refresh-token', refreshTokenRateLimiter, this.authController.refreshToken);
    // Session switching endpoints (deterministic multi-account support)
    this.router.get('/sessions', authMiddleware, generalRateLimiter, this.authController.listSessions);
    this.router.post(
      '/switch-session',
      authMiddleware,
      csrfMiddleware,
      strictRateLimiter,
      validationMiddleware(SwitchSessionDto, 'body'),
      this.authController.switchSession,
    );
    this.router.post('/switch-session/verify', authMiddleware, generalRateLimiter, this.authController.verifySwitchSession);
    this.router.post(
      '/forgot-password',
      forgotPasswordRateLimiter,
      validationMiddleware(ForgotPasswordDto, 'body'),
      this.authController.forgotPassword,
    );
    this.router.post('/reset-password', validationMiddleware(ResetPasswordDto, 'body'), this.authController.resetPassword);

    // Google OAuth endpoints
    this.router.get('/google/login', (req, res, next) => {
      passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'consent', state: 'login' })(req, res, next);
    });
    this.router.get('/google/signup', (req, res, next) => {
      // `?type=` is client-controlled: allow only self-service signup roles.
      const type = sanitizeGoogleSignupType(req.query.type);
      passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'consent', state: `signup:${type}` })(req, res, next);
    });
    // Google OAuth callback with custom handler to capture specific error messages
    this.router.get('/google/callback', (req, res, next) => {
      passport.authenticate('google', { session: false }, (err, user, info) => {
        if (err) {
          const oauthError = readOAuthErrorCodes(err);
          logger.error(
            `Google OAuth error: ${(err as Error)?.message || 'unknown error'}` + (oauthError.length ? ` (code=${oauthError.join(',')})` : ''),
          );
          return res.redirect(`${FRONTEND_BASE_URL}/auth/google/callback?status=error&error=${resolveOAuthErrorCode(err)}`);
        }
        if (!user) {
          const errorCode = info?.message || 'oauth_failed';
          return res.redirect(`${FRONTEND_BASE_URL}/auth/google/callback?status=error&error=${encodeURIComponent(errorCode)}`);
        }
        req.user = user;
        this.authController.googleAuthCallback(req, res, next);
      })(req, res, next);
    });
  }
}

export default AuthRoute;
