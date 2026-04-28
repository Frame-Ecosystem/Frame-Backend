import { Router } from 'express';
import CurrentUserController from '@systems/UserManager/controllers/currentUser.controller';
import { UpdateUserDto, LocationDto, DeleteAccountDto, UpdateClientProfileDto, UpdateThemeDto, UpdateLanguageDto, ChangePasswordDto } from '@systems/UserManager/dtos/user.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import { strictRateLimiter } from '@middlewares/rateLimit.middleware';
import upload from '@middlewares/imageUpload.middleware';

class CurrentUserRoute implements Routes {
  public path = '/v1/me';
  public router = Router();
  public currentUserController = new CurrentUserController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      '/change-password',
      authMiddleware,
      csrfMiddleware,
      strictRateLimiter,
      validationMiddleware(ChangePasswordDto, 'body'),
      this.currentUserController.changePassword,
    );
    // GET - Get current user profile
    this.router.get('/', authMiddleware, this.currentUserController.getMe);

    // PUT - Update current user profile
    this.router.put('/', authMiddleware, csrfMiddleware, validationMiddleware(UpdateUserDto, 'body', true), this.currentUserController.updateMe);

    // PUT - Update current user location
    this.router.put('/location', authMiddleware, csrfMiddleware, validationMiddleware(LocationDto, 'body'), this.currentUserController.updateLocation);
    // PUT - Upload profile image
    this.router.put('/image', authMiddleware, csrfMiddleware, upload.single('image'), this.currentUserController.uploadProfileImage);

    // PUT - Upload cover image
    this.router.put('/cover-image', authMiddleware, csrfMiddleware, upload.single('coverImage'), this.currentUserController.uploadCoverImage);

    // PUT - Update client profile (client users only)
    this.router.put(
      '/client',
      authMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateClientProfileDto, 'body', true),
      this.currentUserController.updateClientProfile,
    );

    // DELETE - Delete current user's reel by ID
    this.router.delete('/reels/:reelId', authMiddleware, csrfMiddleware, this.currentUserController.deleteMyReel);

    // DELETE - Delete current user account
    this.router.delete('/', authMiddleware, csrfMiddleware, validationMiddleware(DeleteAccountDto, 'body'), this.currentUserController.deleteMe);
    // PUT - Update current user theme
    this.router.put('/theme', authMiddleware, csrfMiddleware, validationMiddleware(UpdateThemeDto, 'body'), this.currentUserController.updateTheme);
    // PUT - Update current user language preference
    this.router.put('/language', authMiddleware, csrfMiddleware, validationMiddleware(UpdateLanguageDto, 'body'), this.currentUserController.updateLanguage);
    // POST - Send email verification code
    this.router.post('/send-verification-code', authMiddleware, csrfMiddleware, strictRateLimiter, this.currentUserController.sendVerificationCode);
    // POST - Verify email code
    this.router.post('/verify-email', authMiddleware, csrfMiddleware, strictRateLimiter, this.currentUserController.verifyEmailCode);
  }
}

export default CurrentUserRoute;
