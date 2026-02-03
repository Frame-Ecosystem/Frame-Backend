import { LoungeService, ServiceLoungeGender } from '@interfaces/loungeService.interface';
import { User } from '@interfaces/users.interface';
import loungeServiceModel from '@models/loungeService.model';
import serviceModel from '@models/service.model';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';
import { CreateLoungeServiceDto, UpdateLoungeServiceDto } from '@dtos/loungeServices.dto';

class LoungeServicesService {
  public loungeServices = loungeServiceModel;
  public services = serviceModel;

  /**
   * Create a new lounge service
   */
  public async createLoungeService(data: CreateLoungeServiceDto): Promise<LoungeService> {
    try {
      if (isEmpty(data) || !data.loungeId || !data.serviceId) {
        logger.warn('LoungeServicesService.createLoungeService: invalid data provided');
        throw new BadRequestException('Lounge ID and Service ID are required to create a lounge service', 'MISSING_REQUIRED_FIELDS');
      }

      // Check if service already exists for this lounge
      const existingService = await this.loungeServices.findOne({
        loungeId: data.loungeId,
        serviceId: data.serviceId,
      });

      if (existingService) {
        logger.error(`LoungeServicesService.createLoungeService: service already exists for lounge ${data.loungeId}`);
        throw new ConflictException('This service is already offered by this lounge', 'SERVICE_ALREADY_EXISTS');
      }

      const newLoungeService = await this.loungeServices.create({
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : true,
      });

      logger.info(`LoungeServicesService.createLoungeService: created service ${newLoungeService._id} for lounge ${data.loungeId}`);
      return newLoungeService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle MongoDB validation errors
      if (error.name === 'ValidationError') {
        logger.error(`LoungeServicesService.createLoungeService validation error: ${error.message}`, { data, stack: error.stack });
        throw new BadRequestException('Invalid lounge service data provided. Please check all required fields.', 'VALIDATION_ERROR');
      }
      // Handle MongoDB duplicate key errors
      if (error.code === 11000) {
        logger.error(`LoungeServicesService.createLoungeService duplicate key error: ${error.message}`, { data, stack: error.stack });
        throw new ConflictException('This service is already offered by this lounge.', 'DUPLICATE_KEY_ERROR');
      }
      logger.error(`LoungeServicesService.createLoungeService error: ${error.message}`, { data, stack: error.stack });
      throw new InternalServerException('Unable to create lounge service at this time. Please try again later.');
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
      throw new InternalServerException('Unable to retrieve lounge services at this time. Please try again later.');
    }
  }

