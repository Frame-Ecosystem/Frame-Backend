import { User } from '@systems/UserManager/interfaces/user.interface';
import { LoungeService } from '@systems/ServiceCatalogSystem/interfaces/loungeService.interface';
import userModel from '@systems/UserManager/models/user.model';
import loungeServiceModel from '@systems/ServiceCatalogSystem/models/loungeService.model';
import { HttpException, BadRequestException, InternalServerException } from '@exceptions/HttpException';
import { escapeRegex } from '@utils/util';
import { logger } from '@utils/logger';

interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  gender?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  userLatitude?: number;
  userLongitude?: number;
  clientId?: string;
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

// Extended interface for lounges with distance calculation
interface LoungeWithDistance extends User {
  distance?: number;
}

class ClientService {
  private users = userModel;
  private loungeServices = loungeServiceModel;

  /* ------------------------------------------------------------------ */
  /*  Shared lounge-fetch pipeline (distance + sort + paginate)         */
  /* ------------------------------------------------------------------ */

  private async fetchLounges(filter: Record<string, any>, params: PaginationParams, context: string): Promise<PaginatedLoungesResponse> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', userLatitude, userLongitude } = params;

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      logger.warn(`${context}: invalid pagination parameters`, { page, limit });
      throw new BadRequestException('Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100', 'INVALID_PAGINATION');
    }

    logger.info(`${context}: Querying lounges with filter:`, filter);
    const allLounges = await this.users.find(filter).select('-password -refreshTokens -emailVerification -oauth').lean().exec();

    logger.info(`${context}: Found ${allLounges.length} lounges before sorting`);

    // Calculate distances & sort
    let sortedLounges: LoungeWithDistance[] = allLounges as LoungeWithDistance[];
    if (userLatitude != null && userLongitude != null && !isNaN(userLatitude) && !isNaN(userLongitude)) {
      logger.info(`${context}: Calculating distances from (${userLatitude}, ${userLongitude})`);
      sortedLounges = allLounges
        .map(lounge => {
          const loungeLat = lounge.location?.latitude;
          const loungeLng = lounge.location?.longitude;
          const distance =
            loungeLat != null && loungeLng != null ? this.calculateDistance(userLatitude, userLongitude, loungeLat, loungeLng) : Infinity;
          return { ...lounge, distance };
        })
        .sort((a, b) => a.distance - b.distance);
    } else {
      logger.info(`${context}: No location available, using traditional sorting`);
      const validSortFields = ['createdAt', 'loungeTitle', 'firstName', 'lastName'];
      const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const order = sortOrder === 'asc' ? 1 : -1;
      sortedLounges = (allLounges as LoungeWithDistance[]).sort((a, b) => {
        const aVal = a[field] || a.createdAt;
        const bVal = b[field] || b.createdAt;
        return order * (new Date(aVal).getTime() - new Date(bVal).getTime());
      });
    }

    // Paginate
    const totalItems = sortedLounges.length;
    const skip = (page - 1) * limit;
    const lounges = sortedLounges.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalItems / limit);

    logger.info(`${context}: Returning ${lounges.length} lounges (page ${page}/${totalPages})`);

    return {
      lounges: lounges.map(({ distance: _d, ...rest }) => rest) as User[],
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /** Build the common search/gender part of a lounge filter. */
  private buildLoungeFilter(search?: string, gender?: string): Record<string, any> {
    const filter: any = {
      type: 'lounge',
      isBlocked: { $ne: true },
    };
    if (search) {
      const escapedSearch = escapeRegex(search);
      filter.$or = [
        { loungeTitle: { $regex: escapedSearch, $options: 'i' } },
        { firstName: { $regex: escapedSearch, $options: 'i' } },
        { lastName: { $regex: escapedSearch, $options: 'i' } },
        { bio: { $regex: escapedSearch, $options: 'i' } },
      ];
    }
    if (gender && ['male', 'female', 'unisex', 'kids'].includes(gender)) {
      filter.gender = gender;
    }
    return filter;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Get all lounges with pagination (for clients to browse)
   */
  public async getAllLounges(params: PaginationParams): Promise<PaginatedLoungesResponse> {
    try {
      const { clientId, search, gender } = params;
      const context = 'ClientService.getAllLounges';
      logger.info(`${context}: Starting with page=${params.page}, limit=${params.limit}, clientId=${clientId}`);

      // Resolve client location when coordinates are not already passed
      const enrichedParams = { ...params };
      if (clientId && enrichedParams.userLatitude == null) {
        const client = await this.users.findById(clientId).select('location').lean().exec();
        if (client?.location?.latitude && client?.location?.longitude) {
          enrichedParams.userLatitude = client.location.latitude;
          enrichedParams.userLongitude = client.location.longitude;
          logger.info(`${context}: Client location found: (${enrichedParams.userLatitude}, ${enrichedParams.userLongitude})`);
        } else {
          logger.warn(`${context}: Client ${clientId} has no location data`);
        }
      }

      const filter = this.buildLoungeFilter(search, gender);
      return await this.fetchLounges(filter, enrichedParams, context);
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

  /**
   * Filter lounges by service (for clients to find lounges offering specific services)
   */
  public async getLoungesByService(serviceId: string, params: PaginationParams): Promise<PaginatedLoungesResponse> {
    try {
      const { search, gender } = params;
      const context = 'ClientService.getLoungesByService';
      logger.info(`${context}: Starting with serviceId=${serviceId}, page=${params.page}, limit=${params.limit}`);

      if (!serviceId) {
        throw new BadRequestException('Service ID is required', 'MISSING_SERVICE_ID');
      }

      // Find lounge IDs offering this service
      const loungeServices = await this.loungeServices.find({ serviceId, isActive: true, status: 'active' }).select('loungeId').lean().exec();

      const loungeIds = [...new Set(loungeServices.map(ls => ls.loungeId.toString()))];
      logger.info(`${context}: Found ${loungeIds.length} unique lounges offering service ${serviceId}`);

      if (loungeIds.length === 0) {
        return {
          lounges: [],
          pagination: {
            currentPage: params.page || 1,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: params.limit || 10,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }

      const filter = { ...this.buildLoungeFilter(search, gender), _id: { $in: loungeIds } };
      return await this.fetchLounges(filter, params, context);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ClientService.getLoungesByService error: ${error.message}`, { serviceId, stack: error.stack });
      throw new InternalServerException('Unable to filter lounges by service at this time. Please try again later.');
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param lat1 - Latitude of first point
   * @param lon1 - Longitude of first point
   * @param lat2 - Latitude of second point
   * @param lon2 - Longitude of second point
   * @returns Distance in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param degrees - Angle in degrees
   * @returns Angle in radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export default ClientService;
