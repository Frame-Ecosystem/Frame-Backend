import { NextFunction, Request, Response } from 'express';
import LoungeServicesService from '@services/loungeServices.service';
import { stripSensitiveFields } from '@utils/util';
import { CreateLoungeServiceDto, UpdateLoungeServiceDto } from '@dtos/loungeServices.dto';
import { RequestWithUser } from '@interfaces/auth.interface';

class LoungeServicesController {
  public loungeServicesService = new LoungeServicesService();

  /**
   * Create a new lounge service
   */
  public createLoungeService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data: CreateLoungeServiceDto = req.body;
      const service = await this.loungeServicesService.createLoungeService(data);
      res.status(201).json({
        data: service,
        message: 'Lounge service created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all lounge services
   */
  public getAllLoungeServices = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      let services;

      if (req.user.type === 'lounge') {
        // Lounges can only see their own services
        services = await this.loungeServicesService.getLoungeServicesByLoungeId(req.user._id.toString());
      } else {
        // Admins and other users can see all services
        services = await this.loungeServicesService.getAllLoungeServices();
      }

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
   * Get lounge services by lounge ID
   */
  public getLoungeServicesByLoungeId = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { loungeId } = req.params;
      const services = await this.loungeServicesService.getLoungeServicesByLoungeId(loungeId);
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
   * Get lounge service by ID
   */
  public getLoungeServiceById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const service = await this.loungeServicesService.getLoungeServiceById(serviceId);
      res.status(200).json({
        data: service,
        message: 'Lounge service retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get service name by service ID
   */
  public getServiceNameById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const serviceName = await this.loungeServicesService.getServiceNameById(serviceId);
      res.status(200).json({
        data: { name: serviceName },
        message: 'Service name retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update lounge service
   */
  public updateLoungeService = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const data: UpdateLoungeServiceDto = req.body;

      const service = await this.loungeServicesService.updateLoungeService(serviceId, data, req.user);
      res.status(200).json({
        data: stripSensitiveFields(service),
        message: 'Lounge service updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete lounge service
   */
  public deleteLoungeService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const service = await this.loungeServicesService.deleteLoungeService(serviceId);
      res.status(200).json({
        data: service,
        message: 'Lounge service deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Toggle lounge service active status
   */
  public toggleLoungeServiceStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const service = await this.loungeServicesService.toggleLoungeServiceStatus(serviceId);
      res.status(200).json({
        data: service,
        message: 'Lounge service status toggled successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get lounge services with pagination
   */
  public getLoungeServicesPaginated = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { services, total } = await this.loungeServicesService.getLoungeServicesPaginated(page, limit);
      res.status(200).json({
        data: services,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        message: 'Lounge services retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bulk create lounge services
   */
  public bulkCreateLoungeServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data: CreateLoungeServiceDto[] = req.body;
      const services = await this.loungeServicesService.bulkCreateLoungeServices(data);
      res.status(201).json({
        data: services,
        count: services.length,
        message: 'Lounge services created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search lounge services
   */
  public searchLoungeServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query.q as string;
      const services = await this.loungeServicesService.searchLoungeServices(query);
      res.status(200).json({
        data: services,
        count: services.length,
        message: 'Lounge services search completed',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Patch lounge opening hours
   */
  public patchLoungeOpeningHours = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { loungeId } = req.params;
      const openingHoursData = req.body;
      const updatedLounge = await this.loungeServicesService.patchLoungeOpeningHours(loungeId, openingHoursData);
      res.status(200).json({
        data: stripSensitiveFields(updatedLounge),
        message: 'Opening hours updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get agents for a specific lounge
   */
  public getAgentsPerLounge = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.params.loungeId;

      if (!loungeId) {
        return res.status(400).json({
          message: 'Lounge ID is required',
        });
      }

      const result = await this.loungeServicesService.getAgentsPerLounge(loungeId, req.user);
      res.status(200).json({
        data: result,
        message: 'Agents retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update lounge profile
   */
  public updateLoungeProfile = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { loungeId } = req.params;
      const loungeData = req.body;
      const updatedLounge = await this.loungeServicesService.updateLoungeProfile(loungeId, loungeData);
      res.status(200).json({
        data: stripSensitiveFields(updatedLounge),
        message: 'Lounge profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default LoungeServicesController;
