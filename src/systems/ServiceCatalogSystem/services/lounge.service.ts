import { NotFoundException, BadRequestException, HttpException, InternalServerException } from '@exceptions/HttpException';
import { User } from '@systems/UserManager/interfaces/user.interface';
import { BookingStatus } from '@systems/BookingSystem/interfaces/booking.interface';
import userModel from '@systems/UserManager/models/user.model';
import bookingModel from '@systems/BookingSystem/models/booking.model';
import mongoose from 'mongoose';
import { isEmpty, handleMongooseError } from '@utils/util';
import { logger } from '@utils/logger';

const CLIENT_PUBLIC_FIELDS = 'firstName lastName email profileImage coverImage location';
const BOOKING_COLLECTION = bookingModel.collection.name;

class LoungeService {
  private users = userModel;

  public async getClientById(clientId: string): Promise<any> {
    try {
      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        throw new BadRequestException('Invalid client ID format', 'INVALID_CLIENT_ID');
      }

      const client = await this.users.findOne({ _id: clientId, type: 'client' }).select(CLIENT_PUBLIC_FIELDS);

      if (!client) {
        throw new NotFoundException('Client not found', 'CLIENT_NOT_FOUND');
      }

      return client;
    } catch (error) {
      logger.error(`Error fetching client ${clientId}: ${error.message}`);
      throw error;
    }
  }

  public async updateAgentQueueBooking(loungeId: string, agentId: string, acceptQueueBooking: boolean): Promise<any> {
    try {
      if (!mongoose.Types.ObjectId.isValid(agentId)) {
        throw new BadRequestException('Invalid agent ID format', 'INVALID_AGENT_ID');
      }

      // Agent is a User document with type='agent' and parentLounge=this lounge
      const agent = await this.users.findOne({ _id: agentId, type: 'agent', parentLounge: loungeId });
      if (!agent) {
        throw new NotFoundException('Agent not found or does not belong to this lounge', 'AGENT_NOT_FOUND');
      }

      agent.acceptQueueBooking = acceptQueueBooking;
      await agent.save();

      logger.info(`Agent ${agentId} acceptQueueBooking set to ${acceptQueueBooking}`);
      return agent;
    } catch (error) {
      logger.error(`Error updating agent queue booking setting: ${error.message}`);
      throw error;
    }
  }

  /**
   * Patch opening hours for a lounge
   */
  public async patchLoungeOpeningHours(
    loungeId: string,
    openingHoursData: import('@systems/UserManager/dtos/user.dto').DayOpeningHoursDto,
  ): Promise<User> {
    try {
      if (isEmpty(loungeId) || isEmpty(openingHoursData)) {
        logger.warn('LoungeService.patchLoungeOpeningHours: empty loungeId or openingHoursData provided');
        throw new BadRequestException('Lounge ID and opening hours data are required', 'MISSING_REQUIRED_FIELDS');
      }

      const lounge = await this.users.findById(loungeId);
      if (!lounge) {
        throw new NotFoundException('Lounge not found', 'LOUNGE_NOT_FOUND');
      }
      if (lounge.type !== 'lounge') {
        throw new BadRequestException('This endpoint is only for lounge accounts', 'NOT_LOUNGE_ACCOUNT');
      }

      const currentOpeningHours = lounge.openingHours || {};
      const updatedOpeningHours = { ...currentOpeningHours, ...openingHoursData };

      const updatedLounge = await this.users.findByIdAndUpdate(
        loungeId,
        { $set: { openingHours: updatedOpeningHours } },
        { new: true, runValidators: true },
      );

      if (!updatedLounge) {
        throw new NotFoundException('Lounge not found', 'LOUNGE_NOT_FOUND');
      }

      logger.info(`LoungeService.patchLoungeOpeningHours: opening hours updated for lounge: ${loungeId}`);
      return updatedLounge;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'LoungeService.patchLoungeOpeningHours', {
        validationMessage: 'Invalid opening hours data provided',
        castMessage: 'Invalid lounge ID format',
        fallbackMessage: 'Unable to update opening hours at this time. Please try again later.',
        logMeta: { loungeId },
      });
    }
  }

  /**
   * Update lounge profile (title and opening hours)
   */
  public async updateLoungeProfile(loungeId: string, loungeData: import('@systems/UserManager/dtos/user.dto').UpdateLoungeProfileDto): Promise<User> {
    try {
      if (isEmpty(loungeId) || isEmpty(loungeData)) {
        throw new BadRequestException('Lounge ID and profile data are required', 'MISSING_REQUIRED_FIELDS');
      }

      const lounge = await this.users.findById(loungeId);
      if (!lounge) {
        throw new NotFoundException('Lounge not found', 'LOUNGE_NOT_FOUND');
      }
      if (lounge.type !== 'lounge') {
        throw new BadRequestException('This endpoint is only for lounge accounts', 'NOT_LOUNGE_ACCOUNT');
      }

      const updateData: Partial<User> = {};
      if (loungeData.loungeTitle !== undefined) updateData.loungeTitle = loungeData.loungeTitle;
      if (loungeData.openingHours !== undefined) updateData.openingHours = loungeData.openingHours;

      const updatedLounge = await this.users.findByIdAndUpdate(loungeId, updateData, { new: true, runValidators: true });
      if (!updatedLounge) {
        throw new NotFoundException('Lounge not found', 'LOUNGE_NOT_FOUND');
      }

      logger.info(`LoungeService.updateLoungeProfile: lounge profile updated for lounge: ${loungeId}`);
      return updatedLounge;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'LoungeService.updateLoungeProfile', {
        validationMessage: 'Invalid lounge profile data provided',
        castMessage: 'Invalid lounge ID format',
        fallbackMessage: 'Unable to update lounge profile at this time. Please try again later.',
        logMeta: { loungeId },
      });
    }
  }

  /**
   * Get all lounges ordered by the number of completed bookings (most booked first).
   * Starts from the users collection (type='lounge') so every lounge is included,
   * then left-joins completed bookings to count them. Lounges with zero bookings
   * appear at the bottom of the list.
   */
  public async getMostBookedLounges(): Promise<any[]> {
    try {
      const result = await this.users.aggregate([
        { $match: { type: 'lounge' } },
        {
          $lookup: {
            from: BOOKING_COLLECTION,
            let: { loungeId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$loungeId', '$$loungeId'] }, status: BookingStatus.COMPLETED } },
              { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$totalPrice', 0] } } } },
            ],
            as: 'bookingStats',
          },
        },
        {
          $addFields: {
            completedBookings: { $ifNull: [{ $arrayElemAt: ['$bookingStats.count', 0] }, 0] },
            totalRevenue: { $ifNull: [{ $arrayElemAt: ['$bookingStats.revenue', 0] }, 0] },
          },
        },
        { $sort: { completedBookings: -1 } },
        {
          $project: {
            password: 0,
            refreshTokens: 0,
            sessionTrack: 0,
            fcmTokens: 0,
            oauth: 0,
            failedLoginAttempts: 0,
            lockUntil: 0,
            passwordChangedAt: 0,
            bookingStats: 0,
          },
        },
      ]);

      return result;
    } catch (error) {
      logger.error(`Error fetching most booked lounges: ${error.message}`);
      throw new InternalServerException('Failed to fetch most booked lounges');
    }
  }

  /**
   * Get agents for a specific lounge
   */
  public async getAgentsPerLounge(loungeId: string, _requestingUser?: any): Promise<any> {
    try {
      const lounge = await this.users.findOne({ _id: loungeId, type: 'lounge' });
      if (!lounge) {
        throw new NotFoundException('Lounge not found');
      }

      const agents = await this.users.find({ type: 'agent', parentLounge: loungeId }).select('-password').lean();

      logger.info(`LoungeService.getAgentsPerLounge: retrieved ${agents.length} agents for lounge ${loungeId}`);
      return {
        lounge: { _id: lounge._id, loungeTitle: lounge.loungeTitle, email: lounge.email },
        agents,
        totalAgents: agents.length,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeService.getAgentsPerLounge error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Failed to retrieve agents for lounge');
    }
  }
}

export default LoungeService;
