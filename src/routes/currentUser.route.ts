import { Router } from 'express';
import CurrentUserController from '@controllers/currentUser.controller';
import { UpdateUserDto, LocationDto, DeleteAccountDto } from '@dtos/users.dto';
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
    // GET - Get current user profile
    this.router.get('/', authMiddleware, this.currentUserController.getMe);

    // PUT - Update current user profile
    this.router.put('/', authMiddleware, csrfMiddleware, validationMiddleware(UpdateUserDto, 'body', true), this.currentUserController.updateMe);

    // PUT - Update current user location
    this.router.put(
      '/location',
      authMiddleware,
      csrfMiddleware,
      validationMiddleware(LocationDto, 'body'),
      this.currentUserController.updateLocation,
    );

    // PUT - Upload profile image
    this.router.put('/image', authMiddleware, csrfMiddleware, upload.single('image'), this.currentUserController.uploadProfileImage);

    // DELETE - Delete current user account
    this.router.delete('/', authMiddleware, csrfMiddleware, validationMiddleware(DeleteAccountDto, 'body'), this.currentUserController.deleteMe);
  }
}

export default CurrentUserRoute;
