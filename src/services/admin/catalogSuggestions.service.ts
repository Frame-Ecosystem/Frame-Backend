import { ServiceSuggestion, ServiceSuggestionStatus } from '@interfaces/catalog/serviceSuggestion.interface';
import { LoungeServiceStatus } from '@interfaces/lounge/loungeService.interface';
import { UpdateServiceSuggestionStatusDto, AdminApproveServiceSuggestionDto } from '@dtos/catalog/serviceSuggestions.dto';
import serviceSuggestionModel from '@models/catalog/serviceSuggestion.model';
import NotificationService from '@services/realtime/notification.service';
import { HttpException, BadRequestException, NotFoundException, InternalServerException, ConflictException } from '@exceptions/HttpException';
import { isEmpty, handleMongooseError } from '@utils/util';
import { logger } from '@utils/logger';

class CatalogSuggestionsService {
  private serviceSuggestions = serviceSuggestionModel;
  private notificationService = NotificationService.getInstance();

  /**
   * Update service suggestion status (admin only).
   * If implementing, creates a new service + lounge service.
   */
  public async updateServiceSuggestionStatus(
    suggestionId: string,
    data: UpdateServiceSuggestionStatusDto,
  ): Promise<{ suggestion: ServiceSuggestion; service?: any; loungeService?: any }> {
    try {
      if (isEmpty(suggestionId)) {
        throw new BadRequestException('Service suggestion ID is required to update status', 'MISSING_SUGGESTION_ID');
      }
      if (isEmpty(data) || !data.status) {
        throw new BadRequestException('Status is required to update the service suggestion', 'MISSING_STATUS');
      }

      const validStatuses = Object.values(ServiceSuggestionStatus);
      if (!validStatuses.includes(data.status)) {
        throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 'INVALID_STATUS');
      }

      this.validateImplementationFields(data);

      const suggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type');
      if (!suggestion) {
        throw new NotFoundException(
          'The requested service suggestion could not be found. It may have been deleted or the ID is incorrect.',
          'SUGGESTION_NOT_FOUND',
        );
      }

      if (suggestion.status === data.status) {
        throw new BadRequestException(`The service suggestion is already ${data.status.toLowerCase()}. No changes were made.`, 'STATUS_ALREADY_SET');
      }

      let createdService: any = null;
      let createdLoungeService: any = null;

      if (data.status === ServiceSuggestionStatus.IMPLEMENTED && data.categoryId) {
        const result = await this.implementSuggestion(suggestion, {
          name: data.name || suggestion.name,
          categoryId: data.categoryId,
          price: data.price,
          duration: data.duration,
          gender: data.gender,
          adminNote: data.adminNote,
        });
        createdService = result.service;
        createdLoungeService = result.loungeService;
      } else {
        await this.serviceSuggestions.findByIdAndUpdate(suggestionId, {
          status: data.status,
          ...(data.adminNote && { adminNote: data.adminNote }),
        });
        logger.info(`CatalogSuggestionsService.updateStatus: updated suggestion ${suggestionId} status to ${data.status}`);
      }

      const updatedSuggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type').lean();

      // Notify lounge about suggestion status change
      const loungeId = (suggestion.loungeId as any)?._id?.toString() || suggestion.loungeId?.toString();
      if (loungeId && data.status !== ServiceSuggestionStatus.PENDING) {
        if (data.status === ServiceSuggestionStatus.IMPLEMENTED) {
          this.notificationService.notifySuggestionApproved(loungeId, suggestion.name, suggestionId).catch(() => {});
        } else if (data.status === ServiceSuggestionStatus.REJECTED) {
          this.notificationService.notifySuggestionRejected(loungeId, suggestion.name, suggestionId, data.adminNote).catch(() => {});
        }
      }

      return {
        suggestion: updatedSuggestion as ServiceSuggestion,
        service: createdService,
        loungeService: createdLoungeService,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'CatalogSuggestionsService.updateStatus', {
        duplicateMessage: 'A conflict occurred while updating the suggestion. Please try again.',
        fallbackMessage:
          'An unexpected error occurred while updating the service suggestion. Please try again or contact support if the problem persists.',
        logMeta: { suggestionId, data },
      });
    }
  }

  /**
   * Admin function: update suggestion status and optionally create service/lounge service when approved.
   */
  public async adminUpdateServiceSuggestionStatus(
    suggestionId: string,
    data: AdminApproveServiceSuggestionDto,
  ): Promise<{ suggestion: ServiceSuggestion; service?: any; loungeService?: any }> {
    try {
      if (isEmpty(suggestionId)) {
        throw new BadRequestException('Service suggestion ID is required', 'MISSING_SUGGESTION_ID');
      }

      const suggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type');
      if (!suggestion) {
        throw new NotFoundException('The requested service suggestion could not be found', 'SUGGESTION_NOT_FOUND');
      }

      let createdService: any = null;
      let createdLoungeService: any = null;

      if (data.status === ServiceSuggestionStatus.IMPLEMENTED) {
        if (!data.name || data.name.trim().length === 0) {
          throw new BadRequestException('Service name is required when implementing a service suggestion', 'MISSING_SERVICE_NAME');
        }

        const result = await this.implementSuggestion(suggestion, {
          name: data.name,
          categoryId: data.categoryId,
          price: data.price,
          duration: data.duration,
          gender: data.gender,
          adminNote: data.adminNote,
        });
        createdService = result.service;
        createdLoungeService = result.loungeService;
      } else {
        await this.serviceSuggestions.findByIdAndUpdate(suggestionId, {
          status: data.status,
          adminNote: data.adminNote,
        });
        logger.info(`CatalogSuggestionsService.adminUpdateStatus: updated suggestion ${suggestionId} to status ${data.status}`);
      }

      const updatedSuggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type').lean();

      // Notify lounge about suggestion status change
      const loungeId = (suggestion.loungeId as any)?._id?.toString() || suggestion.loungeId?.toString();
      if (loungeId && data.status !== ServiceSuggestionStatus.PENDING) {
        if (data.status === ServiceSuggestionStatus.IMPLEMENTED) {
          this.notificationService.notifySuggestionApproved(loungeId, suggestion.name, suggestionId).catch(() => {});
        } else if (data.status === ServiceSuggestionStatus.REJECTED) {
          this.notificationService.notifySuggestionRejected(loungeId, suggestion.name, suggestionId, data.adminNote).catch(() => {});
        }
      }

      return {
        suggestion: updatedSuggestion as ServiceSuggestion,
        service: createdService,
        loungeService: createdLoungeService,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        throw new BadRequestException('Invalid service suggestion ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`CatalogSuggestionsService.adminUpdateStatus error: ${error.message}`, { suggestionId, data, stack: error.stack });
      throw new InternalServerException('Unable to update service suggestion status at this time. Please try again later.');
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  /**
   * Validate fields required for implementation status.
   */
  private validateImplementationFields(data: UpdateServiceSuggestionStatusDto): void {
    if (data.status !== ServiceSuggestionStatus.IMPLEMENTED) return;

    if (!data.categoryId) {
      throw new BadRequestException('Category ID is required when implementing a service suggestion', 'MISSING_CATEGORY_ID');
    }
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Service name is required when implementing a service suggestion', 'MISSING_SERVICE_NAME');
    }
    if (data.categoryId && !/^[0-9a-fA-F]{24}$/.test(data.categoryId)) {
      throw new BadRequestException('Category ID must be a valid MongoDB ObjectId', 'INVALID_CATEGORY_ID_FORMAT');
    }
    if (data.price !== undefined && (data.price < 0 || !Number.isInteger(data.price))) {
      throw new BadRequestException('Price must be a non-negative integer (in cents)', 'INVALID_PRICE');
    }
    if (data.duration !== undefined && (data.duration < 15 || data.duration > 480)) {
      throw new BadRequestException('Duration must be between 15 and 480 minutes', 'INVALID_DURATION');
    }
    if (data.gender && !['men', 'women', 'unisex', 'kids'].includes(data.gender)) {
      throw new BadRequestException('Gender must be one of: men, women, unisex, kids', 'INVALID_GENDER');
    }
  }

  /**
   * Shared logic: create a service + lounge service from an approved suggestion.
   */
  private async implementSuggestion(
    suggestion: any,
    opts: { name: string; categoryId: string; price?: number; duration?: number; gender?: string; adminNote?: string },
  ): Promise<{ service: any; loungeService: any }> {
    try {
      const ServicesService = (await import('@services/catalog/services.service')).default;
      const LoungeServicesService = (await import('@services/lounge/loungeServices.service')).default;
      const servicesService = new ServicesService();
      const loungeServicesService = new LoungeServicesService();

      const CategoryModel = (await import('@models/catalog/serviceCategory.model')).default;
      const category = await CategoryModel.findById(opts.categoryId);
      if (!category) {
        throw new BadRequestException('The specified service category does not exist. Please select a valid category.', 'INVALID_CATEGORY_ID');
      }

      const createdService = await servicesService.createService({
        name: opts.name,
        categoryId: opts.categoryId,
        description: suggestion.description,
      });

      const createdLoungeService = await loungeServicesService.createLoungeService({
        loungeId: (suggestion.loungeId as any)._id,
        serviceId: createdService._id,
        price: opts.price || suggestion.estimatedPrice || 0,
        duration: opts.duration || suggestion.estimatedDuration || 30,
        gender: opts.gender || suggestion.targetGender || 'unisex',
        description: suggestion.description,
        status: LoungeServiceStatus.ACTIVE,
        isActive: true,
      } as any);

      await this.serviceSuggestions.findByIdAndUpdate(suggestion._id, {
        status: ServiceSuggestionStatus.IMPLEMENTED,
        ...(opts.adminNote && { adminNote: opts.adminNote }),
      });

      logger.info(
        `CatalogSuggestionsService: implemented suggestion ${suggestion._id}, created service ${createdService._id} and lounge service ${createdLoungeService._id}`,
      );

      return { service: createdService, loungeService: createdLoungeService };
    } catch (serviceError) {
      if (serviceError instanceof ConflictException && serviceError.message.includes('already exists')) {
        throw new ConflictException(
          'A service with this name already exists. Please modify the service name or choose a different name.',
          'SERVICE_NAME_CONFLICT',
        );
      }
      if (serviceError instanceof ConflictException && serviceError.message.includes('already offered')) {
        throw new ConflictException('This lounge already offers a similar service.', 'LOUNGE_SERVICE_EXISTS');
      }
      if (serviceError instanceof BadRequestException) {
        throw new BadRequestException(
          'Invalid service configuration. Please check the category, duration, and other service details.',
          'INVALID_SERVICE_DATA',
        );
      }
      if (serviceError instanceof HttpException) throw serviceError;

      logger.error(`CatalogSuggestionsService.implementSuggestion: error: ${serviceError.message}`, { stack: serviceError.stack });
      throw new InternalServerException(
        'Failed to create the service. The suggestion status has been updated, but service implementation encountered an error.',
        'SERVICE_CREATION_FAILED',
      );
    }
  }
}

export default CatalogSuggestionsService;
