import { Router } from 'express';
import AdminController from '@controllers/admin.controller';
import { CreateUserDto, UpdateUserDto } from '@dtos/users.dto';
import { Routes } from '@interfaces/routes.interface';
import validationMiddleware from '@middlewares/validation.middleware';
import authMiddleware from '@middlewares/auth.middleware';
import adminMiddleware from '@middlewares/admin.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import axios from 'axios';

class AdminRoute implements Routes {
  public path = '/v1/admin';
  public router = Router();
  public adminController = new AdminController();

  constructor() {
    this.initializeRoutes();
  }
  public testN8nEmail = async (req, res) => {
    try {
      const response = await axios.post(
        'http://localhost:5678/webhook-test/verify-code',
        {
          to: 'mouhamed.abbassi@esprit.tn',
          subject: 'Test email from Express',
          message: 'Triggered from Express via n8n',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      res.json({ success: true, n8nResponse: response.data });
    } catch (error) {
      console.error(error.response?.status, error.response?.data || error.message);
      res.status(500).json({ success: false });
    }
  };

  private initializeRoutes() {
    this.router.post('/send', this.testN8nEmail);

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
