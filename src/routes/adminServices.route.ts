import { Router } from 'express';
import AdminServicesController from '@controllers/adminServices.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import adminMiddleware from '@middlewares/admin.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';

class AdminServicesRoute implements Routes {
  public path = '/v1/admin-services';
  public router = Router();
  public adminServicesController = new AdminServicesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // GET - Get all admin services statistics
    this.router.get('/stats', authMiddleware, adminMiddleware, this.adminServicesController.getAllAdminServices);

    // GET - Get system health status
    this.router.get('/health', authMiddleware, adminMiddleware, this.adminServicesController.getSystemHealth);

    // GET - Get user activity log
    this.router.get('/activity-log', authMiddleware, adminMiddleware, this.adminServicesController.getUserActivityLog);

    // GET - Get dashboard statistics
    this.router.get('/dashboard', authMiddleware, adminMiddleware, this.adminServicesController.getDashboardStats);

    // POST - Clear user sessions
    this.router.post(
      '/users/:userId/clear-sessions',
      authMiddleware,
      adminMiddleware,
      csrfMiddleware,
      this.adminServicesController.clearUserSessions,
    );

    // POST - Reset user password
    this.router.post(
      '/users/:userId/reset-password',
      authMiddleware,
      adminMiddleware,
      csrfMiddleware,
      this.adminServicesController.resetUserPassword,
    );

    // GET - Export user data
    this.router.get('/users/:userId/export', authMiddleware, adminMiddleware, this.adminServicesController.exportUserData);

    // POST - Create audit log
    this.router.post('/audit-log', authMiddleware, adminMiddleware, csrfMiddleware, this.adminServicesController.createAuditLog);
  }
}

export default AdminServicesRoute;
