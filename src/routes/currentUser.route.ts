import { Router } from 'express';
import CurrentUserController from '@controllers/currentUser.controller';
import { UpdateUserDto, LocationDto, DeleteAccountDto, UpdateClientProfileDto, UpdateThemeDto, ChangePasswordDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import authMiddleware from '@middlewares/auth.middleware';
import { strictRateLimiter } from '@middlewares/rate-limit.middleware';
import upload from '@middlewares/image-upload.middleware';

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
      strictRateLimiter,
      validationMiddleware(ChangePasswordDto, 'body'),
      this.currentUserController.changePassword,
    );
    // GET - Get current user profile
    this.router.get('/', authMiddleware, this.currentUserController.getMe);

    // PUT - Update current user profile
    this.router.put('/', authMiddleware, validationMiddleware(UpdateUserDto, 'body', true), this.currentUserController.updateMe);

    // PUT - Update current user location
    this.router.put('/location', authMiddleware, validationMiddleware(LocationDto, 'body'), this.currentUserController.updateLocation);
    // PUT - Upload profile image
    this.router.put('/image', authMiddleware, upload.single('image'), this.currentUserController.uploadProfileImage);

    // PUT - Upload cover image
    this.router.put('/cover-image', authMiddleware, upload.single('coverImage'), this.currentUserController.uploadCoverImage);

    // PUT - Update client profile (client users only)
    this.router.put(
      '/client',
      authMiddleware,
      validationMiddleware(UpdateClientProfileDto, 'body', true),
      this.currentUserController.updateClientProfile,
    );

    // DELETE - Delete current user account
    this.router.delete('/', authMiddleware, validationMiddleware(DeleteAccountDto, 'body'), this.currentUserController.deleteMe);
    // PUT - Update current user theme
    this.router.put('/theme', authMiddleware, validationMiddleware(UpdateThemeDto, 'body'), this.currentUserController.updateTheme);
    // POST - Send email verification code
    this.router.post('/send-verification-code', this.currentUserController.sendVerificationCode);
    // POST - Verify email code
    this.router.post('/verify-email', this.currentUserController.verifyEmailCode);
  }
}

export default CurrentUserRoute;
