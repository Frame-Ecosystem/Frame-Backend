import { LoungeService } from '@interfaces/lounge/loungeService.interface';
import loungeServiceModel from '@models/lounge/loungeService.model';
import { HttpException, BadRequestException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';
import { CreateLoungeServiceDto } from '@dtos/lounge/loungeServices.dto';

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
}

export default LoungeServicesAdminService;
