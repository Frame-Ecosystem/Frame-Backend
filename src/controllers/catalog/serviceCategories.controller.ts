import { NextFunction, Request, Response } from 'express';
import { ServiceCategory } from '@interfaces/catalog/serviceCategory.interface';
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from '@dtos/catalog/serviceCategories.dto';
import ServiceCategoriesService from '@services/catalog/serviceCategories.service';

class ServiceCategoriesController {
  private serviceCategoriesService = new ServiceCategoriesService();

  /**
   * Create a new service category
   */
  public createServiceCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categoryData: CreateServiceCategoryDto = req.body;
      const newCategory: ServiceCategory = await this.serviceCategoriesService.createServiceCategory(categoryData);

      res.status(201).json({
        data: newCategory,
        message: 'Service category created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all service categories
   */
  public getAllServiceCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories: ServiceCategory[] = await this.serviceCategoriesService.getAllServiceCategories();

      res.status(200).json({
        data: categories,
        count: categories.length,
        message: 'Service categories retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get service category by ID
   */
  public getServiceCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categoryId: string = req.params.categoryId;
      const category: ServiceCategory = await this.serviceCategoriesService.getServiceCategoryById(categoryId);

      res.status(200).json({
        data: category,
        message: 'Service category retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update service category
   */
  public updateServiceCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categoryId: string = req.params.categoryId;
      const categoryData: UpdateServiceCategoryDto = req.body;
      const updatedCategory: ServiceCategory = await this.serviceCategoriesService.updateServiceCategory(categoryId, categoryData);

      res.status(200).json({
        data: updatedCategory,
        message: 'Service category updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete service category
   */
  public deleteServiceCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categoryId: string = req.params.categoryId;
      const deletedCategory: ServiceCategory = await this.serviceCategoriesService.deleteServiceCategory(categoryId);

      res.status(200).json({
        data: deletedCategory,
        message: 'Service category deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search service categories
   */
  public searchServiceCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query: string = req.query.q as string;
      const categories: ServiceCategory[] = await this.serviceCategoriesService.searchServiceCategories(query);

      res.status(200).json({
        data: categories,
        count: categories.length,
        message: 'Service categories search completed successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default ServiceCategoriesController;