  /**
   * Get lounge services by lounge ID
   */
  public async getLoungeServicesByLoungeId(loungeId: string): Promise<LoungeService[]> {
    try {
      if (isEmpty(loungeId)) {
        logger.warn('LoungeServicesService.getLoungeServicesByLoungeId: empty loungeId provided');
        throw new BadRequestException('Lounge ID is required to retrieve lounge services', 'MISSING_LOUNGE_ID');
      }

      const services = await this.loungeServices.find({ loungeId }).populate('serviceId');
      logger.info(`LoungeServicesService.getLoungeServicesByLoungeId: retrieved ${services.length} services for lounge ${loungeId}`);
      return services;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`LoungeServicesService.getLoungeServicesByLoungeId invalid ID format: ${loungeId}`, { stack: error.stack });
        throw new BadRequestException('Invalid lounge ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`LoungeServicesService.getLoungeServicesByLoungeId error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve lounge services at this time. Please try again later.');
    }
  }

  /**
   * Get lounge service by ID
   */
  public async getLoungeServiceById(serviceId: string): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('LoungeServicesService.getLoungeServiceById: empty serviceId provided');
        throw new BadRequestException('Lounge service ID is required to retrieve the service', 'MISSING_SERVICE_ID');
      }

      const service = await this.loungeServices.findById(serviceId).populate('loungeId').populate('serviceId');

      if (!service) {
        logger.error(`LoungeServicesService.getLoungeServiceById: service not found: ${serviceId}`);
        throw new NotFoundException('The requested lounge service could not be found', 'LOUNGE_SERVICE_NOT_FOUND');
      }

      return service;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`LoungeServicesService.getLoungeServiceById invalid ID format: ${serviceId}`, { stack: error.stack });
        throw new BadRequestException('Invalid lounge service ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`LoungeServicesService.getLoungeServiceById error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve lounge service at this time. Please try again later.');
    }
  }

  /**
   * Get service name by service ID
   */
  public async getServiceNameById(serviceId: string): Promise<string> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('LoungeServicesService.getServiceNameById: empty serviceId provided');
        throw new BadRequestException('Service ID is required to retrieve the service name', 'MISSING_SERVICE_ID');
      }

      const service = await serviceModel.findById(serviceId).select('name');

      if (!service) {
        logger.error(`LoungeServicesService.getServiceNameById: service not found: ${serviceId}`);
        throw new NotFoundException('The requested service could not be found', 'SERVICE_NOT_FOUND');
      }

      logger.info(`LoungeServicesService.getServiceNameById: retrieved name for service ${serviceId}`);
      return service.name;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`LoungeServicesService.getServiceNameById invalid ID format: ${serviceId}`, { stack: error.stack });
        throw new BadRequestException('Invalid service ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`LoungeServicesService.getServiceNameById error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve service name at this time. Please try again later.');
    }
  }

  /**
   * Update lounge service
   */
  public async updateLoungeService(serviceId: string, data: UpdateLoungeServiceDto, user?: User): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId) || isEmpty(data)) {
        logger.warn('LoungeServicesService.updateLoungeService: invalid parameters provided');
        throw new BadRequestException('Lounge service ID and update data are required', 'MISSING_REQUIRED_FIELDS');
      }

      // Get the existing service to check ownership if user is provided
      if (user && user.type === 'lounge') {
        const existingService = await this.loungeServices.findById(serviceId);
        if (!existingService) {
          logger.error(`LoungeServicesService.updateLoungeService: service not found: ${serviceId}`);
          throw new NotFoundException('The requested lounge service could not be found', 'LOUNGE_SERVICE_NOT_FOUND');
        }

        // Lounge users can only update their own services
        if (existingService.loungeId.toString() !== user._id.toString()) {
          logger.warn(`LoungeServicesService.updateLoungeService: lounge user ${user._id} attempted to update service ${serviceId} owned by ${existingService.loungeId}`);
          throw new HttpException(403, 'You can only update your own lounge services');
        }

        // Lounge users can update all fields of their own services
      }

      const updatedService = await this.loungeServices.findByIdAndUpdate(serviceId, data, { new: true }).populate('loungeId').populate('serviceId');

      if (!updatedService) {
        logger.error(`LoungeServicesService.updateLoungeService: service not found: ${serviceId}`);
        throw new NotFoundException('The requested lounge service could not be found', 'LOUNGE_SERVICE_NOT_FOUND');
      }

      logger.info(`LoungeServicesService.updateLoungeService: updated service ${serviceId}`);
      return updatedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle MongoDB validation errors
      if (error.name === 'ValidationError') {
        logger.error(`LoungeServicesService.updateLoungeService validation error: ${error.message}`, { serviceId, stack: error.stack });
        throw new BadRequestException('Invalid lounge service data provided. Please check all fields.', 'VALIDATION_ERROR');
      }
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`LoungeServicesService.updateLoungeService invalid ID format: ${serviceId}`, { stack: error.stack });
        throw new BadRequestException('Invalid lounge service ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`LoungeServicesService.updateLoungeService error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to update lounge service at this time. Please try again later.');
    }
  }

  /**
   * Delete lounge service
   */
  public async deleteLoungeService(serviceId: string): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('LoungeServicesService.deleteLoungeService: empty serviceId provided');
        throw new BadRequestException('Lounge service ID is required to delete the service', 'MISSING_SERVICE_ID');
      }

      const deletedService = await this.loungeServices.findByIdAndDelete(serviceId);

      if (!deletedService) {
        logger.error(`LoungeServicesService.deleteLoungeService: service not found: ${serviceId}`);
        throw new NotFoundException('The requested lounge service could not be found', 'LOUNGE_SERVICE_NOT_FOUND');
      }

      logger.info(`LoungeServicesService.deleteLoungeService: deleted service ${serviceId}`);
      return deletedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`LoungeServicesService.deleteLoungeService invalid ID format: ${serviceId}`, { stack: error.stack });
        throw new BadRequestException('Invalid lounge service ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`LoungeServicesService.deleteLoungeService error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to delete lounge service at this time. Please try again later.');
    }
  }

  /**
   * Toggle lounge service status
   */
  public async toggleLoungeServiceStatus(serviceId: string): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('LoungeServicesService.toggleLoungeServiceStatus: empty serviceId provided');
        throw new BadRequestException('Lounge service ID is required to toggle status', 'MISSING_SERVICE_ID');
      }

      const service = await this.loungeServices.findById(serviceId);

      if (!service) {
        logger.error(`LoungeServicesService.toggleLoungeServiceStatus: service not found: ${serviceId}`);
        throw new NotFoundException('The requested lounge service could not be found', 'LOUNGE_SERVICE_NOT_FOUND');
      }

      const newStatus = service.status === LoungeServiceStatus.ACTIVE ? LoungeServiceStatus.INACTIVE : LoungeServiceStatus.ACTIVE;

      const updatedService = await this.loungeServices
        .findByIdAndUpdate(serviceId, { status: newStatus }, { new: true })
        .populate('loungeId')
        .populate('serviceId');

      logger.info(`LoungeServicesService.toggleLoungeServiceStatus: toggled service ${serviceId} to ${newStatus}`);
      return updatedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`LoungeServicesService.toggleLoungeServiceStatus invalid ID format: ${serviceId}`, { stack: error.stack });
        throw new BadRequestException('Invalid lounge service ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`LoungeServicesService.toggleLoungeServiceStatus error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to toggle lounge service status at this time. Please try again later.');
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
      throw new InternalServerException('Unable to retrieve lounge services at this time. Please try again later.');
    }
  }

  /**
   * Bulk create lounge services
   */
  public async bulkCreateLoungeServices(data: CreateLoungeServiceDto[]): Promise<LoungeService[]> {
    try {
      if (isEmpty(data) || !Array.isArray(data)) {
        logger.warn('LoungeServicesService.bulkCreateLoungeServices: invalid data provided');
        throw new BadRequestException('Lounge service data array is required for bulk creation', 'INVALID_DATA_ARRAY');
      }

      if (data.length === 0) {
        logger.warn('LoungeServicesService.bulkCreateLoungeServices: empty array provided');
        throw new BadRequestException('At least one lounge service must be provided for bulk creation', 'EMPTY_ARRAY');
      }

      // Validate each service and check for duplicates
      const processedData: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const serviceData = data[i];
        
        if (!serviceData.loungeId || !serviceData.serviceId) {
          errors.push(`Service ${i + 1}: loungeId and serviceId are required`);
          continue;
        }

        // Check for duplicates within the batch
        const duplicateInBatch = processedData.find(s => 
          s.loungeId === serviceData.loungeId && s.serviceId === serviceData.serviceId
        );
        if (duplicateInBatch) {
          errors.push(`Service ${i + 1}: duplicate lounge-service combination within the batch`);
          continue;
        }

        // Check if service already exists for this lounge
        const existingService = await this.loungeServices.findOne({
          loungeId: serviceData.loungeId,
          serviceId: serviceData.serviceId,
        });
        if (existingService) {
          errors.push(`Service ${i + 1}: service already exists for this lounge`);
          continue;
        }

        processedData.push({
          ...serviceData,
          isActive: serviceData.isActive !== undefined ? serviceData.isActive : true,
        });
      }

      if (errors.length > 0) {
        logger.error(`LoungeServicesService.bulkCreateLoungeServices validation errors: ${errors.join('; ')}`);
        throw new BadRequestException(`Validation failed: ${errors.join('; ')}`, 'BULK_VALIDATION_ERROR');
      }

      const newServices = await this.loungeServices.insertMany(processedData);
      logger.info(`LoungeServicesService.bulkCreateLoungeServices: created ${newServices.length} services`);
      return newServices;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle MongoDB bulk write errors
      if (error.name === 'BulkWriteError') {
        logger.error(`LoungeServicesService.bulkCreateLoungeServices bulk write error: ${error.message}`, { stack: error.stack });
        throw new ConflictException('Some lounge services could not be created due to conflicts. Please check for duplicates.', 'BULK_WRITE_CONFLICT');
      }
      // Handle MongoDB validation errors
      if (error.name === 'ValidationError') {
        logger.error(`LoungeServicesService.bulkCreateLoungeServices validation error: ${error.message}`, { stack: error.stack });
        throw new BadRequestException('Invalid lounge service data provided. Please check all fields.', 'VALIDATION_ERROR');
      }
      logger.error(`LoungeServicesService.bulkCreateLoungeServices error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to create lounge services at this time. Please try again later.');
    }
  }

  /**
   * Search lounge services
   */
  public async searchLoungeServices(query: string): Promise<LoungeService[]> {
    try {
      if (isEmpty(query)) {
        logger.warn('LoungeServicesService.searchLoungeServices: empty query provided');
        throw new BadRequestException('Search query is required to find lounge services', 'MISSING_SEARCH_QUERY');
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
      throw new InternalServerException('Unable to search lounge services at this time. Please try again later.');
    }
  }
}

export default LoungeServicesService;
