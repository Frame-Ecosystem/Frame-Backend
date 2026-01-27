import { Router } from 'express';
import AuthController from '@controllers/auth.controller';
import { CreateUserDto, LoginUserDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { loginRateLimiter, signupRateLimiter } from '@middlewares/rate-limit.middleware';
import passport from 'passport';

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
    this.router.post('/login', loginRateLimiter, validationMiddleware(LoginUserDto, 'body'), this.authController.logIn);
    this.router.post('/logout', authMiddleware, this.authController.logOut);
    this.router.post('/logout-all', authMiddleware, this.authController.logOutAllDevices);
    // Refresh token endpoint (no CSRF needed - refresh token cookie provides security)
    this.router.post('/refresh-token', this.authController.refreshToken);

    // Google OAuth endpoints
    this.router.get('/google/login', (req, res, next) => {
      passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'consent', state: 'login' })(req, res, next);
    });
    this.router.get('/google/signup', (req, res, next) => {
      const { type } = req.query;
      passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'consent', state: `signup:${type as string}` })(req, res, next);
    });
    // Handle cases where users directly access callback without prior auth by including scope
    this.router.get(
      '/google/callback',
      passport.authenticate('google', {
        session: false,
        scope: ['profile', 'email'],
        failureRedirect: '/v1/auth/google/failure',
      }),
      this.authController.googleAuthCallback,
    );
    // Failure redirect endpoint
    this.router.get('/google/failure', (req, res) => {
      const origin = process.env.ORIGIN || 'http://localhost:3001';
      const failureRedirect = `${origin}/auth/google/callback?status=error&error=oauth_failed`;
      return res.redirect(failureRedirect);
    });
  }
}

export default AuthRoute;
