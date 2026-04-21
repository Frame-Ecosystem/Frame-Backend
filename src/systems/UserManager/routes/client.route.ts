import { Router } from 'express';
import ClientController from '@systems/UserManager/controllers/client.controller';
import ClientVisitorProfileController from '@systems/UserManager/controllers/clientVisitorProfile.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { adminOrLoungeOrClientOrAgentMiddleware } from '@middlewares/role.middleware';

class ClientRoute implements Routes {
  public path = '/v1/client';
  public router = Router();
  public clientController = new ClientController();
  public clientVisitorProfileController = new ClientVisitorProfileController();

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
    this.router.get('/lounges', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.clientController.getAllLounges);

    /**
     * @route   GET /v1/client/lounges/:loungeId
     * @desc    Get lounge details by ID (for clients, admins, and lounges to view lounge profile)
     * @access  Private (Client, Admin, or Lounge)
     */
    this.router.get('/lounges/:loungeId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.clientController.getLoungeById);

    /**
     * @route   GET /v1/client/lounges/:loungeId/services
     * @desc    Get all services offered by a specific lounge (for clients, admins, and lounges to view available services)
     * @access  Private (Client, Admin, or Lounge)
     */
    this.router.get('/lounges/:loungeId/services', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.clientController.getLoungeServicesById);

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
    this.router.get('/services/:serviceId/lounges', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.clientController.getLoungesByService);

    /* ------------------------------------------------------------------ */
    /*  Client Profile routes (visitor profile)                           */
    /* ------------------------------------------------------------------ */

    /**
     * @route   GET /v1/client/profile/:clientId
     * @desc    Get a client's public profile. Response varies by viewer role:
     *          - Admin:  full profile (email, phone, blocked status, timestamps)
     *          - Lounge: public profile + createdAt
     *          - Client: minimal public profile (name, avatar, bio, gender)
     * @access  Private (Client, Admin, or Lounge)
     */
    this.router.get('/profile/:clientId', authMiddleware, adminOrLoungeOrClientOrAgentMiddleware, this.clientVisitorProfileController.getClientProfile);

    /**
     * @route   GET /v1/client/profile/:clientId/bookings
     * @desc    Get a client's booking history. Scoped by viewer role:
     *          - Admin:  all bookings for this client
     *          - Lounge: only bookings at their lounge
     *          - Client: only own bookings (clientId must match logged-in user)
     * @access  Private (Client, Admin, or Lounge)
     * @query   page - Page number (default: 1)
     * @query   limit - Items per page (default: 20, max: 50)
     * @query   status - Filter by booking status (pending, confirmed, inQueue, completed, cancelled, absent)
     */
    this.router.get(
      '/profile/:clientId/bookings',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      this.clientVisitorProfileController.getClientBookings,
    );

    /**
     * @route   GET /v1/client/profile/:clientId/likes
     * @desc    Get lounges liked by this client (public social data)
     * @access  Private (Client, Admin, or Lounge)
     * @query   page - Page number (default: 1)
     * @query   limit - Items per page (default: 20, max: 50)
     */
    this.router.get(
      '/profile/:clientId/likes',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      this.clientVisitorProfileController.getClientLikedLounges,
    );

    /**
     * @route   GET /v1/client/profile/:clientId/ratings
     * @desc    Get ratings given by this client (public social data)
     * @access  Private (Client, Admin, or Lounge)
     * @query   page - Page number (default: 1)
     * @query   limit - Items per page (default: 20, max: 50)
     */
    this.router.get(
      '/profile/:clientId/ratings',
      authMiddleware,
      adminOrLoungeOrClientOrAgentMiddleware,
      this.clientVisitorProfileController.getClientRatings,
    );
  }
}

export default ClientRoute;
