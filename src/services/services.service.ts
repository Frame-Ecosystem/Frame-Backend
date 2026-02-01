import { Service } from '@/interfaces/service.interface';
import { CreateServiceDto, UpdateServiceDto } from '@/dtos/services.dto';
import serviceModel from '@/models/service.model';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@/exceptions/HttpException';
import { isEmpty } from '@/utils/util';
import { logger } from '@utils/logger';

interface CreateServiceDto {
  name: string;
  categoryId: string;
  baseDuration?: number;
  status?: string;
}

interface UpdateServiceDto {
  name?: string;
  categoryId?: string;
  baseDuration?: number;
  status?: string;
}

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
        // Remove spaces and special characters
        .replace(/[^\w]/g, '')
        // Remove extra spaces
        .replace(/\s+/g, '')
        // Trim
        .trim()
    );
  }

  /**
   * Create a new service (admin only)
   */
  public async createService(data: CreateServiceDto): Promise<Service> {
    try {
      if (isEmpty(data) || !data.name || !data.categoryId) {
        logger.warn('ServicesService.createService: invalid data provided');
        throw new BadRequestException('Invalid request data. name and categoryId are required');
      }

      // Check if service name already exists (case-insensitive)
      const existingService = await this.services.findOne({ name: new RegExp(`^${data.name.trim()}$`, 'i') });
      if (existingService) {
        logger.error(`ServicesService.createService: service name already exists: ${data.name}`);
        throw new ConflictException('Service name already exists', 'SERVICE_NAME_EXISTS');
      }

      // Normalize name for duplicate checking
      const normalizedName = this.normalizeServiceName(data.name);

      // Check if a service with similar normalized name exists
      const existingNormalized = await this.services.findOne({
        $or: [{ name: new RegExp(`^${normalizedName}$`, 'i') }, { name: new RegExp(`\\b${normalizedName}\\b`, 'i') }],
      });

      if (existingNormalized && this.normalizeServiceName(existingNormalized.name) === normalizedName) {
        logger.error(`ServicesService.createService: similar service already exists: ${existingNormalized.name} (normalized: ${normalizedName})`);
        throw new ConflictException('A similar service already exists', 'SERVICE_SIMILAR_EXISTS');
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
      logger.error(`ServicesService.createService error: ${error.message}`, { data, stack: error.stack });
      throw new InternalServerException('Failed to create service');
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
      throw new InternalServerException('Failed to retrieve services');
    }
  }

  /**
   * Get service by ID
   */
  public async getServiceById(serviceId: string): Promise<Service> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('ServicesService.getServiceById: empty serviceId provided');
        throw new BadRequestException('Invalid request data');
      }

      const service = await this.services.findById(serviceId).populate('categoryId');

      if (!service) {
        logger.error(`ServicesService.getServiceById: service not found: ${serviceId}`);
        throw new NotFoundException('Service not found');
      }

      return service;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServicesService.getServiceById error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Failed to retrieve service');
    }
  }

  /**
   * Update service
   */
  public async updateService(serviceId: string, data: UpdateServiceDto): Promise<Service> {
    try {
      if (isEmpty(serviceId) || isEmpty(data)) {
        logger.warn('ServicesService.updateService: invalid parameters provided');
        throw new BadRequestException('Invalid request data');
      }

      // Prepare update data
      const updateData: any = { ...data };

      // If name is being updated, check for duplicates
      if (data.name) {
        const existingService = await this.services.findOne({
          name: new RegExp(`^${data.name.trim()}$`, 'i'),
          _id: { $ne: serviceId },
        });
        if (existingService) {
          logger.error(`ServicesService.updateService: service name already exists: ${data.name}`);
          throw new ConflictException('Service name already exists', 'SERVICE_NAME_EXISTS');
        }

        // Update the name to lowercase in the update data
        updateData.name = data.name.trim().toLowerCase();

        // Normalize name for duplicate checking
        const normalizedName = this.normalizeServiceName(data.name);

        // Check if a service with similar normalized name exists
        const existingNormalized = await this.services.findOne({
          _id: { $ne: serviceId },
          $or: [{ name: new RegExp(`^${normalizedName}$`, 'i') }, { name: new RegExp(`\\b${normalizedName}\\b`, 'i') }],
        });

        if (existingNormalized && this.normalizeServiceName(existingNormalized.name) === normalizedName) {
          logger.error(`ServicesService.updateService: similar service already exists: ${existingNormalized.name} (normalized: ${normalizedName})`);
          throw new ConflictException('A similar service already exists', 'SERVICE_SIMILAR_EXISTS');
        }
      }

      const updatedService = await this.services.findByIdAndUpdate(serviceId, updateData, { new: true }).populate('categoryId');

      if (!updatedService) {
        logger.error(`ServicesService.updateService: service not found: ${serviceId}`);
        throw new NotFoundException('Service not found');
      }

      logger.info(`ServicesService.updateService: updated service ${serviceId}`);
      return updatedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServicesService.updateService error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Failed to update service');
    }
  }

  /**
   * Delete service
   */
  public async deleteService(serviceId: string): Promise<Service> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('ServicesService.deleteService: empty serviceId provided');
        throw new BadRequestException('Invalid request data');
      }

      const deletedService = await this.services.findByIdAndDelete(serviceId);

      if (!deletedService) {
        logger.error(`ServicesService.deleteService: service not found: ${serviceId}`);
        throw new NotFoundException('Service not found');
      }

      logger.info(`ServicesService.deleteService: deleted service ${serviceId}`);
      return deletedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServicesService.deleteService error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Failed to delete service');
    }
  }

  /**
   * Toggle service status
   */
  public async toggleServiceStatus(serviceId: string): Promise<Service> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('ServicesService.toggleServiceStatus: empty serviceId provided');
        throw new BadRequestException('Invalid request data');
      }

      const service = await this.services.findById(serviceId);

      if (!service) {
        logger.error(`ServicesService.toggleServiceStatus: service not found: ${serviceId}`);
        throw new NotFoundException('Service not found');
      }

      const newStatus = service.status === 'active' ? 'inactive' : 'active';

      const updatedService = await this.services.findByIdAndUpdate(serviceId, { status: newStatus }, { new: true }).populate('categoryId');

      logger.info(`ServicesService.toggleServiceStatus: toggled service ${serviceId} to ${newStatus}`);
      return updatedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServicesService.toggleServiceStatus error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Failed to toggle service status');
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
      throw new InternalServerException('Failed to retrieve services');
    }
  }

  /**
   * Search services
   */
  public async searchServices(query: string): Promise<Service[]> {
    try {
      if (isEmpty(query)) {
        logger.warn('ServicesService.searchServices: empty query provided');
        throw new BadRequestException('Invalid search query');
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
      throw new InternalServerException('Failed to search services');
    }
  }

  /**
   * Get services by category
   */
  public async getServicesByCategory(categoryId: string): Promise<Service[]> {
    try {
      if (isEmpty(categoryId)) {
        logger.warn('ServicesService.getServicesByCategory: empty categoryId provided');
        throw new BadRequestException('Invalid request data');
      }

      const services = await this.services.find({ categoryId }).populate('categoryId');
      logger.info(`ServicesService.getServicesByCategory: retrieved ${services.length} services for category ${categoryId}`);
      return services;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServicesService.getServicesByCategory error: ${error.message}`, { categoryId, stack: error.stack });
      throw new InternalServerException('Failed to retrieve services by category');
    }
  }

  /**
   * Bulk create services
   */
  public async bulkCreateServices(data: CreateServiceDto[]): Promise<Service[]> {
    try {
      if (isEmpty(data) || !Array.isArray(data)) {
        logger.warn('ServicesService.bulkCreateServices: invalid data provided');
        throw new BadRequestException('Invalid request data. Data must be an array');
      }

      // Process each service
      const processedData = data.map(serviceData => {
        return {
          ...serviceData,
          name: serviceData.name.trim().toLowerCase(),
          status: serviceData.status || 'active',
        };
      });

      const newServices = await this.services.insertMany(processedData);
      logger.info(`ServicesService.bulkCreateServices: created ${newServices.length} services`);
      return newServices;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServicesService.bulkCreateServices error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to create services');
    }
  }
}

export default ServicesService;
