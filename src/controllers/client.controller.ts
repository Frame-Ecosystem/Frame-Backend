import { NextFunction, Request, Response } from 'express';
import ClientService from '@services/client.service';
import { RequestWithUser } from '@interfaces/auth.interface';

class ClientController {
  public clientService = new ClientService();

  /**
   * Get all lounges with pagination (for clients)
   */
  public getAllLounges = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      // Extract query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || '';
      const gender = req.query.gender as string;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      const result = await this.clientService.getAllLounges({
        page,
        limit,
        search,
        gender,
        sortBy,
        sortOrder,
      });

      res.status(200).json({
        data: result.lounges,
        pagination: result.pagination,
        message: 'Lounges retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get lounge details by ID (for clients)
   */
  public getLoungeById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { loungeId } = req.params;
      const lounge = await this.clientService.getLoungeById(loungeId);

      res.status(200).json({
        data: lounge,
        message: 'Lounge details retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all services offered by a specific lounge (for clients)
   */
  public getLoungeServicesById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { loungeId } = req.params;
      const services = await this.clientService.getLoungeServicesById(loungeId);

      res.status(200).json({
        data: services,
        count: services.length,
        message: 'Lounge services retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default ClientController;
