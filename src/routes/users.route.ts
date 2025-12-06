import { Router } from 'express';
import UsersController from '@controllers/users.controller';
import { CreateUserDto, LocationDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import upload from '@middlewares/image-upload.middleware';
import authMiddleware from '@middlewares/auth.middleware';

class UsersRoute implements Routes {
  public path = '/users';
  public router = Router();
  public usersController = new UsersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, authMiddleware, this.usersController.getUsers);
    this.router.get(`${this.path}/:id`, authMiddleware, this.usersController.getUserById);
    this.router.post(`${this.path}`, validationMiddleware(CreateUserDto, 'body'), this.usersController.createUser);
    this.router.put(`${this.path}/:id`, authMiddleware, validationMiddleware(CreateUserDto, 'body', true), this.usersController.updateUser);
    this.router.delete(`${this.path}/:id`, authMiddleware, this.usersController.deleteUser);
    this.router.put(`${this.path}/:id/location`, authMiddleware, validationMiddleware(LocationDto, 'body'), this.usersController.updateUserLocation);
    this.router.get(`${this.path}/:id/profile-image`, authMiddleware, this.usersController.getProfileImage);
    this.router.post(`${this.path}/:id/upload-profile-image`, authMiddleware, upload.single('profileImage'), this.usersController.uploadProfileImage);
    this.router.get('/user/token', authMiddleware, this.usersController.getUserByToken);
  }
}

export default UsersRoute;
