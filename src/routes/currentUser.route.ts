import { Router } from 'express';
import CurrentUserController from '@controllers/currentUser.controller';
import { UpdateUserDto, LocationDto, DeleteAccountDto, UpdateLoungeProfileDto, UpdateClientProfileDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import upload from '@middlewares/image-upload.middleware';

class CurrentUserRoute implements Routes {
  public path = '/v1/me';
  public router = Router();
  public currentUserController = new CurrentUserController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Change password for current user (strict rate limit)
    const { strictRateLimiter } = require('./../middlewares/rate-limit.middleware');
    this.router.post(
      '/change-password',
      authMiddleware,
      strictRateLimiter,
      validationMiddleware(require('../dtos/users.dto').ChangePasswordDto, 'body'),
      this.currentUserController.changePassword,
    );
    // GET - Get current user profile
    this.router.get('/', authMiddleware, this.currentUserController.getMe);

    // PUT - Update current user profile
    this.router.put('/', authMiddleware, csrfMiddleware, validationMiddleware(UpdateUserDto, 'body', true), this.currentUserController.updateMe);

    // PUT - Update current user location
    this.router.put('/location', authMiddleware, validationMiddleware(LocationDto, 'body'), this.currentUserController.updateLocation);
    // PUT - Upload profile image
    this.router.put('/image', authMiddleware, upload.single('image'), this.currentUserController.uploadProfileImage);

    // PUT - Update lounge profile (lounge users only)
    this.router.put(
      '/lounge',
      authMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateLoungeProfileDto, 'body', true),
      this.currentUserController.updateLoungeProfile,
    );

    // PUT - Update client profile (client users only)
    this.router.put(
      '/client',
      authMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateClientProfileDto, 'body', true),
      this.currentUserController.updateClientProfile,
    );

    // DELETE - Delete current user account
    this.router.delete('/', authMiddleware, validationMiddleware(DeleteAccountDto, 'body'), this.currentUserController.deleteMe);
    // POST - Send email verification code
    this.router.post('/send-verification-code', this.currentUserController.sendVerificationCode);
    // POST - Verify email code
    this.router.post('/verify-email', this.currentUserController.verifyEmailCode);
  }
}

export default CurrentUserRoute;
