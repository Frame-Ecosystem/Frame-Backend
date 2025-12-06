import { Router } from 'express';
import UsersController from '@controllers/users.controller';
import { CreateUserDto, LocationDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import upload from '@middlewares/image-upload.middleware';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';

class UsersRoute implements Routes {
  public path = '/users';
  public router = Router();
  public usersController = new UsersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Mounted at `/users`, so define routes relative to that base
    // GET routes don't need CSRF protection (safe methods)
    this.router.get(`/`, authMiddleware, this.usersController.getUsers);
    this.router.get(`/:id`, authMiddleware, this.usersController.getUserById);
    this.router.get(`/:id/profile-image`, authMiddleware, this.usersController.getProfileImage);
    this.router.get(`/user/token`, authMiddleware, this.usersController.getUserByToken);

    // State-changing routes need both auth and CSRF protection
    this.router.post(`/`, authMiddleware, csrfMiddleware, validationMiddleware(CreateUserDto, 'body'), this.usersController.createUser);
    this.router.put(`/:id`, authMiddleware, csrfMiddleware, validationMiddleware(CreateUserDto, 'body', true), this.usersController.updateUser);
    this.router.delete(`/:id`, authMiddleware, csrfMiddleware, this.usersController.deleteUser);
    this.router.put(`/:id/location`, authMiddleware, csrfMiddleware, validationMiddleware(LocationDto, 'body'), this.usersController.updateUserLocation);
    this.router.post(`/:id/upload-profile-image`, authMiddleware, csrfMiddleware, upload.single('profileImage'), this.usersController.uploadProfileImage);
  }
}

export default UsersRoute;
