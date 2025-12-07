import { Router } from 'express';
import AuthController from '@controllers/auth.controller';
import { CreateUserDto, LoginUserDto, ChangePasswordDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import adminMiddleware from '@middlewares/admin.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import { loginRateLimiter, signupRateLimiter, refreshTokenRateLimiter, strictRateLimiter } from '@middlewares/rate-limit.middleware';

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
    this.router.post('/logout', authMiddleware, csrfMiddleware, this.authController.logOut);
    this.router.post('/logout-all', authMiddleware, csrfMiddleware, this.authController.logOutAllDevices);
    // Refresh token endpoint protected with CSRF (refresh token is in HttpOnly cookie)
    this.router.post('/refresh-token', refreshTokenRateLimiter, csrfMiddleware, this.authController.refreshToken);


    // Session tracking - admin only
    this.router.get('/session-track', authMiddleware, adminMiddleware, this.authController.getSessionTrack);
  }
}

export default AuthRoute;
