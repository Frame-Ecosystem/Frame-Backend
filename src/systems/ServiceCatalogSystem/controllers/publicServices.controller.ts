import { NextFunction, Request, Response } from 'express';
import ServicesService from '@systems/ServiceCatalogSystem/services/services.service';

class PublicServicesController {
  private servicesService = new ServicesService();

  public getAllServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const services = await this.servicesService.getAllServices();
      res.status(200).json({ data: services });
    } catch (error) {
      next(error);
    }
  };

  public getServiceById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const service = await this.servicesService.getServiceById(id);
      res.status(200).json({ data: service });
    } catch (error) {
      next(error);
    }
  };
}

export default PublicServicesController;
