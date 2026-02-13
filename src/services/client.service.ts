import { User } from '@interfaces/users.interface';
import { LoungeService } from '@interfaces/loungeService.interface';
import userModel from '@models/users.model';
import loungeServiceModel from '@models/loungeService.model';
import { HttpException, BadRequestException, InternalServerException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';

interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  gender?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedLoungesResponse {
  lounges: User[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

class ClientService {
  public users = userModel;
  public loungeServices = loungeServiceModel;

  /**
   * Get all lounges with pagination (for clients to browse)
   */
  public async getAllLounges(params: PaginationParams): Promise<PaginatedLoungesResponse> {
    try {
      const { page = 1, limit = 10, search = '', gender, sortBy = 'createdAt', sortOrder = 'desc' } = params;

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        logger.warn('ClientService.getAllLounges: invalid pagination parameters', { page, limit });
        throw new BadRequestException('Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100', 'INVALID_PAGINATION');
      }

      // Build query filter
      const filter: any = {
        type: 'lounge',
        isBlocked: { $ne: true }, // Exclude blocked lounges
      };

      // Add search filter (search in loungeTitle, firstName, lastName, bio)
      if (search) {
        filter.$or = [
          { loungeTitle: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { bio: { $regex: search, $options: 'i' } },
        ];
      }

      // Add gender filter
      if (gender && ['male', 'female', 'unisex', 'kids'].includes(gender)) {
        filter.gender = gender;
      }

      // Build sort object
      const sort: any = {};
      const validSortFields = ['createdAt', 'loungeTitle', 'firstName', 'lastName'];
      if (validSortFields.includes(sortBy)) {
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sort.createdAt = -1; // Default sort
      }

      // Calculate skip value
      const skip = (page - 1) * limit;

      // Execute query with pagination
      const [lounges, totalItems] = await Promise.all([
        this.users
          .find(filter)
          .select('-password -refreshTokens -emailVerification -oauth') // Exclude sensitive fields
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.users.countDocuments(filter),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.info(`ClientService.getAllLounges: retrieved ${lounges.length} lounges (page ${page}/${totalPages})`);

      return {
        lounges: lounges as User[],
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ClientService.getAllLounges error: ${error.message}`, { params, stack: error.stack });
      throw new InternalServerException('Unable to retrieve lounges at this time. Please try again later.');
    }
  }

  /**
   * Get lounge details by ID (for clients to view lounge profile)
   */
  public async getLoungeById(loungeId: string): Promise<User> {
    try {
      if (!loungeId) {
        logger.warn('ClientService.getLoungeById: empty loungeId provided');
        throw new BadRequestException('Lounge ID is required', 'MISSING_LOUNGE_ID');
      }

      const lounge = await this.users
        .findOne({
          _id: loungeId,
          type: 'lounge',
          isBlocked: { $ne: true },
        })
        .select('-password -refreshTokens -emailVerification -oauth')
        .lean()
        .exec();

      if (!lounge) {
        logger.info(`ClientService.getLoungeById: lounge not found: ${loungeId}`);
        throw new BadRequestException('Lounge not found or not available', 'LOUNGE_NOT_FOUND');
      }

      logger.info(`ClientService.getLoungeById: retrieved lounge: ${loungeId}`);
      return lounge as User;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`ClientService.getLoungeById invalid ID format: ${loungeId}`, { stack: error.stack });
        throw new BadRequestException('Invalid lounge ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`ClientService.getLoungeById error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve lounge details at this time. Please try again later.');
    }
  }

  /**
   * Get all services offered by a specific lounge (for clients to view available services)
   */
  public async getLoungeServicesById(loungeId: string): Promise<LoungeService[]> {
    try {
      if (!loungeId) {
        logger.warn('ClientService.getLoungeServicesById: empty loungeId provided');
        throw new BadRequestException('Lounge ID is required', 'MISSING_LOUNGE_ID');
      }

      // Verify lounge exists and is not blocked
      const lounge = await this.users.findOne({
        _id: loungeId,
        type: 'lounge',
        isBlocked: { $ne: true },
      });

      if (!lounge) {
        logger.info(`ClientService.getLoungeServicesById: lounge not found or blocked: ${loungeId}`);
        throw new BadRequestException('Lounge not found or not available', 'LOUNGE_NOT_FOUND');
      }

      // Get only active lounge services and populate service details
      const services = await this.loungeServices
        .find({
          loungeId,
          isActive: true,
          status: 'active',
        })
        .populate('serviceId', 'name categoryId description createdAt updatedAt')
        .lean()
        .exec();

      logger.info(`ClientService.getLoungeServicesById: retrieved ${services.length} services for lounge ${loungeId}`);
      return services as LoungeService[];
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle invalid ObjectId format
      if (error.name === 'CastError' && error.kind === 'ObjectId') {
        logger.error(`ClientService.getLoungeServicesById invalid ID format: ${loungeId}`, { stack: error.stack });
        throw new BadRequestException('Invalid lounge ID format', 'INVALID_ID_FORMAT');
      }
      logger.error(`ClientService.getLoungeServicesById error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve lounge services at this time. Please try again later.');
    }
  }
}

export default ClientService;
