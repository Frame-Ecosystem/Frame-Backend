import { Router } from 'express';
import ClientController from '@controllers/client.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import clientOrAdminMiddleware from '@middlewares/clientOrAdmin.middleware';

class ClientRoute implements Routes {
  public path = '/v1/client';
  public router = Router();
  public clientController = new ClientController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @route   GET /v1/client/lounges
     * @desc    Get all lounges with pagination (for clients and admins to browse)
     * @access  Private (Client or Admin only)
     * @query   page - Page number (default: 1)
     * @query   limit - Items per page (default: 10, max: 100)
     * @query   search - Search term (searches in loungeTitle, firstName, lastName, bio)
     * @query   gender - Filter by gender (male, female, unisex, kids)
     * @query   sortBy - Sort field (createdAt, loungeTitle, firstName, lastName)
     * @query   sortOrder - Sort order (asc, desc)
     */
    this.router.get('/lounges', authMiddleware, clientOrAdminMiddleware, this.clientController.getAllLounges);

    /**
     * @route   GET /v1/client/lounges/:loungeId
     * @desc    Get lounge details by ID (for clients and admins to view lounge profile)
     * @access  Private (Client or Admin only)
     */
    this.router.get('/lounges/:loungeId', authMiddleware, clientOrAdminMiddleware, this.clientController.getLoungeById);

    /**
     * @route   GET /v1/client/lounges/:loungeId/services
     * @desc    Get all services offered by a specific lounge (for clients and admins to view available services)
     * @access  Private (Client or Admin only)
     */
    this.router.get('/lounges/:loungeId/services', authMiddleware, clientOrAdminMiddleware, this.clientController.getLoungeServicesById);
  }
}

export default ClientRoute;
