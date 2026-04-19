import { NextFunction, Response } from 'express';
import ClientService from '@systems/UserManager/services/client.service';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';

class ClientController {
  private clientService = new ClientService();

  private extractPaginationParams(query: any) {
    return {
      page: parseInt(query.page as string) || 1,
      limit: parseInt(query.limit as string) || 10,
      search: (query.search as string) || '',
      gender: query.gender as string,
      sortBy: (query.sortBy as string) || 'createdAt',
      sortOrder: (query.sortOrder as 'asc' | 'desc') || 'desc',
    };
  }

  /**
   * Get all lounges with pagination (for clients)
   */
  public getAllLounges = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const params = this.extractPaginationParams(req.query);
      const clientId = req.user._id.toString();

      const result = await this.clientService.getAllLounges({ ...params, clientId });

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

  /**
   * Filter lounges by service (for clients to find lounges offering specific services)
   */
  public getLoungesByService = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const params = this.extractPaginationParams(req.query);
      const userLatitude = req.query.userLatitude ? parseFloat(req.query.userLatitude as string) : undefined;
      const userLongitude = req.query.userLongitude ? parseFloat(req.query.userLongitude as string) : undefined;

      const result = await this.clientService.getLoungesByService(serviceId, {
        ...params,
        userLatitude,
        userLongitude,
      });

      res.status(200).json({
        data: result.lounges,
        pagination: result.pagination,
        message: 'Lounges filtered by service retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
export default ClientController;
