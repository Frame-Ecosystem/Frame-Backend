import { NextFunction, Request, Response } from 'express';
import ServicesService from '@systems/ServiceCatalogSystem/services/services.service';
import { CreateServiceDto, UpdateServiceDto } from '@systems/ServiceCatalogSystem/dtos/services.dto';

class ServicesController {
  private servicesService = new ServicesService();

  /**
   * Create a new service (admin only)
   */
  public createService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data: CreateServiceDto = req.body;
      const service = await this.servicesService.createService(data);
      res.status(201).json({
        data: service,
        message: 'Service created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all services
   */
  public getAllServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const services = await this.servicesService.getAllServices();
      res.status(200).json({
        data: services,
        count: services.length,
        message: 'Services retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get service by ID
   */
  public getServiceById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const service = await this.servicesService.getServiceById(serviceId);
      res.status(200).json({
        data: service,
        message: 'Service retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update service
   */
  public updateService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const data: UpdateServiceDto = req.body;
      const service = await this.servicesService.updateService(serviceId, data);
      res.status(200).json({
        data: service,
        message: 'Service updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete service
   */
  public deleteService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceId } = req.params;
      const service = await this.servicesService.deleteService(serviceId);
      res.status(200).json({
        data: service,
        message: 'Service deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get services with pagination
   */
  public getServicesPaginated = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { services, total } = await this.servicesService.getServicesPaginated(page, limit);
      res.status(200).json({
        data: services,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        message: 'Services retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search services
   */
  public searchServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query.q as string;
      const services = await this.servicesService.searchServices(query);
      res.status(200).json({
        data: services,
        count: services.length,
        message: 'Services search completed',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get services by category
   */
  public getServicesByCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const services = await this.servicesService.getServicesByCategory(categoryId);
      res.status(200).json({
        data: services,
        count: services.length,
        message: 'Services retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bulk create services
   */
  public bulkCreateServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data: CreateServiceDto[] = req.body;
      const services = await this.servicesService.bulkCreateServices(data);
      res.status(201).json({
        data: services,
        count: services.length,
        message: 'Services created successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default ServicesController;
