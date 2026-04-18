import { ServiceCategory } from '@interfaces/catalog/serviceCategory.interface';
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from '@dtos/catalog/serviceCategories.dto';
import serviceCategoryModel from '@models/catalog/serviceCategory.model';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';

class ServiceCategoriesService {
  /**
   * Create a new service category
   */
  public async createServiceCategory(data: CreateServiceCategoryDto): Promise<ServiceCategory> {
    try {
      if (isEmpty(data)) {
        logger.warn('ServiceCategoriesService.createServiceCategory: empty data provided');
        throw new BadRequestException('Invalid request data');
      }

      // Check for duplicate name
      const existingCategory = await serviceCategoryModel.findOne({
        name: { $regex: new RegExp(`^${data.name}$`, 'i') },
      });

      if (existingCategory) {
        logger.error(`ServiceCategoriesService.createServiceCategory: category name already exists: ${data.name}`);
        throw new ConflictException('Service category name already exists', 'CATEGORY_NAME_EXISTS');
      }

      const createdCategory = await serviceCategoryModel.create(data);
      logger.info(`ServiceCategoriesService.createServiceCategory: created category ${createdCategory._id}`);
      return createdCategory;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceCategoriesService.createServiceCategory error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to create service category');
    }
  }

  /**
   * Get all service categories
   */
  public async getAllServiceCategories(): Promise<ServiceCategory[]> {
    try {
      const categories = await serviceCategoryModel.find().sort({ createdAt: -1 });
      logger.info(`ServiceCategoriesService.getAllServiceCategories: retrieved ${categories.length} categories`);
      return categories;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceCategoriesService.getAllServiceCategories error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to retrieve service categories');
    }
  }

  /**
   * Get service category by ID
   */
  public async getServiceCategoryById(categoryId: string): Promise<ServiceCategory> {
    try {
      if (isEmpty(categoryId)) {
        logger.warn('ServiceCategoriesService.getServiceCategoryById: empty categoryId provided');
        throw new BadRequestException('Invalid request data');
      }

      const category = await serviceCategoryModel.findById(categoryId);

      if (!category) {
        logger.error(`ServiceCategoriesService.getServiceCategoryById: category not found: ${categoryId}`);
        throw new NotFoundException('Service category not found');
      }

      return category;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceCategoriesService.getServiceCategoryById error: ${error.message}`, { categoryId, stack: error.stack });
      throw new InternalServerException('Failed to retrieve service category');
    }
  }

  /**
   * Update service category
   */
  public async updateServiceCategory(categoryId: string, data: UpdateServiceCategoryDto): Promise<ServiceCategory> {
    try {
      if (isEmpty(categoryId) || isEmpty(data)) {
        logger.warn('ServiceCategoriesService.updateServiceCategory: invalid parameters provided');
        throw new BadRequestException('Invalid request data');
      }

      // If name is being updated, check for duplicates
      if (data.name) {
        const existingCategory = await serviceCategoryModel.findOne({
          name: { $regex: new RegExp(`^${data.name}$`, 'i') },
          _id: { $ne: categoryId },
        });

        if (existingCategory) {
          logger.error(`ServiceCategoriesService.updateServiceCategory: category name already exists: ${data.name}`);
          throw new ConflictException('Service category name already exists', 'CATEGORY_NAME_EXISTS');
        }
      }

      const updatedCategory = await serviceCategoryModel.findByIdAndUpdate(categoryId, data, { new: true });

      if (!updatedCategory) {
        logger.error(`ServiceCategoriesService.updateServiceCategory: category not found: ${categoryId}`);
        throw new NotFoundException('Service category not found');
      }

      logger.info(`ServiceCategoriesService.updateServiceCategory: updated category ${categoryId}`);
      return updatedCategory;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceCategoriesService.updateServiceCategory error: ${error.message}`, { categoryId, stack: error.stack });
      throw new InternalServerException('Failed to update service category');
    }
  }

  /**
   * Delete service category
   */
  public async deleteServiceCategory(categoryId: string): Promise<ServiceCategory> {
    try {
      if (isEmpty(categoryId)) {
        logger.warn('ServiceCategoriesService.deleteServiceCategory: empty categoryId provided');
        throw new BadRequestException('Invalid request data');
      }

      // Check if category is being used by any services
      const servicesUsingCategory = await this.checkCategoryUsage(categoryId);
      if (servicesUsingCategory > 0) {
        logger.error(`ServiceCategoriesService.deleteServiceCategory: category in use by ${servicesUsingCategory} services: ${categoryId}`);
        throw new ConflictException('Cannot delete category that is being used by services', 'CATEGORY_IN_USE');
      }

      const deletedCategory = await serviceCategoryModel.findByIdAndDelete(categoryId);

      if (!deletedCategory) {
        logger.error(`ServiceCategoriesService.deleteServiceCategory: category not found: ${categoryId}`);
        throw new NotFoundException('Service category not found');
      }

      logger.info(`ServiceCategoriesService.deleteServiceCategory: deleted category ${categoryId}`);
      return deletedCategory;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceCategoriesService.deleteServiceCategory error: ${error.message}`, { categoryId, stack: error.stack });
      throw new InternalServerException('Failed to delete service category');
    }
  }

  /**
   * Search service categories
   */
  public async searchServiceCategories(query: string): Promise<ServiceCategory[]> {
    try {
      if (isEmpty(query)) {
        logger.warn('ServiceCategoriesService.searchServiceCategories: empty query provided');
        throw new BadRequestException('Invalid search query');
      }

      const categories = await serviceCategoryModel
        .find({
          name: { $regex: query, $options: 'i' },
        })
        .sort({ createdAt: -1 });

      logger.info(`ServiceCategoriesService.searchServiceCategories: found ${categories.length} results for query: ${query}`);
      return categories;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceCategoriesService.searchServiceCategories error: ${error.message}`, { query, stack: error.stack });
      throw new InternalServerException('Failed to search service categories');
    }
  }

  /**
   * Check how many services are using a category
   */
  private async checkCategoryUsage(categoryId: string): Promise<number> {
    try {
      // Import service model dynamically to avoid circular dependencies
      const serviceModel = (await import('@models/catalog/service.model')).default;
      const count = await serviceModel.countDocuments({ categoryId });
      return count;
    } catch (error) {
      logger.error(`ServiceCategoriesService.checkCategoryUsage error: ${error.message}`, { categoryId, stack: error.stack });
      return 0;
    }
  }
}

export default ServiceCategoriesService;
