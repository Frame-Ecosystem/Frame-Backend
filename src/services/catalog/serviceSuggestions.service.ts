import { ServiceSuggestion } from '@interfaces/catalog/serviceSuggestion.interface';
import {
  CreateServiceSuggestionDto,
  UpdateServiceSuggestionDto,
  UpdateServiceSuggestionStatusDto,
  AdminApproveServiceSuggestionDto,
} from '@dtos/catalog/serviceSuggestions.dto';
import serviceSuggestionModel from '@models/catalog/serviceSuggestion.model';
import { HttpException, BadRequestException, NotFoundException, InternalServerException, ConflictException, ForbiddenException } from '@/exceptions/HttpException';
import { isEmpty, handleMongooseError } from '@/utils/util';
import { logger } from '@utils/logger';
import { ServiceSuggestionStatus } from '@interfaces/catalog/serviceSuggestion.interface';
import ServiceSuggestionsAdminService from '@services/catalog/serviceSuggestions-admin.service';

class ServiceSuggestionsService {
  public serviceSuggestions = serviceSuggestionModel;
  private adminService = new ServiceSuggestionsAdminService();

  /**
   * Create a new service suggestion (lounge only)
   */
  public async createServiceSuggestion(loungeId: string, data: CreateServiceSuggestionDto): Promise<ServiceSuggestion> {
    try {
      if (isEmpty(data) || !data.name) {
        logger.warn('ServiceSuggestionsService.createServiceSuggestion: invalid data provided');
        throw new BadRequestException('Service suggestion name is required', 'MISSING_SUGGESTION_NAME');
      }

      if (isEmpty(loungeId)) {
        logger.warn('ServiceSuggestionsService.createServiceSuggestion: loungeId not provided');
        throw new BadRequestException('Lounge ID is required to create a service suggestion', 'MISSING_LOUNGE_ID');
      }

      // Check if a similar suggestion already exists for this lounge (only pending suggestions block duplicates)
      const existingSuggestion = await this.serviceSuggestions.findOne({
        loungeId,
        name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
        status: ServiceSuggestionStatus.PENDING,
      });

      if (existingSuggestion) {
        logger.error(`ServiceSuggestionsService.createServiceSuggestion: similar suggestion already exists: ${data.name}`);
        throw new ConflictException('A similar service suggestion already exists for this lounge', 'SUGGESTION_ALREADY_EXISTS');
      }

      const newSuggestion = await this.serviceSuggestions.create({
        ...data,
        name: data.name.trim(),
        description: data.description?.trim(),
        loungeId,
        status: ServiceSuggestionStatus.PENDING,
      });

      logger.info(`ServiceSuggestionsService.createServiceSuggestion: created suggestion ${newSuggestion._id} - ${data.name} for lounge ${loungeId}`);
      return newSuggestion.toObject() as ServiceSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ServiceSuggestionsService.createServiceSuggestion', {
        duplicateMessage: 'A service suggestion with this information already exists.',
        fallbackMessage: 'Unable to create service suggestion at this time. Please try again later.',
        logMeta: { loungeId, data },
      });
    }
  }

  /**
   * Get all service suggestions with pagination and filtering
   */
  public async getServiceSuggestionsPaginated(
    page = 1,
    limit = 20,
    status?: ServiceSuggestionStatus,
    loungeId?: string,
  ): Promise<{ suggestions: ServiceSuggestion[]; total: number; page: number; totalPages: number }> {
    try {
      const skip = (page - 1) * limit;
      const filter: any = {};

      if (status) {
        filter.status = status;
      }

      if (loungeId) {
        filter.loungeId = loungeId;
      }

      const suggestions = await this.serviceSuggestions
        .find(filter)
        .populate('loungeId', 'email type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await this.serviceSuggestions.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);

      logger.info(
        `ServiceSuggestionsService.getServiceSuggestionsPaginated: retrieved ${suggestions.length} suggestions (page ${page}/${totalPages})`,
      );
      return { suggestions: suggestions as ServiceSuggestion[], total, page, totalPages };
    } catch (error) {
      logger.error(`ServiceSuggestionsService.getServiceSuggestionsPaginated error: ${error.message}`, {
        page,
        limit,
        status,
        loungeId,
        stack: error.stack,
      });
      throw new InternalServerException('Unable to retrieve service suggestions at this time. Please try again later.');
    }
  }

  /**
   * Get service suggestion by ID
   */
  public async getServiceSuggestionById(suggestionId: string): Promise<ServiceSuggestion> {
    try {
      if (isEmpty(suggestionId)) {
        logger.warn('ServiceSuggestionsService.getServiceSuggestionById: empty suggestionId provided');
        throw new BadRequestException('Service suggestion ID is required to retrieve the suggestion', 'MISSING_SUGGESTION_ID');
      }

      const suggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type').lean();

      if (!suggestion) {
        logger.error(`ServiceSuggestionsService.getServiceSuggestionById: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('The requested service suggestion could not be found', 'SUGGESTION_NOT_FOUND');
      }

      return suggestion as ServiceSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ServiceSuggestionsService.getServiceSuggestionById', {
        castMessage: 'Invalid service suggestion ID format',
        fallbackMessage: 'Unable to retrieve service suggestion at this time. Please try again later.',
        logMeta: { suggestionId },
      });
    }
  }

  /**
   * Update service suggestion
   */
  public async updateServiceSuggestion(suggestionId: string, loungeId: string, data: UpdateServiceSuggestionDto): Promise<ServiceSuggestion> {
    try {
      if (isEmpty(suggestionId) || isEmpty(data)) {
        logger.warn('ServiceSuggestionsService.updateServiceSuggestion: invalid parameters provided');
        throw new BadRequestException('Service suggestion ID and update data are required', 'MISSING_REQUIRED_FIELDS');
      }

      // Find the suggestion and verify ownership
      const suggestion = await this.serviceSuggestions.findById(suggestionId);
      if (!suggestion) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('The requested service suggestion could not be found', 'SUGGESTION_NOT_FOUND');
      }

      // Only allow updates if the suggestion is still pending and belongs to the lounge
      if (suggestion.loungeId.toString() !== loungeId) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion: unauthorized access to suggestion ${suggestionId} by lounge ${loungeId}`);
        throw new ForbiddenException('You can only update your own service suggestions', 'UNAUTHORIZED_ACCESS');
      }

      if (suggestion.status !== ServiceSuggestionStatus.PENDING) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion: cannot update suggestion ${suggestionId} with status ${suggestion.status}`);
        throw new BadRequestException('Only pending suggestions can be updated', 'INVALID_STATUS_FOR_UPDATE');
      }

      // Prepare update data
      const updateData: any = { ...data };
      if (data.name) {
        updateData.name = data.name.trim();
      }
      if (data.description !== undefined) {
        updateData.description = data.description?.trim();
      }

      const updatedSuggestion = await this.serviceSuggestions
        .findByIdAndUpdate(suggestionId, updateData, { new: true })
        .populate('loungeId', 'email type')
        .lean();

      if (!updatedSuggestion) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion: failed to update suggestion: ${suggestionId}`);
        throw new NotFoundException('The requested service suggestion could not be found', 'SUGGESTION_NOT_FOUND');
      }

      logger.info(`ServiceSuggestionsService.updateServiceSuggestion: updated suggestion ${suggestionId}`);
      return updatedSuggestion as ServiceSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ServiceSuggestionsService.updateServiceSuggestion', {
        castMessage: 'Invalid service suggestion ID format',
        fallbackMessage: 'Unable to update service suggestion at this time. Please try again later.',
        logMeta: { suggestionId, loungeId },
      });
    }
  }

  // --- Delegated to ServiceSuggestionsAdminService ---

  public async updateServiceSuggestionStatus(
    suggestionId: string,
    data: UpdateServiceSuggestionStatusDto,
  ): Promise<{ suggestion: ServiceSuggestion; service?: any; loungeService?: any }> {
    return this.adminService.updateServiceSuggestionStatus(suggestionId, data);
  }

  public async adminUpdateServiceSuggestionStatus(
    suggestionId: string,
    data: AdminApproveServiceSuggestionDto,
  ): Promise<{ suggestion: ServiceSuggestion; service?: any; loungeService?: any }> {
    return this.adminService.adminUpdateServiceSuggestionStatus(suggestionId, data);
  }

  /**
   * Delete service suggestion
   */
  public async deleteServiceSuggestion(suggestionId: string, loungeId?: string): Promise<ServiceSuggestion> {
    try {
      if (isEmpty(suggestionId)) {
        logger.warn('ServiceSuggestionsService.deleteServiceSuggestion: empty suggestionId provided');
        throw new BadRequestException('Service suggestion ID is required to delete the suggestion', 'MISSING_SUGGESTION_ID');
      }

      const filter: any = { _id: suggestionId };
      if (loungeId) {
        filter.loungeId = loungeId;
      }

      const deletedSuggestion = await this.serviceSuggestions.findOneAndDelete(filter).lean();

      if (!deletedSuggestion) {
        logger.error(`ServiceSuggestionsService.deleteServiceSuggestion: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('The requested service suggestion could not be found', 'SUGGESTION_NOT_FOUND');
      }

      logger.info(`ServiceSuggestionsService.deleteServiceSuggestion: deleted suggestion ${suggestionId}`);
      return deletedSuggestion as ServiceSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        throw new BadRequestException('Invalid service suggestion ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`ServiceSuggestionsService.deleteServiceSuggestion error: ${error.message}`, { suggestionId, loungeId, stack: error.stack });
      throw new InternalServerException('Unable to delete service suggestion at this time. Please try again later.');
    }
  }

  /**
   * Get service suggestions statistics
   */
  public async getServiceSuggestionsStats(): Promise<{
    total: number;
    pending: number;
    rejected: number;
    implemented: number;
  }> {
    try {
      const stats = await this.serviceSuggestions.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {
        total: 0,
        pending: 0,
        rejected: 0,
        implemented: 0,
      };

      stats.forEach((stat: any) => {
        result[stat._id] = stat.count;
        result.total += stat.count;
      });

      logger.info('ServiceSuggestionsService.getServiceSuggestionsStats: retrieved statistics');
      return result;
    } catch (error) {
      logger.error(`ServiceSuggestionsService.getServiceSuggestionsStats error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to retrieve service suggestions statistics at this time. Please try again later.');
    }
  }
}

export default ServiceSuggestionsService;
