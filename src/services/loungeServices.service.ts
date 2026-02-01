import { LoungeService, ServiceLoungeGender } from '@interfaces/loungeService.interface';
import loungeServiceModel from '@models/loungeService.model';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';
import { CreateLoungeServiceDto, UpdateLoungeServiceDto } from '@dtos/loungeServices.dto';

class LoungeServicesService {
  public loungeServices = loungeServiceModel;

  /**
   * Create a new lounge service
   */
  public async createLoungeService(data: CreateLoungeServiceDto): Promise<LoungeService> {
    try {
      if (isEmpty(data) || !data.loungeId || !data.serviceId) {
        logger.warn('LoungeServicesService.createLoungeService: invalid data provided');
        throw new BadRequestException('Invalid request data. loungeId and serviceId are required');
      }

      // Check if service already exists for this lounge
      const existingService = await this.loungeServices.findOne({
        loungeId: data.loungeId,
        serviceId: data.serviceId,
      });

      if (existingService) {
        logger.error(`LoungeServicesService.createLoungeService: service already exists for lounge ${data.loungeId}`);
        throw new ConflictException('This service already exists for this lounge', 'SERVICE_EXISTS');
      }

      const newLoungeService = await this.loungeServices.create({
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : true,
      });

      logger.info(`LoungeServicesService.createLoungeService: created service ${newLoungeService._id} for lounge ${data.loungeId}`);
      return newLoungeService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesService.createLoungeService error: ${error.message}`, { data, stack: error.stack });
      throw new InternalServerException('Failed to create lounge service');
    }
  }

  /**
   * Get all lounge services
   */
  public async getAllLoungeServices(): Promise<LoungeService[]> {
    try {
      const services = await this.loungeServices.find().populate('loungeId').populate('serviceId');
      logger.info(`LoungeServicesService.getAllLoungeServices: retrieved ${services.length} services`);
      return services;
    } catch (error) {
      logger.error(`LoungeServicesService.getAllLoungeServices error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to retrieve lounge services');
    }
  }

  /**
   * Get lounge services by lounge ID
   */
  public async getLoungeServicesByLoungeId(loungeId: string): Promise<LoungeService[]> {
    try {
      if (isEmpty(loungeId)) {
        logger.warn('LoungeServicesService.getLoungeServicesByLoungeId: empty loungeId provided');
        throw new BadRequestException('Invalid request data');
      }

      const services = await this.loungeServices.find({ loungeId }).populate('serviceId');
      logger.info(`LoungeServicesService.getLoungeServicesByLoungeId: retrieved ${services.length} services for lounge ${loungeId}`);
      return services;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesService.getLoungeServicesByLoungeId error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Failed to retrieve lounge services');
    }
  }

