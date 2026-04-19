import { User } from '@interfaces/user/user.interface';
import userModel from '@models/user/user.model';
import bookingModel from '@models/booking/booking.model';
import likeModel from '@models/like/like.model';
import ratingModel from '@models/rating/rating.model';
import { HttpException, BadRequestException, NotFoundException, InternalServerException } from '@exceptions/HttpException';
import { assertObjectId } from '@utils/validators';
import { logger } from '@utils/logger';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Sensitive fields stripped from every profile response. */
const SENSITIVE_FIELDS = '-password -refreshTokens -emailVerification -oauth -fcmTokens -sessionTrack';

/** What a public viewer (another client or lounge) can see. */
const PUBLIC_SELECT = `${SENSITIVE_FIELDS}`;

export interface ClientProfileResponse {
  profile: Partial<User>;
  stats: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    likedLounges: number;
    ratingsGiven: number;
  };
}

export interface ClientBookingHistoryParams {
  page: number;
  limit: number;
  status?: string;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

class ClientVisitorProfileService {
  private users = userModel;
  private bookings = bookingModel;
  private likes = likeModel;
  private ratings = ratingModel;

  /**
   * Get a client's public profile — visible to lounges, other clients, and admins.
   * Admins get slightly more data (email, phoneNumber, isBlocked, createdAt).
   */
  public async getClientProfile(clientId: string, viewerType: string): Promise<ClientProfileResponse> {
    try {
      const client = await this.assertClient(clientId, viewerType, PUBLIC_SELECT);

      // Build stats in parallel
      const [totalBookings, completedBookings, cancelledBookings, likedLounges, ratingsGiven] = await Promise.all([
        this.bookings.countDocuments({ clientId }).exec(),
        this.bookings.countDocuments({ clientId, status: 'completed' }).exec(),
        this.bookings.countDocuments({ clientId, status: 'cancelled' }).exec(),
        this.likes.countDocuments({ clientId }).exec(),
        this.ratings.countDocuments({ clientId }).exec(),
      ]);

      // Strip extra fields for non-admin viewers
      const profile = this.shapeProfile(client as User, viewerType);

      logger.info(`ClientVisitorProfileService.getClientProfile: ${viewerType} viewed client ${clientId}`);

      return {
        profile,
        stats: { totalBookings, completedBookings, cancelledBookings, likedLounges, ratingsGiven },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      logger.error(`ClientVisitorProfileService.getClientProfile error: ${error.message}`, { clientId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve client profile. Please try again later.');
    }
  }

  /**
   * Get a client's booking history — for lounge (only their bookings with this client),
   * for admin (all), for another client (own only → forbidden).
   */
  public async getClientBookings(clientId: string, viewerId: string, viewerType: string, params: ClientBookingHistoryParams) {
    try {
      const { page = 1, limit = 10, status } = params;
      if (page < 1 || limit < 1 || limit > 50) {
        throw new BadRequestException('Invalid pagination. page >= 1, limit 1-50', 'INVALID_PAGINATION');
      }

      await this.assertClient(clientId, viewerType);

      // Build filter based on viewer role
      const filter: Record<string, any> = { clientId };

      if (viewerType === 'lounge') {
        // Lounges only see bookings at their own lounge
        filter.loungeId = viewerId;
      }
      // Admin and client see all bookings for this client — no extra filter

      // Only return terminal statuses (completed, cancelled, absent)
      const ALLOWED_STATUSES = ['completed', 'cancelled', 'absent'];

      if (status) {
        if (!ALLOWED_STATUSES.includes(status)) {
          throw new BadRequestException(`Invalid status filter. Allowed: ${ALLOWED_STATUSES.join(', ')}`, 'INVALID_STATUS');
        }
        filter.status = status;
      } else {
        filter.status = { $in: ALLOWED_STATUSES };
      }

      const [bookings, total] = await Promise.all([
        this.bookings
          .find(filter)
          .populate('loungeId', 'loungeTitle profileImage')
          .populate('loungeServiceIds', 'price duration')
          .sort({ bookingDate: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
          .exec(),
        this.bookings.countDocuments(filter).exec(),
      ]);

      logger.info(`ClientVisitorProfileService.getClientBookings: ${viewerType} ${viewerId} viewed ${total} bookings for client ${clientId}`);

      return {
        bookings,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      logger.error(`ClientVisitorProfileService.getClientBookings error: ${error.message}`, { clientId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve booking history. Please try again later.');
    }
  }

  /**
   * Get lounges liked by a client — visible to everyone (public social data).
   */
  public async getClientLikedLounges(clientId: string, page: number, limit: number) {
    try {
      await this.assertClient(clientId);

      const [likes, total] = await Promise.all([
        this.likes
          .find({ clientId })
          .populate('loungeId', 'loungeTitle profileImage coverImage averageRating ratingCount location')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
          .exec(),
        this.likes.countDocuments({ clientId }).exec(),
      ]);

      return {
        lounges: likes.map(l => l.loungeId).filter(Boolean),
        total,
        page,
        limit,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      logger.error(`ClientVisitorProfileService.getClientLikedLounges error: ${error.message}`, { clientId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve liked lounges. Please try again later.');
    }
  }

  /**
   * Get ratings given by a client — visible to everyone.
   */
  public async getClientRatings(clientId: string, page: number, limit: number) {
    try {
      await this.assertClient(clientId);

      const [ratings, total] = await Promise.all([
        this.ratings
          .find({ clientId })
          .populate('loungeId', 'loungeTitle profileImage')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
          .exec(),
        this.ratings.countDocuments({ clientId }).exec(),
      ]);

      return { ratings, total, page, limit };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      logger.error(`ClientVisitorProfileService.getClientRatings error: ${error.message}`, { clientId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve client ratings. Please try again later.');
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Verify a client exists and is not blocked (for non-admin viewers).
   * Returns the lean client document if valid.
   */
  private async assertClient(clientId: string, viewerType?: string, selectFields = '_id isBlocked') {
    assertObjectId(clientId, 'Client ID');

    const client = await this.users.findOne({ _id: clientId, type: 'client' }).select(selectFields).lean().exec();

    if (!client) throw new NotFoundException('Client not found', 'CLIENT_NOT_FOUND');
    if ((client as any).isBlocked && viewerType !== 'admin') {
      throw new NotFoundException('Client not found', 'CLIENT_NOT_FOUND');
    }

    return client;
  }

  /** Shape profile data based on viewer role. */
  private shapeProfile(user: User, viewerType: string): Partial<User> {
    const base: Partial<User> = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImage: user.profileImage,
      coverImage: user.coverImage,
      bio: user.bio,
      gender: user.gender,
      email: user.email,
      phoneNumber: user.phoneNumber,
    };

    // Admins & lounges get extra context
    if (viewerType === 'admin') {
      return {
        ...base,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        type: user.type,
      };
    }

    if (viewerType === 'lounge') {
      return {
        ...base,
        createdAt: user.createdAt,
      };
    }

    // Other clients get the minimal public profile
    return base;
  }
}

export default ClientVisitorProfileService;
