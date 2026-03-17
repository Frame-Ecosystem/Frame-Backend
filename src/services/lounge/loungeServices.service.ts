import { LoungeService, LoungeServiceStatus } from '@interfaces/lounge/loungeService.interface';
import { User } from '@interfaces/user/users.interface';
import loungeServiceModel from '@models/lounge/loungeService.model';
import serviceModel from '@models/catalog/service.model';
import agentModel from '@models/user/agent.model';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { isEmpty, handleMongooseError } from '@utils/util';
import { logger } from '@utils/logger';
import { CreateLoungeServiceDto, UpdateLoungeServiceDto } from '@dtos/lounge/loungeServices.dto';
import R2Service from '@services/cloudflare-r2.service';
import LoungeServicesAdminService from '@services/lounge/loungeServices-admin.service';
import LoungeProfileService from '@services/lounge/lounge.service';

class LoungeServicesService {
  public loungeServices = loungeServiceModel;
  public services = serviceModel;
  private agents = agentModel;
  private adminService = new LoungeServicesAdminService();
  private loungeService = new LoungeProfileService();

  /**
   * Sync agent ↔ loungeService assignments.
   * Adds loungeServiceId to newly assigned agents' idLoungeService,
   * removes it from agents that were unassigned.
   */
  private async syncAgentAssignments(loungeServiceId: string, newAgentIds: string[] = [], oldAgentIds: string[] = []): Promise<void> {
    const toAdd = newAgentIds.filter(id => !oldAgentIds.includes(id));
    const toRemove = oldAgentIds.filter(id => !newAgentIds.includes(id));

    const ops: Promise<any>[] = [];

    if (toAdd.length > 0) {
      ops.push(
        this.agents.updateMany(
          { _id: { $in: toAdd } },
          { $addToSet: { idLoungeService: loungeServiceId } },
        ),
      );
    }

    if (toRemove.length > 0) {
      ops.push(
        this.agents.updateMany(
          { _id: { $in: toRemove } },
          { $pull: { idLoungeService: loungeServiceId } },
        ),
      );
    }

    if (ops.length > 0) {
      await Promise.all(ops);
      logger.info(`LoungeServicesService.syncAgentAssignments: service ${loungeServiceId} — added to ${toAdd.length}, removed from ${toRemove.length} agents`);
    }
  }

  
  public async createLoungeService(data: CreateLoungeServiceDto, file?: Express.Multer.File): Promise<LoungeService> {
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

      // Create the lounge service first without image
      const createData = {
        loungeId: data.loungeId,
        serviceId: data.serviceId,
        agentIds: data.agentIds || [],
        price: data.price,
        duration: data.duration,
        gender: data.gender,
        status: data.status,
        description: data.description,
        isActive: data.isActive !== undefined ? data.isActive : true,
      };
      const newLoungeService = await this.loungeServices.create(createData);

      // Handle image upload (either from file or base64) after creating the service
      let imageData = {};
      if (file || data.image) {
        try {
          let imageBuffer: Buffer;
          const fileName = newLoungeService._id;

          if (data.image) {
            // Handle base64 image
            const base64Data = data.image.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else if (file) {
            // Handle file upload
            imageBuffer = file.buffer;
          }

          if (imageBuffer) {
            // Upload new image
            const { url, publicId } = await R2Service.uploadLoungeServiceImage(imageBuffer, fileName);
            imageData = {
              image: {
                url,
                publicId,
              },
            };
          }
        } catch (imageError) {
          logger.warn(`LoungeServicesService.createLoungeService: image upload failed: ${imageError.message}`);
          // Continue with creation even if image upload fails
        }
      }

      // Update the service with image if upload was successful
      if (Object.keys(imageData).length > 0) {
        await this.loungeServices.findByIdAndUpdate(newLoungeService._id, imageData);
      }

      // Fetch final lounge service
      const finalLoungeService = await this.loungeServices.findById(newLoungeService._id).populate('loungeId').populate('serviceId').populate('agentIds', 'agentName profileImage');

      // Sync agent assignments
      if (data.agentIds && data.agentIds.length > 0) {
        await this.syncAgentAssignments(newLoungeService._id.toString(), data.agentIds, []);
      }

      logger.info(`LoungeServicesService.createLoungeService: created service ${newLoungeService._id} for lounge ${data.loungeId}`);
      return finalLoungeService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'LoungeServicesService.createLoungeService', {
        duplicateMessage: 'This service is already offered by this lounge.',
        fallbackMessage: 'Unable to create lounge service at this time. Please try again later.',
        logMeta: { data },
      });
    }
  }

  
  public async getAllLoungeServices(): Promise<LoungeService[]> {
    try {
      const services = await this.loungeServices.find().populate('loungeId').populate('serviceId').populate('agentIds', 'agentName profileImage');
      logger.info(`LoungeServicesService.getAllLoungeServices: retrieved ${services.length} services`);
      return services;
    } catch (error) {
      logger.error(`LoungeServicesService.getAllLoungeServices error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to retrieve lounge services at this time. Please try again later.');
    }
  }

  
  public async getLoungeServicesByLoungeId(loungeId: string): Promise<LoungeService[]> {
    try {
      if (isEmpty(loungeId)) {
        logger.warn('LoungeServicesService.getLoungeServicesByLoungeId: empty loungeId provided');
        throw new BadRequestException('Lounge ID is required to retrieve lounge services', 'MISSING_LOUNGE_ID');
      }

      const services = await this.loungeServices.find({ loungeId }).populate('serviceId').populate('agentIds', 'agentName profileImage');
      logger.info(`LoungeServicesService.getLoungeServicesByLoungeId: retrieved ${services.length} services for lounge ${loungeId}`);
      return services;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'LoungeServicesService.getLoungeServicesByLoungeId', {
        castMessage: 'Invalid lounge ID format',
        fallbackMessage: 'Unable to retrieve lounge services at this time. Please try again later.',
        logMeta: { loungeId },
      });
    }
  }

  
  public async getLoungeServiceById(serviceId: string): Promise<LoungeService> {
    try {
      if (isEmpty(serviceId)) {
        logger.warn('LoungeServicesService.getLoungeServiceById: empty serviceId provided');
        throw new BadRequestException('Lounge service ID is required to retrieve the service', 'MISSING_SERVICE_ID');
      }

      const service = await this.loungeServices.findById(serviceId).populate('loungeId').populate('serviceId').populate('agentIds', 'agentName profileImage');

      if (!service) {
        logger.error(`LoungeServicesService.getLoungeServiceById: service not found: ${serviceId}`);
        throw new NotFoundException('The requested lounge service could not be found', 'LOUNGE_SERVICE_NOT_FOUND');
      }

      return service;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'LoungeServicesService.getLoungeServiceById', {
        castMessage: 'Invalid lounge service ID format',
        fallbackMessage: 'Unable to retrieve lounge service at this time. Please try again later.',
        logMeta: { serviceId },
      });
    }
  }

  
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
      handleMongooseError(error, 'LoungeServicesService.getServiceNameById', {
        castMessage: 'Invalid service ID format',
        fallbackMessage: 'Unable to retrieve service name at this time. Please try again later.',
        logMeta: { serviceId },
      });
    }
  }

  
  public async updateLoungeService(serviceId: string, data: UpdateLoungeServiceDto, user?: User, file?: Express.Multer.File): Promise<LoungeService> {
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
          logger.warn(
            `LoungeServicesService.updateLoungeService: lounge user ${user._id} attempted to update service ${serviceId} owned by ${existingService.loungeId}`,
          );
          throw new HttpException(403, 'You can only update your own lounge services');
        }

        // Lounge users can update all fields of their own services
      }

      // Capture old agent assignments before the update for sync
      let oldAgentIds: string[] = [];
      if (data.agentIds !== undefined) {
        const currentService = await this.loungeServices.findById(serviceId);
        oldAgentIds = (currentService as any)?.agentIds?.map((id: any) => id.toString()) || [];
      }

      // Handle image upload (either from file or base64) before updating the service
      let imageData = {};
      if (file || data.image) {
        try {
          let imageBuffer: Buffer;
          const fileName = serviceId;

          if (data.image) {
            // Handle base64 image
            const base64Data = data.image.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else if (file) {
            // Handle file upload
            imageBuffer = file.buffer;
          }

          if (imageBuffer) {
            // Delete existing image if it exists
            const existingService = await this.loungeServices.findById(serviceId);
            if (existingService?.image?.publicId) {
              try {
                await R2Service.deleteLoungeServiceImage(existingService.image.publicId);
              } catch (deleteError) {
                logger.warn(`LoungeServicesService.updateLoungeService: failed to delete old image: ${deleteError.message}`);
                // Continue with upload even if delete fails
              }
            }

            // Upload new image
            const { url, publicId } = await R2Service.uploadLoungeServiceImage(imageBuffer, fileName);
            imageData = {
              image: {
                url,
                publicId,
              },
            };
          }
        } catch (imageError) {
          logger.warn(`LoungeServicesService.updateLoungeService: image upload failed: ${imageError.message}`);
          // Continue with update even if image upload fails
        }
      }

      const updatedService = await this.loungeServices
        .findByIdAndUpdate(serviceId, { ...data, ...imageData }, { new: true })
        .populate('loungeId')
        .populate('serviceId')
        .populate('agentIds', 'agentName profileImage');

      if (!updatedService) {
        logger.error(`LoungeServicesService.updateLoungeService: service not found: ${serviceId}`);
        throw new NotFoundException('The requested lounge service could not be found', 'LOUNGE_SERVICE_NOT_FOUND');
      }

      // Sync agent assignments if agentIds were provided
      if (data.agentIds !== undefined) {
        await this.syncAgentAssignments(serviceId, data.agentIds, oldAgentIds);
      }

      logger.info(`LoungeServicesService.updateLoungeService: updated service ${serviceId}`);
      return updatedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'LoungeServicesService.updateLoungeService', {
        castMessage: 'Invalid lounge service ID format',
        fallbackMessage: 'Unable to update lounge service at this time. Please try again later.',
        logMeta: { serviceId },
      });
    }
  }

  
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

      // Remove this service from all agents that had it
      const oldAgentIds = (deletedService as any).agentIds?.map((id: any) => id.toString()) || [];
      if (oldAgentIds.length > 0) {
        await this.syncAgentAssignments(serviceId, [], oldAgentIds);
      }

      logger.info(`LoungeServicesService.deleteLoungeService: deleted service ${serviceId}`);
      return deletedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'LoungeServicesService.deleteLoungeService', {
        castMessage: 'Invalid lounge service ID format',
        fallbackMessage: 'Unable to delete lounge service at this time. Please try again later.',
        logMeta: { serviceId },
      });
    }
  }

  
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
        .populate('serviceId')
        .populate('agentIds', 'agentName profileImage');

      logger.info(`LoungeServicesService.toggleLoungeServiceStatus: toggled service ${serviceId} to ${newStatus}`);
      return updatedService;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'LoungeServicesService.toggleLoungeServiceStatus', {
        castMessage: 'Invalid lounge service ID format',
        fallbackMessage: 'Unable to toggle lounge service status at this time. Please try again later.',
        logMeta: { serviceId },
      });
    }
  }

  // --- Delegated to LoungeServicesAdminService ---

  public async getLoungeServicesPaginated(page = 1, limit = 20): Promise<{ services: LoungeService[]; total: number }> {
    return this.adminService.getLoungeServicesPaginated(page, limit);
  }

  public async bulkCreateLoungeServices(data: CreateLoungeServiceDto[]): Promise<LoungeService[]> {
    return this.adminService.bulkCreateLoungeServices(data);
  }

  public async searchLoungeServices(query: string): Promise<LoungeService[]> {
    return this.adminService.searchLoungeServices(query);
  }

  // --- Delegated to LoungeService ---

  public async patchLoungeOpeningHours(loungeId: string, openingHoursData: import('@dtos/user/users.dto').DayOpeningHoursDto): Promise<User> {
    return this.loungeService.patchLoungeOpeningHours(loungeId, openingHoursData);
  }

  public async updateLoungeProfile(loungeId: string, loungeData: import('@dtos/user/users.dto').UpdateLoungeProfileDto): Promise<User> {
    return this.loungeService.updateLoungeProfile(loungeId, loungeData);
  }

  public async getAgentsPerLounge(loungeId: string, requestingUser: any): Promise<any> {
    return this.loungeService.getAgentsPerLounge(loungeId, requestingUser);
  }
}

export default LoungeServicesService;
