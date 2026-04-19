import { LoungeService } from '@systems/ServiceCatalogSystem/interfaces/loungeService.interface';
import loungeServiceModel from '@systems/ServiceCatalogSystem/models/loungeService.model';
import { HttpException, BadRequestException, ConflictException, InternalServerException, NotFoundException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';
import { CreateLoungeServiceDto } from '@systems/ServiceCatalogSystem/dtos/loungeServices.dto';
import userModel from '@systems/UserManager/models/user.model';

class LoungeServicesAdminService {
  private loungeServices = loungeServiceModel;

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

      logger.info(`LoungeServicesAdminService.getLoungeServicesPaginated: retrieved services page=${page} limit=${limit}`);
      return { services, total };
    } catch (error) {
      logger.error(`LoungeServicesAdminService.getLoungeServicesPaginated error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to retrieve lounge services at this time. Please try again later.');
    }
  }

  /**
   * Bulk create lounge services
   */
  public async bulkCreateLoungeServices(data: CreateLoungeServiceDto[]): Promise<LoungeService[]> {
    try {
      if (isEmpty(data) || !Array.isArray(data)) {
        logger.warn('LoungeServicesAdminService.bulkCreateLoungeServices: invalid data provided');
        throw new BadRequestException('Lounge service data array is required for bulk creation', 'INVALID_DATA_ARRAY');
      }

      if (data.length === 0) {
        logger.warn('LoungeServicesAdminService.bulkCreateLoungeServices: empty array provided');
        throw new BadRequestException('At least one lounge service must be provided for bulk creation', 'EMPTY_ARRAY');
      }

      const processedData: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const serviceData = data[i];

        if (!serviceData.loungeId || !serviceData.serviceId) {
          errors.push(`Service ${i + 1}: loungeId and serviceId are required`);
          continue;
        }

        const duplicateInBatch = processedData.find(s => s.loungeId === serviceData.loungeId && s.serviceId === serviceData.serviceId);
        if (duplicateInBatch) {
          errors.push(`Service ${i + 1}: duplicate lounge-service combination within the batch`);
          continue;
        }

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
        logger.error(`LoungeServicesAdminService.bulkCreateLoungeServices validation errors: ${errors.join('; ')}`);
        throw new BadRequestException(`Validation failed: ${errors.join('; ')}`, 'BULK_VALIDATION_ERROR');
      }

      const newServices = await this.loungeServices.insertMany(processedData);
      logger.info(`LoungeServicesAdminService.bulkCreateLoungeServices: created ${newServices.length} services`);
      return newServices;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error.name === 'BulkWriteError') {
        logger.error(`LoungeServicesAdminService.bulkCreateLoungeServices bulk write error: ${error.message}`, { stack: error.stack });
        throw new ConflictException(
          'Some lounge services could not be created due to conflicts. Please check for duplicates.',
          'BULK_WRITE_CONFLICT',
        );
      }
      if (error.name === 'ValidationError') {
        logger.error(`LoungeServicesAdminService.bulkCreateLoungeServices validation error: ${error.message}`, { stack: error.stack });
        throw new BadRequestException('Invalid lounge service data provided. Please check all fields.', 'VALIDATION_ERROR');
      }
      logger.error(`LoungeServicesAdminService.bulkCreateLoungeServices error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to create lounge services at this time. Please try again later.');
    }
  }

  /**
   * Search lounge services
   */
  public async searchLoungeServices(query: string): Promise<LoungeService[]> {
    try {
      if (isEmpty(query)) {
        logger.warn('LoungeServicesAdminService.searchLoungeServices: empty query provided');
        throw new BadRequestException('Search query is required to find lounge services', 'MISSING_SEARCH_QUERY');
      }

      const services = await this.loungeServices
        .find({
          $or: [{ description: { $regex: query, $options: 'i' } }],
        })
        .populate('loungeId')
        .populate('serviceId');

      logger.info(`LoungeServicesAdminService.searchLoungeServices: found ${services.length} results for query: ${query}`);
      return services;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.searchLoungeServices error: ${error.message}`, { query, stack: error.stack });
      throw new InternalServerException('Unable to search lounge services at this time. Please try again later.');
    }
  }

  /**
   * Create a single lounge service (with optional uploaded file metadata)
   */
  public async createLoungeService(data: CreateLoungeServiceDto, _file?: any): Promise<LoungeService> {
    try {
      if (isEmpty(data)) {
        throw new BadRequestException('Lounge service data is required', 'MISSING_DATA');
      }
      if (!data.loungeId || !data.serviceId) {
        throw new BadRequestException('loungeId and serviceId are required', 'MISSING_REQUIRED_FIELDS');
      }
      const existing = await this.loungeServices.findOne({ loungeId: data.loungeId, serviceId: data.serviceId });
      if (existing) {
        throw new ConflictException('Service already exists for this lounge', 'DUPLICATE_LOUNGE_SERVICE');
      }
      const created = await this.loungeServices.create({
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
      logger.info(`LoungeServicesAdminService.createLoungeService: created service ${created._id}`);
      return created;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.createLoungeService error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to create lounge service. Please try again later.');
    }
  }

  /**
   * Get all lounge services (no pagination)
   */
  public async getAllLoungeServices(): Promise<LoungeService[]> {
    try {
      const services = await this.loungeServices.find().populate('loungeId').populate('serviceId').sort({ createdAt: -1 });
      logger.info(`LoungeServicesAdminService.getAllLoungeServices: retrieved ${services.length} services`);
      return services;
    } catch (error) {
      logger.error(`LoungeServicesAdminService.getAllLoungeServices error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to retrieve lounge services. Please try again later.');
    }
  }

  /**
   * Get all lounge services for a given lounge id
   */
  public async getLoungeServicesByLoungeId(loungeId: string): Promise<LoungeService[]> {
    try {
      if (isEmpty(loungeId)) {
        throw new BadRequestException('Lounge ID is required', 'MISSING_LOUNGE_ID');
      }
      const services = await this.loungeServices.find({ loungeId }).populate('serviceId').sort({ createdAt: -1 });
      logger.info(`LoungeServicesAdminService.getLoungeServicesByLoungeId: retrieved ${services.length} services for lounge ${loungeId}`);
      return services;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.getLoungeServicesByLoungeId error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve lounge services. Please try again later.');
    }
  }

  /**
   * Get a single lounge service by id
   */
  public async getLoungeServiceById(serviceId: string): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        throw new BadRequestException('Service ID is required', 'MISSING_SERVICE_ID');
      }
      const service = await this.loungeServices.findById(serviceId).populate('loungeId').populate('serviceId');
      if (!service) {
        throw new NotFoundException('Lounge service not found', 'SERVICE_NOT_FOUND');
      }
      return service;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.getLoungeServiceById error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve lounge service. Please try again later.');
    }
  }

  /**
   * Get the populated service name from a lounge-service id
   */
  public async getServiceNameById(serviceId: string): Promise<string> {
    try {
      const ls: any = await this.loungeServices.findById(serviceId).populate('serviceId');
      if (!ls) {
        throw new NotFoundException('Lounge service not found', 'SERVICE_NOT_FOUND');
      }
      return ls.serviceId?.name || '';
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.getServiceNameById error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve service name. Please try again later.');
    }
  }

  /**
   * Update a lounge service
   */
  public async updateLoungeService(serviceId: string, data: any, _user?: any, _file?: any): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        throw new BadRequestException('Service ID is required', 'MISSING_SERVICE_ID');
      }
      const updated = await this.loungeServices.findByIdAndUpdate(serviceId, { $set: data }, { new: true });
      if (!updated) {
        throw new NotFoundException('Lounge service not found', 'SERVICE_NOT_FOUND');
      }
      logger.info(`LoungeServicesAdminService.updateLoungeService: updated service ${serviceId}`);
      return updated;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.updateLoungeService error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to update lounge service. Please try again later.');
    }
  }

  /**
   * Delete a lounge service
   */
  public async deleteLoungeService(serviceId: string): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        throw new BadRequestException('Service ID is required', 'MISSING_SERVICE_ID');
      }
      const deleted = await this.loungeServices.findByIdAndDelete(serviceId);
      if (!deleted) {
        throw new NotFoundException('Lounge service not found', 'SERVICE_NOT_FOUND');
      }
      logger.info(`LoungeServicesAdminService.deleteLoungeService: deleted service ${serviceId}`);
      return deleted;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.deleteLoungeService error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to delete lounge service. Please try again later.');
    }
  }

  /**
   * Toggle the active/inactive status of a lounge service
   */
  public async toggleLoungeServiceStatus(serviceId: string): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        throw new BadRequestException('Service ID is required', 'MISSING_SERVICE_ID');
      }
      const existing = await this.loungeServices.findById(serviceId);
      if (!existing) {
        throw new NotFoundException('Lounge service not found', 'SERVICE_NOT_FOUND');
      }
      const updated = await this.loungeServices.findByIdAndUpdate(
        serviceId,
        { isActive: !existing.isActive },
        { new: true },
      );
      logger.info(`LoungeServicesAdminService.toggleLoungeServiceStatus: toggled service ${serviceId} to isActive=${updated?.isActive}`);
      return updated as LoungeService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.toggleLoungeServiceStatus error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to toggle lounge service status. Please try again later.');
    }
  }

  /**
   * Patch the opening hours of a lounge (user document of type 'lounge')
   */
  public async patchLoungeOpeningHours(loungeId: string, openingHoursData: any): Promise<any> {
    try {
      if (isEmpty(loungeId)) {
        throw new BadRequestException('Lounge ID is required', 'MISSING_LOUNGE_ID');
      }
      const updatedLounge = await userModel.findByIdAndUpdate(
        loungeId,
        { $set: { openingHours: openingHoursData } },
        { new: true },
      );
      if (!updatedLounge) {
        throw new NotFoundException('Lounge not found', 'LOUNGE_NOT_FOUND');
      }
      logger.info(`LoungeServicesAdminService.patchLoungeOpeningHours: updated lounge ${loungeId} opening hours`);
      return updatedLounge;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.patchLoungeOpeningHours error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Unable to update lounge opening hours. Please try again later.');
    }
  }

  /**
   * Get all agents that belong to a specific lounge
   */
  public async getAgentsPerLounge(loungeId: string, _reqUser?: any): Promise<{ agents: any[]; total: number }> {
    try {
      if (isEmpty(loungeId)) {
        throw new BadRequestException('Lounge ID is required', 'MISSING_LOUNGE_ID');
      }
      const lounge = await userModel.findById(loungeId);
      if (!lounge) {
        throw new NotFoundException('Lounge not found', 'LOUNGE_NOT_FOUND');
      }
      const agents = await userModel.find({ type: 'agent', loungeId });
      logger.info(`LoungeServicesAdminService.getAgentsPerLounge: retrieved ${agents.length} agents for lounge ${loungeId}`);
      return { agents, total: agents.length };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.getAgentsPerLounge error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve agents for lounge. Please try again later.');
    }
  }

  /**
   * Update the lounge profile (user document of type 'lounge')
   */
  public async updateLoungeProfile(loungeId: string, loungeData: any): Promise<any> {
    try {
      if (isEmpty(loungeId)) {
        throw new BadRequestException('Lounge ID is required', 'MISSING_LOUNGE_ID');
      }
      // Strip fields that should never be updated through this endpoint
      const { password, refreshTokens, type, isAdmin: _isAdmin, ...safeData } = loungeData || {};
      const updatedLounge = await userModel.findByIdAndUpdate(
        loungeId,
        { $set: safeData },
        { new: true },
      );
      if (!updatedLounge) {
        throw new NotFoundException('Lounge not found', 'LOUNGE_NOT_FOUND');
      }
      logger.info(`LoungeServicesAdminService.updateLoungeProfile: updated lounge ${loungeId} profile`);
      return updatedLounge;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeServicesAdminService.updateLoungeProfile error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Unable to update lounge profile. Please try again later.');
    }
  }
}

export default LoungeServicesAdminService;
