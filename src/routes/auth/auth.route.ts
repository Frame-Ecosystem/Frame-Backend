import { Router } from 'express';
import AuthController from '@controllers/auth/auth.controller';
import { CreateUserDto } from '@dtos/user/users.dto';
import { LoginUserDto, ForgotPasswordDto, ResetPasswordDto } from '@dtos/auth/auth.dto';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { loginRateLimiter, signupRateLimiter } from '@middlewares/rate-limit.middleware';
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
    this.router.get('/verify', this.authController.verifyMagicLink);
    this.router.post('/login', loginRateLimiter, validationMiddleware(LoginUserDto, 'body'), this.authController.logIn);
    this.router.post('/logout', authMiddleware, this.authController.logOut);
    this.router.post('/logout-all', authMiddleware, this.authController.logOutAllDevices);
    // Refresh token endpoint (no CSRF needed - refresh token cookie provides security)
    this.router.post('/refresh-token', this.authController.refreshToken);
    this.router.post('/forgot-password', validationMiddleware(ForgotPasswordDto, 'body'), this.authController.forgotPassword);
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
