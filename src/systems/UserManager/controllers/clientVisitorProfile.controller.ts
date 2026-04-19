import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import ClientVisitorProfileService from '@systems/UserManager/services/clientVisitorProfile.service';
import { parsePagination } from '@utils/validators';
import { logger } from '@utils/logger';

class ClientVisitorProfileController {
  private profileService = new ClientVisitorProfileService();

  /**
   * GET /v1/client/profile/:clientId — public profile of a client.
   * Accessible by admin, lounge, or client.  Response shape varies by viewer role.
   */
  public getClientProfile = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const viewerType = req.user.type;

      const data = await this.profileService.getClientProfile(clientId, viewerType);
      res.status(200).json({ success: true, data, message: 'Client profile retrieved successfully' });
    } catch (error) {
      logger.error(`Error in getClientProfile: ${error.message}`);
      next(error);
    }
  };

  /**
   * GET /v1/client/profile/:clientId/bookings — booking history.
   * - Admin: all bookings
   * - Lounge: only bookings at their lounge
   * - Client: only own bookings (clientId must match)
   */
  public getClientBookings = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const viewerId = req.user._id.toString();
      const viewerType = req.user.type;
      const { page, limit } = parsePagination(req);
      const status = req.query.status as string | undefined;

      const data = await this.profileService.getClientBookings(clientId, viewerId, viewerType, { page, limit, status });
      res.status(200).json({ success: true, ...data, message: 'Booking history retrieved successfully' });
    } catch (error) {
      logger.error(`Error in getClientBookings: ${error.message}`);
      next(error);
    }
  };

  /**
   * GET /v1/client/profile/:clientId/likes — lounges liked by the client.
   */
  public getClientLikedLounges = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const { page, limit } = parsePagination(req);

      const data = await this.profileService.getClientLikedLounges(clientId, page, limit);
      res.status(200).json({ success: true, data, message: 'Liked lounges retrieved successfully' });
    } catch (error) {
      logger.error(`Error in getClientLikedLounges: ${error.message}`);
      next(error);
    }
  };

  /**
   * GET /v1/client/profile/:clientId/ratings — ratings given by the client.
   */
  public getClientRatings = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const { page, limit } = parsePagination(req);

      const data = await this.profileService.getClientRatings(clientId, page, limit);
      res.status(200).json({ success: true, data, message: 'Client ratings retrieved successfully' });
    } catch (error) {
      logger.error(`Error in getClientRatings: ${error.message}`);
      next(error);
    }
  };
}

export default ClientVisitorProfileController;
