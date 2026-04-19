import { NextFunction, Request, Response } from 'express';
import ServiceCategoriesService from '@systems/ServiceCatalogSystem/services/serviceCategories.service';

class PublicServiceCategoriesController {
  private serviceCategoriesService = new ServiceCategoriesService();

  public getAllServiceCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.serviceCategoriesService.getAllServiceCategories();
      res.status(200).json({ data: categories });
    } catch (error) {
      next(error);
    }
  };

  public getServiceCategoryById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const category = await this.serviceCategoriesService.getServiceCategoryById(id);
      res.status(200).json({ data: category });
    } catch (error) {
      next(error);
    }
  };
}

export default PublicServiceCategoriesController;
