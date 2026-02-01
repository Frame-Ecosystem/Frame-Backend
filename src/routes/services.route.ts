import { Router } from 'express';
import ServicesController from '@controllers/services.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import adminMiddleware from '@middlewares/admin.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';

class ServicesRoute implements Routes {
  public path = '/v1/admin/services';
  public router = Router();
  public servicesController = new ServicesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // GET - Get all services with pagination
    this.router.get('/', authMiddleware, this.servicesController.getServicesPaginated);

    // GET - Search services
    this.router.get('/search', authMiddleware, this.servicesController.searchServices);

    // GET - Get services by category
    this.router.get('/category/:categoryId', authMiddleware, this.servicesController.getServicesByCategory);

    // GET - Get service by ID
    this.router.get('/:serviceId', authMiddleware, this.servicesController.getServiceById);

    // POST - Create a new service (admin only)
    this.router.post('/', authMiddleware, adminMiddleware, csrfMiddleware, this.servicesController.createService);

    // POST - Bulk create services (admin only)
    this.router.post('/bulk', authMiddleware, adminMiddleware, csrfMiddleware, this.servicesController.bulkCreateServices);

    // PUT - Update service (admin only)
    this.router.put('/:serviceId', authMiddleware, adminMiddleware, csrfMiddleware, this.servicesController.updateService);

    // DELETE - Delete service (admin only)
    this.router.delete('/:serviceId', authMiddleware, adminMiddleware, csrfMiddleware, this.servicesController.deleteService);

    // PATCH - Toggle service status (admin only)
    this.router.patch('/:serviceId/toggle-status', authMiddleware, adminMiddleware, csrfMiddleware, this.servicesController.toggleServiceStatus);
  }
}

export default ServicesRoute;
