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
  public users = userModel;
  public loungeServices = loungeServiceModel;

  /**
   * Get all lounges with pagination (for clients to browse)
   */
  public async getAllLounges(params: PaginationParams): Promise<PaginatedLoungesResponse> {
    try {
      const { page = 1, limit = 10, search = '', gender, sortBy = 'createdAt', sortOrder = 'desc', clientId } = params;

      logger.info(`ClientService.getAllLounges: Starting with page=${page}, limit=${limit}, clientId=${clientId}`);

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        logger.warn('ClientService.getAllLounges: invalid pagination parameters', { page, limit });
        throw new BadRequestException('Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100', 'INVALID_PAGINATION');
      }

      // Get client location if clientId is provided
      let userLatitude: number | undefined;
      let userLongitude: number | undefined;

      if (clientId) {
        logger.info(`ClientService.getAllLounges: Fetching client location for clientId=${clientId}`);
        const client = await this.users.findById(clientId).select('location').lean().exec();
        if (client?.location?.latitude && client?.location?.longitude) {
          userLatitude = client.location.latitude;
          userLongitude = client.location.longitude;
          logger.info(`ClientService.getAllLounges: Client location found: (${userLatitude}, ${userLongitude})`);
        } else {
          logger.warn(`ClientService.getAllLounges: Client ${clientId} has no location data`);
        }
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

      // Get all lounges first (without pagination) for distance calculation
      logger.info(`ClientService.getAllLounges: Querying lounges with filter:`, filter);
      const allLounges = await this.users
        .find(filter)
        .select('-password -refreshTokens -emailVerification -oauth') // Exclude sensitive fields
        .lean()
        .exec();

      logger.info(`ClientService.getAllLounges: Found ${allLounges.length} lounges before sorting`);

      // Calculate distances if user location is available
      let sortedLounges: LoungeWithDistance[] = allLounges as LoungeWithDistance[];
      if (userLatitude !== undefined && userLongitude !== undefined && !isNaN(userLatitude) && !isNaN(userLongitude)) {
        logger.info(`ClientService.getAllLounges: Calculating distances from client location (${userLatitude}, ${userLongitude})`);
        // Calculate distance for each lounge and sort by distance (nearest first)
        sortedLounges = allLounges
          .map(lounge => {
            const loungeLat = lounge.location?.latitude;
            const loungeLng = lounge.location?.longitude;

            if (loungeLat !== undefined && loungeLng !== undefined) {
              const distance = this.calculateDistance(userLatitude, userLongitude, loungeLat, loungeLng);
              return { ...lounge, distance };
            } else {
              // If lounge has no location, put it at the end
              return { ...lounge, distance: Infinity };
            }
          })
          .sort((a, b) => a.distance - b.distance); // Sort ascending: nearest first
        logger.info(`ClientService.getAllLounges: Sorted ${sortedLounges.length} lounges by distance (nearest first)`);
        logger.info(`ClientService.getAllLounges: First lounge distance: ${sortedLounges[0]?.distance || 'N/A'} km`);
      } else {
        logger.info(`ClientService.getAllLounges: No client location available, using traditional sorting`);
        // Use traditional sorting if no location provided
        const sort: any = {};
        const validSortFields = ['createdAt', 'loungeTitle', 'firstName', 'lastName'];
        if (validSortFields.includes(sortBy)) {
          sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
        } else {
          sort.createdAt = -1; // Default sort
        }

        sortedLounges = (allLounges as LoungeWithDistance[]).sort((a, b) => {
          const aValue = a[sortBy] || a.createdAt;
          const bValue = b[sortBy] || b.createdAt;
          const order = sort[sortBy] || -1;
          return order * (new Date(aValue).getTime() - new Date(bValue).getTime());
        });
      }

      // Apply pagination
      const totalItems = sortedLounges.length;
      const skip = (page - 1) * limit;
      const lounges = sortedLounges.slice(skip, skip + limit);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.info(`ClientService.getAllLounges: Returning ${lounges.length} lounges (page ${page}/${totalPages})`);

      return {
        lounges: lounges.map(lounge => {
          // Remove distance property before returning
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { distance: _distance, ...loungeWithoutDistance } = lounge;
          return loungeWithoutDistance;
        }) as User[],
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

  /**
   * Filter lounges by service (for clients to find lounges offering specific services)
   */
  public async getLoungesByService(serviceId: string, params: PaginationParams): Promise<PaginatedLoungesResponse> {
    try {
      const { page = 1, limit = 10, search = '', gender, sortBy = 'createdAt', sortOrder = 'desc', userLatitude, userLongitude } = params;

      logger.info(
        `ClientService.getLoungesByService: Starting with serviceId=${serviceId}, page=${page}, limit=${limit}, userLat=${userLatitude}, userLng=${userLongitude}`,
      );

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        logger.warn('ClientService.getLoungesByService: invalid pagination parameters', { page, limit });
        throw new BadRequestException('Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100', 'INVALID_PAGINATION');
      }

      // Validate serviceId
      if (!serviceId) {
        throw new BadRequestException('Service ID is required', 'MISSING_SERVICE_ID');
      }

      logger.info(`ClientService.getLoungesByService: Finding lounge services for serviceId=${serviceId}`);

      // First, find all lounge services that match the serviceId
      const loungeServices = await this.loungeServices
        .find({
          serviceId,
          isActive: true,
          status: 'active',
        })
        .select('loungeId')
        .lean()
        .exec();

      logger.info(`ClientService.getLoungesByService: Found ${loungeServices.length} lounge services`);

      // Extract unique lounge IDs
      const loungeIds = [...new Set(loungeServices.map(ls => ls.loungeId.toString()))];

      logger.info(`ClientService.getLoungesByService: Extracted ${loungeIds.length} unique lounge IDs: ${loungeIds.join(', ')}`);

      if (loungeIds.length === 0) {
        logger.info(`ClientService.getLoungesByService: no lounges found offering service ${serviceId}`);
        return {
          lounges: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }

      // Build query filter for lounges
      const filter: any = {
        _id: { $in: loungeIds },
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

      // Get all matching lounges first (without pagination) for distance calculation
      logger.info(`ClientService.getLoungesByService: Querying lounges with filter:`, filter);
      const allLounges = await this.users
        .find(filter)
        .select('-password -refreshTokens -emailVerification -oauth') // Exclude sensitive fields, location will be included by default
        .lean()
        .exec();

      logger.info(`ClientService.getLoungesByService: Found ${allLounges.length} lounges before filtering`);

      // Calculate distances if user location is provided
      let sortedLounges = allLounges;
      if (userLatitude !== undefined && userLongitude !== undefined && !isNaN(userLatitude) && !isNaN(userLongitude)) {
        logger.info(`ClientService.getLoungesByService: Calculating distances from (${userLatitude}, ${userLongitude})`);
        // Calculate distance for each lounge and sort by distance
        sortedLounges = allLounges
          .map(lounge => {
            const loungeLat = lounge.location?.latitude;
            const loungeLng = lounge.location?.longitude;

            if (loungeLat !== undefined && loungeLng !== undefined) {
              const distance = this.calculateDistance(userLatitude, userLongitude, loungeLat, loungeLng);
              return { ...lounge, distance };
            } else {
              // If lounge has no location, put it at the end
              return { ...lounge, distance: Infinity };
            }
          })
          .sort((a, b) => a.distance - b.distance);
        logger.info(`ClientService.getLoungesByService: Sorted ${sortedLounges.length} lounges by distance`);
      } else {
        logger.info(`ClientService.getLoungesByService: No location provided, using traditional sorting`);
        // Use traditional sorting if no location provided
        const sort: any = {};
        const validSortFields = ['createdAt', 'loungeTitle', 'firstName', 'lastName'];
        if (validSortFields.includes(sortBy)) {
          sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
        } else {
          sort.createdAt = -1; // Default sort
        }

        sortedLounges = allLounges.sort((a, b) => {
          const aValue = a[sortBy] || a.createdAt;
          const bValue = b[sortBy] || b.createdAt;
          const order = sort[sortBy] || -1;
          return order * (new Date(aValue).getTime() - new Date(bValue).getTime());
        });
      }

      // Apply pagination
      const totalItems = sortedLounges.length;
      const skip = (page - 1) * limit;
      const lounges = sortedLounges.slice(skip, skip + limit);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.info(
        `ClientService.getLoungesByService: retrieved ${lounges.length} lounges offering service ${serviceId} (page ${page}/${totalPages})`,
      );

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