  /**
   * Get lounge service by ID
   */
  public async getLoungeServiceById(serviceId: string): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('LoungeServicesService.getLoungeServiceById: empty serviceId provided');
        throw new BadRequestException('Invalid request data');
      }

      const service = await this.loungeServices.findById(serviceId).populate('loungeId').populate('serviceId');

      if (!service) {
        logger.error(`LoungeServicesService.getLoungeServiceById: service not found: ${serviceId}`);
        throw new NotFoundException('Lounge service not found');
      }

      return service;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesService.getLoungeServiceById error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Failed to retrieve lounge service');
    }
  }

  /**
   * Update lounge service
   */
  public async updateLoungeService(serviceId: string, data: UpdateLoungeServiceDto): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId) || isEmpty(data)) {
        logger.warn('LoungeServicesService.updateLoungeService: invalid parameters provided');
        throw new BadRequestException('Invalid request data');
      }

      const updatedService = await this.loungeServices.findByIdAndUpdate(serviceId, data, { new: true }).populate('loungeId').populate('serviceId');

      if (!updatedService) {
        logger.error(`LoungeServicesService.updateLoungeService: service not found: ${serviceId}`);
        throw new NotFoundException('Lounge service not found');
      }

      logger.info(`LoungeServicesService.updateLoungeService: updated service ${serviceId}`);
      return updatedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesService.updateLoungeService error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Failed to update lounge service');
    }
  }

  /**
   * Delete lounge service
   */
  public async deleteLoungeService(serviceId: string): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('LoungeServicesService.deleteLoungeService: empty serviceId provided');
        throw new BadRequestException('Invalid request data');
      }

      const deletedService = await this.loungeServices.findByIdAndDelete(serviceId);

      if (!deletedService) {
        logger.error(`LoungeServicesService.deleteLoungeService: service not found: ${serviceId}`);
        throw new NotFoundException('Lounge service not found');
      }

      logger.info(`LoungeServicesService.deleteLoungeService: deleted service ${serviceId}`);
      return deletedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesService.deleteLoungeService error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Failed to delete lounge service');
    }
  }

  /**
   * Toggle lounge service active status
   */
  public async toggleLoungeServiceStatus(serviceId: string): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('LoungeServicesService.toggleLoungeServiceStatus: empty serviceId provided');
        throw new BadRequestException('Invalid request data');
      }

      const service = await this.loungeServices.findById(serviceId);

      if (!service) {
        logger.error(`LoungeServicesService.toggleLoungeServiceStatus: service not found: ${serviceId}`);
        throw new NotFoundException('Lounge service not found');
      }

      const updatedService = await this.loungeServices
        .findByIdAndUpdate(serviceId, { isActive: !service.isActive }, { new: true })
        .populate('loungeId')
        .populate('serviceId');

      logger.info(`LoungeServicesService.toggleLoungeServiceStatus: toggled service ${serviceId} to ${!service.isActive}`);
      return updatedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesService.toggleLoungeServiceStatus error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Failed to toggle lounge service status');
    }
  }

  /**
   * Get services with pagination
   */
  public async getLoungeServicesPaginated(page = 1, limit = 20): Promise<{ services: LoungeService[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const [services, total] = await Promise.all([
        this.loungeServices.find().populate('loungeId').populate('serviceId').skip(skip).limit(limit).sort({ createdAt: -1 }),
        this.loungeServices.countDocuments(),
      ]);

      logger.info(`LoungeServicesService.getLoungeServicesPaginated: retrieved services page=${page} limit=${limit}`);
      return { services, total };
    } catch (error) {
      logger.error(`LoungeServicesService.getLoungeServicesPaginated error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to retrieve lounge services');
    }
  }

  /**
   * Bulk create lounge services
   */
  public async bulkCreateLoungeServices(data: CreateLoungeServiceDto[]): Promise<LoungeService[]> {
    try {
      if (isEmpty(data) || !Array.isArray(data)) {
        logger.warn('LoungeServicesService.bulkCreateLoungeServices: invalid data provided');
        throw new BadRequestException('Invalid request data. Data must be an array');
      }

      const newServices = await this.loungeServices.insertMany(data);
      logger.info(`LoungeServicesService.bulkCreateLoungeServices: created ${newServices.length} services`);
      return newServices;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesService.bulkCreateLoungeServices error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to create lounge services');
    }
  }

  /**
   * Search lounge services
   */
  public async searchLoungeServices(query: string): Promise<LoungeService[]> {
    try {
      if (isEmpty(query)) {
        logger.warn('LoungeServicesService.searchLoungeServices: empty query provided');
        throw new BadRequestException('Invalid search query');
      }

      const services = await this.loungeServices
        .find({
          $or: [{ description: { $regex: query, $options: 'i' } }],
        })
        .populate('loungeId')
        .populate('serviceId');

      logger.info(`LoungeServicesService.searchLoungeServices: found ${services.length} results for query: ${query}`);
      return services;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesService.searchLoungeServices error: ${error.message}`, { query, stack: error.stack });
      throw new InternalServerException('Failed to search lounge services');
    }
  }
}

export default LoungeServicesService;
