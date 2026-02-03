import { ServiceSuggestion } from '@/interfaces/serviceSuggestion.interface';
import { CreateServiceSuggestionDto, UpdateServiceSuggestionDto, UpdateServiceSuggestionStatusDto, AdminApproveServiceSuggestionDto } from '@/dtos/serviceSuggestions.dto';
import serviceSuggestionModel from '@/models/serviceSuggestion.model';
import { HttpException, BadRequestException, NotFoundException, InternalServerException, ConflictException } from '@/exceptions/HttpException';
import { isEmpty } from '@/utils/util';
import { logger } from '@utils/logger';
import { ServiceSuggestionStatus } from '@/interfaces/serviceSuggestion.interface';
import { LoungeServiceStatus } from '@/interfaces/loungeService.interface';

class ServiceSuggestionsService {
  public serviceSuggestions = serviceSuggestionModel;

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
      return newSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle MongoDB validation errors
      if (error.name === 'ValidationError') {
        logger.error(`ServiceSuggestionsService.createServiceSuggestion validation error: ${error.message}`, { loungeId, data, stack: error.stack });
        throw new BadRequestException('Invalid service suggestion data provided. Please check all required fields.', 'VALIDATION_ERROR');
      }
      // Handle MongoDB duplicate key errors
      if (error.code === 11000) {
        logger.error(`ServiceSuggestionsService.createServiceSuggestion duplicate key error: ${error.message}`, { loungeId, data, stack: error.stack });
        throw new ConflictException('A service suggestion with this information already exists.', 'DUPLICATE_KEY_ERROR');
      }
      logger.error(`ServiceSuggestionsService.createServiceSuggestion error: ${error.message}`, { loungeId, data, stack: error.stack });
      throw new InternalServerException('Unable to create service suggestion at this time. Please try again later.');
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

      const suggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type');

      if (!suggestion) {
        logger.error(`ServiceSuggestionsService.getServiceSuggestionById: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('The requested service suggestion could not be found', 'SUGGESTION_NOT_FOUND');
      }

      return suggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`ServiceSuggestionsService.getServiceSuggestionById invalid ID format: ${suggestionId}`, { stack: error.stack });
        throw new BadRequestException('Invalid service suggestion ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`ServiceSuggestionsService.getServiceSuggestionById error: ${error.message}`, { suggestionId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve service suggestion at this time. Please try again later.');
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
        .populate('loungeId', 'email type');

      if (!updatedSuggestion) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion: failed to update suggestion: ${suggestionId}`);
        throw new NotFoundException('The requested service suggestion could not be found', 'SUGGESTION_NOT_FOUND');
      }

