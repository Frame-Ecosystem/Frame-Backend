import { Service } from '@systems/ServiceCatalogSystem/interfaces/service.interface';
import { CreateServiceDto, UpdateServiceDto } from '@systems/ServiceCatalogSystem/dtos/services.dto';
import serviceModel from '@systems/ServiceCatalogSystem/models/service.model';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { isEmpty, handleMongooseError, escapeRegex } from '@utils/util';
import { logger } from '@utils/logger';

class ServicesService {
  public services = serviceModel;

  /**
   * Normalize service name by removing gender/type words and special characters
   */
  private normalizeServiceName(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        // Remove gender/type words
        .replace(
          /\b(men|women|mens|womens|male|female|boys|girls|kids|unisex|ladies|gentlemen|man|woman|boy|girl|child|children|baby|babies|teen|teens|adult|adults)\b/g,
          '',
        )
        // Remove possessive forms
        .replace(/\b(men|women|boys|girls|kids|ladies|gentlemen)'s?\b/g, '')
        // Remove spaces, special characters, and trim
        .replace(/[^\w]/g, '')
    );
  }

  /**
   * Create a new service (admin only)
   */
  public async createService(data: CreateServiceDto): Promise<Service> {
    try {
      if (isEmpty(data) || !data.name || !data.categoryId) {
        logger.warn('ServicesService.createService: invalid data provided');
        throw new BadRequestException('Service name and category are required to create a service', 'MISSING_REQUIRED_FIELDS');
      }

      // Check if service name already exists (case-insensitive)
      const escapedName = escapeRegex(data.name.trim());
      const existingService = await this.services.findOne({ name: new RegExp(`^${escapedName}$`, 'i') });
      if (existingService) {
        logger.error(`ServicesService.createService: service name already exists: ${data.name}`);
        throw new ConflictException('A service with this name already exists. Please choose a different name.', 'SERVICE_NAME_EXISTS');
      }

      // Normalize name for duplicate checking
      const normalizedName = this.normalizeServiceName(data.name);
      const escapedNormalizedName = escapeRegex(normalizedName);

      // Check if a service with similar normalized name exists
      const existingNormalized = await this.services.findOne({
        $or: [{ name: new RegExp(`^${escapedNormalizedName}$`, 'i') }, { name: new RegExp(`\\b${escapedNormalizedName}\\b`, 'i') }],
      });

      if (existingNormalized && this.normalizeServiceName(existingNormalized.name) === normalizedName) {
        logger.error(`ServicesService.createService: similar service already exists: ${existingNormalized.name} (normalized: ${normalizedName})`);
        throw new ConflictException('A similar service already exists. Please review and choose a different name.', 'SERVICE_SIMILAR_EXISTS');
      }

      const newService = await this.services.create({
        ...data,
        name: data.name.trim().toLowerCase(),
        status: data.status || 'active',
      });

      logger.info(`ServicesService.createService: created service ${newService._id} - ${data.name} (normalized: ${normalizedName})`);
      return newService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ServicesService.createService', {
        duplicateMessage: 'A service with this information already exists.',
        fallbackMessage: 'Unable to create service at this time. Please try again later.',
        logMeta: { data },
      });
    }
  }

  /**
   * Get all services
   */
  public async getAllServices(): Promise<Service[]> {
    try {
      const services = await this.services.find().populate('categoryId').sort({ createdAt: -1 });
      logger.info(`ServicesService.getAllServices: retrieved ${services.length} services`);
      return services;
    } catch (error) {
      logger.error(`ServicesService.getAllServices error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to retrieve services at this time. Please try again later.');
    }
  }

  /**
   * Get service by ID
   */
  public async getServiceById(serviceId: string): Promise<Service> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('ServicesService.getServiceById: empty serviceId provided');
        throw new BadRequestException('Service ID is required to retrieve a service', 'MISSING_SERVICE_ID');
      }

      const service = await this.services.findById(serviceId).populate('categoryId');

      if (!service) {
        logger.error(`ServicesService.getServiceById: service not found: ${serviceId}`);
        throw new NotFoundException('The requested service could not be found', 'SERVICE_NOT_FOUND');
      }

      return service;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ServicesService.getServiceById', {
        castMessage: 'Invalid service ID format',
        fallbackMessage: 'Unable to retrieve service at this time. Please try again later.',
        logMeta: { serviceId },
      });
    }
  }

  /**
   * Update service
   */
  public async updateService(serviceId: string, data: UpdateServiceDto): Promise<Service> {
    try {
      if (isEmpty(serviceId) || isEmpty(data)) {
        logger.warn('ServicesService.updateService: invalid parameters provided');
        throw new BadRequestException('Service ID and update data are required', 'MISSING_REQUIRED_FIELDS');
      }

      // Prepare update data
      const updateData: any = { ...data };

      // If name is being updated, check for duplicates
      if (data.name) {
        const escapedName = escapeRegex(data.name.trim());
        const existingService = await this.services.findOne({
          name: new RegExp(`^${escapedName}$`, 'i'),
          _id: { $ne: serviceId },
        });
        if (existingService) {
          logger.error(`ServicesService.updateService: service name already exists: ${data.name}`);
          throw new ConflictException('A service with this name already exists. Please choose a different name.', 'SERVICE_NAME_EXISTS');
        }

        // Update the name to lowercase in the update data
        updateData.name = data.name.trim().toLowerCase();

        // Normalize name for duplicate checking
        const normalizedName = this.normalizeServiceName(data.name);
        const escapedNormalizedName = escapeRegex(normalizedName);

        // Check if a service with similar normalized name exists
        const existingNormalized = await this.services.findOne({
          _id: { $ne: serviceId },
          $or: [{ name: new RegExp(`^${escapedNormalizedName}$`, 'i') }, { name: new RegExp(`\\b${escapedNormalizedName}\\b`, 'i') }],
        });

        if (existingNormalized && this.normalizeServiceName(existingNormalized.name) === normalizedName) {
          logger.error(`ServicesService.updateService: similar service already exists: ${existingNormalized.name} (normalized: ${normalizedName})`);
          throw new ConflictException('A similar service already exists. Please review and choose a different name.', 'SERVICE_SIMILAR_EXISTS');
        }
      }

      const updatedService = await this.services.findByIdAndUpdate(serviceId, updateData, { new: true }).populate('categoryId');

      if (!updatedService) {
        logger.error(`ServicesService.updateService: service not found: ${serviceId}`);
        throw new NotFoundException('The requested service could not be found', 'SERVICE_NOT_FOUND');
      }

      logger.info(`ServicesService.updateService: updated service ${serviceId}`);
      return updatedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ServicesService.updateService', {
        castMessage: 'Invalid service ID format',
        fallbackMessage: 'Unable to update service at this time. Please try again later.',
        logMeta: { serviceId },
      });
    }
  }

  /**
   * Delete service
   */
  public async deleteService(serviceId: string): Promise<Service> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('ServicesService.deleteService: empty serviceId provided');
        throw new BadRequestException('Service ID is required to delete a service', 'MISSING_SERVICE_ID');
      }

      const deletedService = await this.services.findByIdAndDelete(serviceId);

      if (!deletedService) {
        logger.error(`ServicesService.deleteService: service not found: ${serviceId}`);
        throw new NotFoundException('The requested service could not be found', 'SERVICE_NOT_FOUND');
      }

      logger.info(`ServicesService.deleteService: deleted service ${serviceId}`);
      return deletedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ServicesService.deleteService', {
        castMessage: 'Invalid service ID format',
        fallbackMessage: 'Unable to delete service at this time. Please try again later.',
        logMeta: { serviceId },
      });
    }
  }

  /**
   * Get services with pagination
   */
  public async getServicesPaginated(page = 1, limit = 20): Promise<{ services: Service[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const [services, total] = await Promise.all([
        this.services.find().populate('categoryId').skip(skip).limit(limit).sort({ createdAt: -1 }),
        this.services.countDocuments(),
      ]);

      logger.info(`ServicesService.getServicesPaginated: retrieved services page=${page} limit=${limit}`);
      return { services, total };
    } catch (error) {
      logger.error(`ServicesService.getServicesPaginated error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to retrieve services at this time. Please try again later.');
    }
  }

  /**
   * Search services
   */
  public async searchServices(query: string): Promise<Service[]> {
    try {
      if (isEmpty(query)) {
        logger.warn('ServicesService.searchServices: empty query provided');
        throw new BadRequestException('Search query is required to find services', 'MISSING_SEARCH_QUERY');
      }

      const services = await this.services
        .find({
          name: { $regex: query, $options: 'i' },
        })
        .populate('categoryId');

      logger.info(`ServicesService.searchServices: found ${services.length} results for query: ${query}`);
      return services;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServicesService.searchServices error: ${error.message}`, { query, stack: error.stack });
      throw new InternalServerException('Unable to search services at this time. Please try again later.');
    }
  }

  /**
   * Get services by category
   */
  public async getServicesByCategory(categoryId: string): Promise<Service[]> {
    try {
      if (isEmpty(categoryId)) {
        logger.warn('ServicesService.getServicesByCategory: empty categoryId provided');
        throw new BadRequestException('Category ID is required to retrieve services', 'MISSING_CATEGORY_ID');
      }

      const services = await this.services.find({ categoryId }).populate('categoryId');
      logger.info(`ServicesService.getServicesByCategory: retrieved ${services.length} services for category ${categoryId}`);
      return services;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ServicesService.getServicesByCategory', {
        castMessage: 'Invalid category ID format',
        fallbackMessage: 'Unable to retrieve services by category at this time. Please try again later.',
        logMeta: { categoryId },
      });
    }
  }

  /**
   * Bulk create services
   */
  public async bulkCreateServices(data: CreateServiceDto[]): Promise<Service[]> {
    try {
      if (isEmpty(data) || !Array.isArray(data)) {
        logger.warn('ServicesService.bulkCreateServices: invalid data provided');
        throw new BadRequestException('Service data array is required for bulk creation', 'INVALID_DATA_ARRAY');
      }

      if (data.length === 0) {
        logger.warn('ServicesService.bulkCreateServices: empty array provided');
        throw new BadRequestException('At least one service must be provided for bulk creation', 'EMPTY_ARRAY');
      }

      // Validate each service and check for duplicates
      const processedData: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const serviceData = data[i];

        if (!serviceData.name || !serviceData.categoryId) {
          errors.push(`Service ${i + 1}: name and categoryId are required`);
          continue;
        }

        // Check for duplicates within the batch
        const duplicateInBatch = processedData.find(s => s.name.toLowerCase() === serviceData.name.trim().toLowerCase());
        if (duplicateInBatch) {
          errors.push(`Service ${i + 1}: duplicate name '${serviceData.name}' within the batch`);
          continue;
        }

        // Check if service name already exists in database
        const existingService = await this.services.findOne({
          name: new RegExp(`^${serviceData.name.trim()}$`, 'i'),
        });
        if (existingService) {
          errors.push(`Service ${i + 1}: service name '${serviceData.name}' already exists`);
          continue;
        }

        processedData.push({
          ...serviceData,
          name: serviceData.name.trim().toLowerCase(),
          status: serviceData.status || 'active',
        });
      }

      if (errors.length > 0) {
        logger.error(`ServicesService.bulkCreateServices validation errors: ${errors.join('; ')}`);
        throw new BadRequestException(`Validation failed: ${errors.join('; ')}`, 'BULK_VALIDATION_ERROR');
      }

      const newServices = await this.services.insertMany(processedData);
      logger.info(`ServicesService.bulkCreateServices: created ${newServices.length} services`);
      return newServices;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle MongoDB bulk write errors
      if (error.name === 'BulkWriteError') {
        logger.error(`ServicesService.bulkCreateServices bulk write error: ${error.message}`, { stack: error.stack });
        throw new ConflictException('Some services could not be created due to conflicts. Please check for duplicates.', 'BULK_WRITE_CONFLICT');
      }
      // Handle MongoDB validation errors
      if (error.name === 'ValidationError') {
        logger.error(`ServicesService.bulkCreateServices validation error: ${error.message}`, { stack: error.stack });
        throw new BadRequestException('Invalid service data provided. Please check all fields.', 'VALIDATION_ERROR');
      }
      logger.error(`ServicesService.bulkCreateServices error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to create services at this time. Please try again later.');
    }
  }
}

export default ServicesService;
