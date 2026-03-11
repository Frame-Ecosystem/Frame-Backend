import { Router } from 'express';
import AdminController from '@controllers/admin.controller';
import { CreateUserDto, UpdateUserDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import authMiddleware from '@middlewares/auth.middleware';
import { adminMiddleware } from '@middlewares/role.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';

class AdminRoute implements Routes {
  public path = '/v1/admin';
  public router = Router();
  public adminController = new AdminController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // GET - List all users (with pagination/search)
    this.router.get('/users', authMiddleware, adminMiddleware, this.adminController.getUsers);

    // GET - Get user by ID
    this.router.get('/users/:id', authMiddleware, adminMiddleware, this.adminController.getUserById);

    // GET - Get online session info
    this.router.get('/session-info', authMiddleware, adminMiddleware, this.adminController.getOnlineUsers);

    // POST - Create new user
    this.router.post(
      '/users',
      authMiddleware,
      adminMiddleware,
      csrfMiddleware,
      validationMiddleware(CreateUserDto, 'body'),
      this.adminController.createUser,
    );

    // PUT - Update user
    this.router.put(
      '/users/:id',
      authMiddleware,
      adminMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateUserDto, 'body', true),
      this.adminController.updateUser,
    );

    // DELETE - Delete user
    this.router.delete('/users/:id', authMiddleware, adminMiddleware, csrfMiddleware, this.adminController.deleteUser);
    // PATCH - Block/unblock user
    this.router.patch('/users/:id/block', authMiddleware, adminMiddleware, csrfMiddleware, this.adminController.changeUserBlockedState);

    // GET - Get all lounge names and IDs
    this.router.get('/lounges/names', authMiddleware, adminMiddleware, this.adminController.getAllLoungeNames);
  }
}

export default AdminRoute;