      logger.info(`ServiceSuggestionsService.updateServiceSuggestion: updated suggestion ${suggestionId}`);
      return updatedSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle MongoDB validation errors
      if (error.name === 'ValidationError') {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion validation error: ${error.message}`, { suggestionId, loungeId, stack: error.stack });
        throw new BadRequestException('Invalid service suggestion data provided. Please check all fields.', 'VALIDATION_ERROR');
      }
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestion invalid ID format: ${suggestionId}`, { stack: error.stack });
        throw new BadRequestException('Invalid service suggestion ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`ServiceSuggestionsService.updateServiceSuggestion error: ${error.message}`, { suggestionId, loungeId, stack: error.stack });
      throw new InternalServerException('Unable to update service suggestion at this time. Please try again later.');
    }
  }

  /**
   * Update service suggestion status (admin only)
   */
  public async updateServiceSuggestionStatus(suggestionId: string, data: UpdateServiceSuggestionStatusDto): Promise<{ suggestion: ServiceSuggestion; service?: any; loungeService?: any }> {
    try {
      // Validate required parameters
      if (isEmpty(suggestionId)) {
        logger.warn('ServiceSuggestionsService.updateServiceSuggestionStatus: empty suggestionId provided');
        throw new BadRequestException('Service suggestion ID is required to update status', 'MISSING_SUGGESTION_ID');
      }

      if (isEmpty(data) || !data.status) {
        logger.warn('ServiceSuggestionsService.updateServiceSuggestionStatus: invalid or missing status data');
        throw new BadRequestException('Status is required to update the service suggestion', 'MISSING_STATUS');
      }

      // Validate status value
      const validStatuses = Object.values(ServiceSuggestionStatus);
      if (!validStatuses.includes(data.status)) {
        logger.warn(`ServiceSuggestionsService.updateServiceSuggestionStatus: invalid status provided: ${data.status}`);
        throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 'INVALID_STATUS');
      }

      // Validate customization options if implementing
      if (data.status === ServiceSuggestionStatus.IMPLEMENTED) {
        if (!data.categoryId) {
          logger.warn(`ServiceSuggestionsService.updateServiceSuggestionStatus: categoryId required for implementation`);
          throw new BadRequestException('Category ID is required when implementing a service suggestion', 'MISSING_CATEGORY_ID');
        }

        if (!data.name || data.name.trim().length === 0) {
          logger.warn(`ServiceSuggestionsService.updateServiceSuggestionStatus: name required for implementation`);
          throw new BadRequestException('Service name is required when implementing a service suggestion', 'MISSING_SERVICE_NAME');
        }

        if (data.categoryId && !/^[0-9a-fA-F]{24}$/.test(data.categoryId)) {
          logger.warn(`ServiceSuggestionsService.updateServiceSuggestionStatus: invalid categoryId format: ${data.categoryId}`);
          throw new BadRequestException('Category ID must be a valid MongoDB ObjectId', 'INVALID_CATEGORY_ID_FORMAT');
        }

        if (data.price !== undefined && (data.price < 0 || !Number.isInteger(data.price))) {
          logger.warn(`ServiceSuggestionsService.updateServiceSuggestionStatus: invalid price: ${data.price}`);
          throw new BadRequestException('Price must be a non-negative integer (in cents)', 'INVALID_PRICE');
        }

        if (data.duration !== undefined && (data.duration < 15 || data.duration > 480)) {
          logger.warn(`ServiceSuggestionsService.updateServiceSuggestionStatus: invalid duration: ${data.duration}`);
          throw new BadRequestException('Duration must be between 15 and 480 minutes', 'INVALID_DURATION');
        }

        if (data.gender && !['men', 'women', 'unisex', 'kids'].includes(data.gender)) {
          logger.warn(`ServiceSuggestionsService.updateServiceSuggestionStatus: invalid gender: ${data.gender}`);
          throw new BadRequestException('Gender must be one of: men, women, unisex, kids', 'INVALID_GENDER');
        }
      }

      // Find the suggestion first
      const suggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type');
      if (!suggestion) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('The requested service suggestion could not be found. It may have been deleted or the ID is incorrect.', 'SUGGESTION_NOT_FOUND');
      }

      // Check if suggestion is already in the requested status
      if (suggestion.status === data.status) {
        logger.warn(`ServiceSuggestionsService.updateServiceSuggestionStatus: suggestion ${suggestionId} already has status ${data.status}`);
        throw new BadRequestException(`The service suggestion is already ${data.status.toLowerCase()}. No changes were made.`, 'STATUS_ALREADY_SET');
      }

      let createdService: any = null;
      let createdLoungeService: any = null;

      // If implementing the suggestion and customization options are provided, create service and lounge service
      if (data.status === ServiceSuggestionStatus.IMPLEMENTED && data.categoryId) {
        try {
          // Import required services
          const ServicesService = (await import('@services/services.service')).default;
          const LoungeServicesService = (await import('@services/loungeServices.service')).default;
          const servicesService = new ServicesService();
          const loungeServicesService = new LoungeServicesService();

          // Validate category exists
          const CategoryModel = (await import('@models/serviceCategory.model')).default;
          const category = await CategoryModel.findById(data.categoryId);
          if (!category) {
            logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: invalid category ID: ${data.categoryId}`);
            throw new BadRequestException('The specified service category does not exist. Please select a valid category.', 'INVALID_CATEGORY_ID');
          }

          // Create the service
          const serviceData = {
            name: data.name || suggestion.name, // Use custom name if provided, otherwise use suggestion name
            categoryId: data.categoryId,
            description: suggestion.description,
          };

          createdService = await servicesService.createService(serviceData);

          // Create the lounge service
          const loungeServiceData = {
            loungeId: suggestion.loungeId._id,
            serviceId: createdService._id,
            price: data.price || suggestion.estimatedPrice || 0,
            duration: data.duration || suggestion.estimatedDuration || 30,
            gender: data.gender || suggestion.targetGender || 'unisex',
            description: suggestion.description,
            status: LoungeServiceStatus.ACTIVE,
            isActive: true,
          };

          createdLoungeService = await loungeServicesService.createLoungeService(loungeServiceData);

          // Update suggestion status to implemented since we created the service
          await this.serviceSuggestions.findByIdAndUpdate(suggestionId, {
            status: ServiceSuggestionStatus.IMPLEMENTED,
            ...(data.adminNote && { adminNote: data.adminNote }),
          });

          logger.info(`ServiceSuggestionsService.updateServiceSuggestionStatus: implemented suggestion ${suggestionId}, created service ${createdService._id} and lounge service ${createdLoungeService._id}`);
        } catch (serviceError) {
          // Handle specific service creation errors
          if (serviceError instanceof ConflictException) {
            if (serviceError.message.includes('already exists')) {
              logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: service name conflict for suggestion ${suggestionId}: ${serviceError.message}`);
              throw new ConflictException('A service with this name already exists. Please modify the service name in the suggestion or choose a different name.', 'SERVICE_NAME_CONFLICT');
            }
          }
          if (serviceError instanceof BadRequestException) {
            logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: invalid service data for suggestion ${suggestionId}: ${serviceError.message}`);
            throw new BadRequestException('Invalid service configuration. Please check the category, duration, and other service details.', 'INVALID_SERVICE_DATA');
          }
          // Handle lounge service creation errors
          if (serviceError instanceof ConflictException && serviceError.message.includes('already offered')) {
            logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: lounge already offers this service for suggestion ${suggestionId}: ${serviceError.message}`);
            throw new ConflictException('This lounge already offers a similar service. The suggestion has been implemented but service creation failed.', 'LOUNGE_SERVICE_EXISTS');
          }

          // Re-throw other HttpExceptions as-is
          if (serviceError instanceof HttpException) {
            throw serviceError;
          }

          // Handle unexpected errors during service creation
          logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: unexpected error during service creation for suggestion ${suggestionId}: ${serviceError.message}`, { stack: serviceError.stack });
          throw new InternalServerException('Failed to create the service. The suggestion status has been updated, but service implementation encountered an error.', 'SERVICE_CREATION_FAILED');
        }
      } else {
        // Just update the status for other cases
        await this.serviceSuggestions.findByIdAndUpdate(suggestionId, {
          status: data.status,
          ...(data.adminNote && { adminNote: data.adminNote }),
        });

        logger.info(`ServiceSuggestionsService.updateServiceSuggestionStatus: updated suggestion ${suggestionId} status to ${data.status}`);
      }

      // Return the updated suggestion with created services if any
      const updatedSuggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type');
      return {
        suggestion: updatedSuggestion,
        service: createdService,
        loungeService: createdLoungeService,
      };
    } catch (error) {
      // Re-throw HttpExceptions as-is (they already have proper messages)
      if (error instanceof HttpException) throw error;

      // Handle MongoDB-specific errors
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: invalid ObjectId format: ${suggestionId}`, { stack: error.stack });
        throw new BadRequestException('Invalid service suggestion ID format. Please provide a valid ID.', 'INVALID_ID_FORMAT');
      }

      // Handle MongoDB connection errors
      if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: database connection error: ${error.message}`, { suggestionId, stack: error.stack });
        throw new InternalServerException('Database connection error. Please try again in a few moments.', 'DATABASE_CONNECTION_ERROR');
      }

      // Handle MongoDB validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((err: any) => err.message).join(', ');
        logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: validation error: ${validationErrors}`, { suggestionId, stack: error.stack });
        throw new BadRequestException(`Data validation failed: ${validationErrors}`, 'VALIDATION_ERROR');
      }

      // Handle duplicate key errors (though this shouldn't happen in this context)
      if (error.code === 11000) {
        logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: duplicate key error: ${error.message}`, { suggestionId, stack: error.stack });
        throw new ConflictException('A conflict occurred while updating the suggestion. Please try again.', 'DUPLICATE_KEY_ERROR');
      }

      // Handle any other unexpected errors
      logger.error(`ServiceSuggestionsService.updateServiceSuggestionStatus: unexpected error: ${error.message}`, { suggestionId, data, stack: error.stack });
      throw new InternalServerException('An unexpected error occurred while updating the service suggestion. Please try again or contact support if the problem persists.', 'UNEXPECTED_ERROR');
    }
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

      // If loungeId is provided, verify ownership
      const filter: any = { _id: suggestionId };
      if (loungeId) {
        filter.loungeId = loungeId;
      }

      const deletedSuggestion = await this.serviceSuggestions.findOneAndDelete(filter);

      if (!deletedSuggestion) {
        logger.error(`ServiceSuggestionsService.deleteServiceSuggestion: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('The requested service suggestion could not be found', 'SUGGESTION_NOT_FOUND');
      }

      logger.info(`ServiceSuggestionsService.deleteServiceSuggestion: deleted suggestion ${suggestionId}`);
      return deletedSuggestion;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`ServiceSuggestionsService.deleteServiceSuggestion invalid ID format: ${suggestionId}`, { stack: error.stack });
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

  /**
   * Admin function to update service suggestion status and create service/lounge service when approved
   */
  public async adminUpdateServiceSuggestionStatus(
    suggestionId: string,
    data: AdminApproveServiceSuggestionDto,
  ): Promise<{ suggestion: ServiceSuggestion; service?: any; loungeService?: any }> {
    try {
      if (isEmpty(suggestionId)) {
        logger.warn('ServiceSuggestionsService.adminUpdateServiceSuggestionStatus: empty suggestionId provided');
        throw new BadRequestException('Service suggestion ID is required', 'MISSING_SUGGESTION_ID');
      }

      // Find the suggestion
      const suggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type');
      if (!suggestion) {
        logger.error(`ServiceSuggestionsService.adminUpdateServiceSuggestionStatus: suggestion not found: ${suggestionId}`);
        throw new NotFoundException('The requested service suggestion could not be found', 'SUGGESTION_NOT_FOUND');
      }

      // Import required services
      const ServicesService = (await import('@services/services.service')).default;
      const LoungeServicesService = (await import('@services/loungeServices.service')).default;
      const servicesService = new ServicesService();
      const loungeServicesService = new LoungeServicesService();

      let createdService: any = null;
      let createdLoungeService: any = null;

      // If implementing the suggestion, create the service and lounge service
      if (data.status === ServiceSuggestionStatus.IMPLEMENTED) {
        // Validate required fields for implementation
        if (!data.name || data.name.trim().length === 0) {
          logger.warn(`ServiceSuggestionsService.adminUpdateServiceSuggestionStatus: name required for implementation`);
          throw new BadRequestException('Service name is required when implementing a service suggestion', 'MISSING_SERVICE_NAME');
        }

        // Create the service first
        const serviceData = {
          name: data.name, // Admin must provide name for implementation
          categoryId: data.categoryId,
          description: suggestion.description,
        };

        createdService = await servicesService.createService(serviceData);

        // Create the lounge service
        const loungeServiceData = {
          loungeId: suggestion.loungeId._id,
          serviceId: createdService._id,
          price: data.price || suggestion.estimatedPrice || 0, // Default to 0 if not provided
          duration: data.duration || suggestion.estimatedDuration || 30,
          gender: data.gender || suggestion.targetGender || 'unisex',
          description: suggestion.description,
          status: LoungeServiceStatus.ACTIVE,
          isActive: true,
        };

        createdLoungeService = await loungeServicesService.createLoungeService(loungeServiceData);

        // Update suggestion status to implemented since we created the service
        await this.serviceSuggestions.findByIdAndUpdate(suggestionId, {
          status: ServiceSuggestionStatus.IMPLEMENTED,
          adminNote: data.adminNote,
        });

        logger.info(`ServiceSuggestionsService.adminUpdateServiceSuggestionStatus: approved and implemented suggestion ${suggestionId}, created service ${createdService._id} and lounge service ${createdLoungeService._id}`);
      } else {
        // Just update the status for non-implemented statuses
        await this.serviceSuggestions.findByIdAndUpdate(suggestionId, {
          status: data.status,
          adminNote: data.adminNote,
        });

        logger.info(`ServiceSuggestionsService.adminUpdateServiceSuggestionStatus: updated suggestion ${suggestionId} to status ${data.status}`);
      }

      // Return the updated suggestion with populated data
      const updatedSuggestion = await this.serviceSuggestions.findById(suggestionId).populate('loungeId', 'email type');

      return {
        suggestion: updatedSuggestion,
        service: createdService,
        loungeService: createdLoungeService,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`ServiceSuggestionsService.adminUpdateServiceSuggestionStatus invalid ID format: ${suggestionId}`, { stack: error.stack });
        throw new BadRequestException('Invalid service suggestion ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`ServiceSuggestionsService.adminUpdateServiceSuggestionStatus error: ${error.message}`, { suggestionId, data, stack: error.stack });
      throw new InternalServerException('Unable to update service suggestion status at this time. Please try again later.');
    }
  }
}

export default ServiceSuggestionsService;
