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
import { logger } from '@utils/logger';

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
    this.router.post('/switch-session', authMiddleware, csrfMiddleware, strictRateLimiter, validationMiddleware(SwitchSessionDto, 'body'), this.authController.switchSession);
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
      const { type } = req.query;
      passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'consent', state: `signup:${type as string}` })(req, res, next);
    });
    // Google OAuth callback with custom handler to capture specific error messages
    this.router.get('/google/callback', (req, res, next) => {
      passport.authenticate('google', { session: false }, (err, user, info) => {
        if (err) {
          logger.error(`Google OAuth error: ${err.message}`);
          return res.redirect(`${FRONTEND_BASE_URL}/auth/google/callback?status=error&error=oauth_failed`);
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
