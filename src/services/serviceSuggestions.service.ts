import { ServiceSuggestion } from '@/interfaces/serviceSuggestion.interface';
import { CreateServiceSuggestionDto, UpdateServiceSuggestionDto, UpdateServiceSuggestionStatusDto } from '@/dtos/serviceSuggestions.dto';
import serviceSuggestionModel from '@/models/serviceSuggestion.model';
import { HttpException, BadRequestException, NotFoundException, InternalServerException } from '@/exceptions/HttpException';
import { isEmpty } from '@/utils/util';
import { logger } from '@utils/logger';
import { ServiceSuggestionStatus } from '@/interfaces/serviceSuggestion.interface';

class ServiceSuggestionsService {
  public serviceSuggestions = serviceSuggestionModel;

  /**
   * Create a new service suggestion (lounge only)
   */
  public async createServiceSuggestion(loungeId: string, data: CreateServiceSuggestionDto): Promise<ServiceSuggestion> {
    try {
      if (isEmpty(data) || !data.name) {
        logger.warn('ServiceSuggestionsService.createServiceSuggestion: invalid data provided');
        throw new BadRequestException('Invalid request data. name is required');
      }

      if (isEmpty(loungeId)) {
        logger.warn('ServiceSuggestionsService.createServiceSuggestion: loungeId not provided');
        throw new BadRequestException('Lounge ID is required');
      }

      // Check if a similar suggestion already exists for this lounge
      const existingSuggestion = await this.serviceSuggestions.findOne({
        loungeId,
        name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
        status: { $in: [ServiceSuggestionStatus.PENDING, ServiceSuggestionStatus.APPROVED] },
      });

      if (existingSuggestion) {
        logger.error(`ServiceSuggestionsService.createServiceSuggestion: similar suggestion already exists: ${data.name}`);
        throw new BadRequestException('A similar service suggestion already exists');
      }

      const newSuggestion = await this.serviceSuggestions.create({
        ...data,
        name: data.name.trim(),
        description: data.description?.trim(),
        loungeId,
        status: ServiceSuggestionStatus.PENDING,
      });

      logger.info(`ServiceSuggestionsService.createServiceSuggestion: created suggestion ${newSuggestion._id} - ${data.name} for lounge ${loungeId}`);
      return newSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceSuggestionsService.createServiceSuggestion error: ${error.message}`, { loungeId, data, stack: error.stack });
      throw new InternalServerException('Failed to create service suggestion');
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
        .limit(limit);

      const total = await this.serviceSuggestions.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);

      logger.info(
        `ServiceSuggestionsService.getServiceSuggestionsPaginated: retrieved ${suggestions.length} suggestions (page ${page}/${totalPages})`,
      );
      return { suggestions, total, page, totalPages };
    } catch (error) {
      logger.error(`ServiceSuggestionsService.getServiceSuggestionsPaginated error: ${error.message}`, {
        page,
        limit,
        status,
        loungeId,
        stack: error.stack,
      });
      throw new InternalServerException('Failed to retrieve service suggestions');
    }
  }

  /**
   * Get service suggestion by ID
   */
  public async getServiceSuggestionById(suggestionId: string): Promise<ServiceSuggestion> {
    try {
      if (isEmpty(suggestionId)) {
        logger.warn('ServiceSuggestionsService.getServiceSuggestionById: empty suggestionId provided');
        throw new BadRequestException('Invalid request data');
      }

      const suggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type');

      if (!suggestion) {
        logger.error(`ServiceSuggestionsService.getServiceSuggestionById: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('Service suggestion not found');
      }

      return suggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceSuggestionsService.getServiceSuggestionById error: ${error.message}`, { suggestionId, stack: error.stack });
      throw new InternalServerException('Failed to retrieve service suggestion');
    }
  }

  /**
   * Update service suggestion
   */
  public async updateServiceSuggestion(suggestionId: string, loungeId: string, data: UpdateServiceSuggestionDto): Promise<ServiceSuggestion> {
    try {
      if (isEmpty(suggestionId) || isEmpty(data)) {
        logger.warn('ServiceSuggestionsService.updateServiceSuggestion: invalid parameters provided');
        throw new BadRequestException('Invalid request data');
      }

      // Find the suggestion and verify ownership
      const suggestion = await this.serviceSuggestions.findById(suggestionId);
      if (!suggestion) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('Service suggestion not found');
      }

      // Only allow updates if the suggestion is still pending and belongs to the lounge
      if (suggestion.loungeId.toString() !== loungeId) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion: unauthorized access to suggestion ${suggestionId} by lounge ${loungeId}`);
        throw new BadRequestException('You can only update your own suggestions');
      }

      if (suggestion.status !== ServiceSuggestionStatus.PENDING) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion: cannot update suggestion ${suggestionId} with status ${suggestion.status}`);
        throw new BadRequestException('Can only update pending suggestions');
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
        .populate('loungeId', 'email type');

      if (!updatedSuggestion) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion: failed to update suggestion: ${suggestionId}`);
        throw new NotFoundException('Service suggestion not found');
      }

      logger.info(`ServiceSuggestionsService.updateServiceSuggestion: updated suggestion ${suggestionId}`);
      return updatedSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceSuggestionsService.updateServiceSuggestion error: ${error.message}`, { suggestionId, loungeId, stack: error.stack });
      throw new InternalServerException('Failed to update service suggestion');
    }
  }

  /**
   * Update service suggestion status (admin only)
   */
  public async updateServiceSuggestionStatus(suggestionId: string, data: UpdateServiceSuggestionStatusDto): Promise<ServiceSuggestion> {
    try {
      if (isEmpty(suggestionId) || isEmpty(data)) {
        logger.warn('ServiceSuggestionsService.updateServiceSuggestionStatus: invalid parameters provided');
        throw new BadRequestException('Invalid request data');
      }

      const updatedSuggestion = await this.serviceSuggestions
        .findByIdAndUpdate(
          suggestionId,
          {
            status: data.status,
            ...(data.adminNote && { adminNote: data.adminNote }),
          },
          { new: true },
        )
        .populate('loungeId', 'email type');

      if (!updatedSuggestion) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('Service suggestion not found');
      }

      logger.info(`ServiceSuggestionsService.updateServiceSuggestionStatus: updated suggestion ${suggestionId} status to ${data.status}`);
      return updatedSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus error: ${error.message}`, { suggestionId, data, stack: error.stack });
      throw new InternalServerException('Failed to update service suggestion status');
    }
  }

  /**
   * Delete service suggestion
   */
  public async deleteServiceSuggestion(suggestionId: string, loungeId?: string): Promise<ServiceSuggestion> {
    try {
      if (isEmpty(suggestionId)) {
        logger.warn('ServiceSuggestionsService.deleteServiceSuggestion: empty suggestionId provided');
        throw new BadRequestException('Invalid request data');
      }

      // If loungeId is provided, verify ownership
      const filter: any = { _id: suggestionId };
      if (loungeId) {
        filter.loungeId = loungeId;
      }

      const deletedSuggestion = await this.serviceSuggestions.findOneAndDelete(filter);

      if (!deletedSuggestion) {
        logger.error(`ServiceSuggestionsService.deleteServiceSuggestion: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('Service suggestion not found');
      }

      logger.info(`ServiceSuggestionsService.deleteServiceSuggestion: deleted suggestion ${suggestionId}`);
      return deletedSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ServiceSuggestionsService.deleteServiceSuggestion error: ${error.message}`, { suggestionId, loungeId, stack: error.stack });
      throw new InternalServerException('Failed to delete service suggestion');
    }
  }

  /**
   * Get service suggestions statistics
   */
  public async getServiceSuggestionsStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
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
        approved: 0,
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
      throw new InternalServerException('Failed to retrieve service suggestions statistics');
    }
  }
}

export default ServiceSuggestionsService;
