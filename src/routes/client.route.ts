import { Router } from 'express';
import ClientController from '@controllers/client.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { adminOrLoungeOrClientMiddleware } from '@middlewares/role.middleware';

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
     * @desc    Get all lounges with pagination (for clients, admins, and lounges to browse)
     * @access  Private (Client, Admin, or Lounge)
     * @query   page - Page number (default: 1)
     * @query   limit - Items per page (default: 10, max: 100)
     * @query   search - Search term (searches in loungeTitle, firstName, lastName, bio)
     * @query   gender - Filter by gender (male, female, unisex, kids)
     * @query   sortBy - Sort field (createdAt, loungeTitle, firstName, lastName) - only used when client has no location data
     * @query   sortOrder - Sort order (asc, desc) - only used when client has no location data
     * @note    When client location is available, lounges are automatically sorted by distance (nearest first)
     */
    this.router.get('/lounges', authMiddleware, adminOrLoungeOrClientMiddleware, this.clientController.getAllLounges);

    /**
     * @route   GET /v1/client/lounges/:loungeId
     * @desc    Get lounge details by ID (for clients, admins, and lounges to view lounge profile)
     * @access  Private (Client, Admin, or Lounge)
     */
    this.router.get('/lounges/:loungeId', authMiddleware, adminOrLoungeOrClientMiddleware, this.clientController.getLoungeById);

    /**
     * @route   GET /v1/client/lounges/:loungeId/services
     * @desc    Get all services offered by a specific lounge (for clients, admins, and lounges to view available services)
     * @access  Private (Client, Admin, or Lounge)
     */
    this.router.get('/lounges/:loungeId/services', authMiddleware, adminOrLoungeOrClientMiddleware, this.clientController.getLoungeServicesById);

    /**
     * @route   GET /v1/client/services/:serviceId/lounges
     * @desc    Filter lounges by service (for clients, admins, and lounges to find lounges offering specific services)
     * @access  Private (Client, Admin, or Lounge)
     * @query   page - Page number (default: 1)
     * @query   limit - Items per page (default: 10, max: 100)
     * @query   search - Search term (searches in loungeTitle, firstName, lastName, bio)
     * @query   gender - Filter by gender (male, female, unisex, kids)
     * @query   sortBy - Sort field (createdAt, loungeTitle, firstName, lastName, distance when location provided)
     * @query   sortOrder - Sort order (asc, desc)
     * @query   userLatitude - User's latitude for distance-based sorting
     * @query   userLongitude - User's longitude for distance-based sorting
     */
    this.router.get('/services/:serviceId/lounges', authMiddleware, adminOrLoungeOrClientMiddleware, this.clientController.getLoungesByService);
  }
}

export default ClientRoute;
