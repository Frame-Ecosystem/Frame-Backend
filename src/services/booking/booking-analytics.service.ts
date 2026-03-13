import { BadRequestException, InternalServerException, NotFoundException } from '@exceptions/HttpException';
import { BookingStatus } from '@interfaces/booking/booking.interface';
import bookingModel from '@models/booking/booking.model';
import agentModel from '@models/user/agent.model';
import userModel from '@models/user/users.model';
import { logger } from '@utils/logger';
import mongoose from 'mongoose';
import SocketService from '@services/realtime/socket.service';

class BookingAnalyticsService {
  private bookings = bookingModel;
  private users = userModel;
  private agents = agentModel;
  private socketService = SocketService.getInstance();

  // ─── Stats ──────────────────────────────────────────────────────

  public async getClientBookingStats(clientId: string): Promise<any> {
    return this.getBookingStats('clientId', clientId, 'client');
  }

  public async getLoungeBookingStats(loungeId: string): Promise<any> {
    return this.getBookingStats('loungeId', loungeId, 'lounge');
  }

  private async getBookingStats(field: string, id: string, label: string): Promise<any> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid ${label} ID format`, `INVALID_${label.toUpperCase()}_ID`);
      }
      return await this.bookings.aggregate([
        { $match: { [field]: new mongoose.Types.ObjectId(id) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalPrice' },
          },
        },
      ]);
    } catch (error) {
      logger.error(`Error fetching stats for ${label} ${id}: ${error.message}`);
      throw error instanceof BadRequestException ? error : new InternalServerException(`Failed to fetch ${label} booking stats`);
    }
  }

  // ─── Cron Cleanup ───────────────────────────────────────────────

  /**
   * Cron safety net: find all bookings still in 'inQueue' status from past days
   * and finalize them as completed.
   */
  public async cleanupStaleInQueueBookings(): Promise<{ processed: number; errors: string[] }> {
    let processed = 0;
    const errors: string[] = [];

    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const staleBookings = await this.bookings.find({
        status: BookingStatus.IN_QUEUE,
        bookingDate: { $lt: today },
      });

      for (const booking of staleBookings) {
        try {
          booking.status = BookingStatus.COMPLETED;
          await booking.save();
          this.socketService.emitBookingUpdated(booking);
          processed++;
        } catch (err) {
          errors.push(`Failed to complete stale inQueue booking ${booking._id}: ${err.message}`);
        }
      }

      return { processed, errors };
    } catch (error) {
      logger.error('BookingAnalyticsService.cleanupStaleInQueueBookings: error', error);
      throw error;
    }
  }

  // ─── Availability ───────────────────────────────────────────────

  /**
   * Get unavailable time slots for given agents over the next 30 days.
   */
  public async getAgentUnavailability(agentIds: string[]): Promise<any> {
    let uniqueAgentIds: string[] = [];

    try {
      uniqueAgentIds = [...new Set(agentIds)];

      for (const id of uniqueAgentIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new BadRequestException(`Invalid agent ID format: ${id}`);
        }
      }

      const agents = await this.agents.find({ _id: { $in: uniqueAgentIds } }).populate('loungeId');
      if (agents.length === 0) {
        throw new NotFoundException('No agents found with the provided IDs');
      }
      if (agents.length !== uniqueAgentIds.length) {
        throw new NotFoundException('Some agent IDs do not exist');
      }

      const agentsWithoutLounge = agents.filter(a => !a.loungeId);
      if (agentsWithoutLounge.length > 0) {
        throw new BadRequestException('Some agents do not have an associated lounge');
      }

      const loungeIds = [...new Set(agents.map(a => (a.loungeId as any)._id.toString()))];
      if (loungeIds.length > 1) {
        throw new BadRequestException('All agents must be from the same lounge');
      }

      const loungeId = loungeIds[0];
      if (!mongoose.Types.ObjectId.isValid(loungeId)) {
        throw new BadRequestException('Invalid lounge ID format');
      }

      const lounge = await this.users.findById(loungeId);
      if (!lounge || lounge.type !== 'lounge') {
        throw new NotFoundException('Lounge not found or is not a valid lounge');
      }

      const bookings = await this.bookings.find({
        agentIds: { $in: uniqueAgentIds },
        status: { $ne: BookingStatus.CANCELLED },
        bookingDate: { $gte: new Date() },
      });

      const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
      const SLOT_DURATION_MS = 30 * 60 * 1000; // 30-minute slots

      const unavailableSlots = [];
      const today = new Date();

      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
        const hours = lounge.openingHours[dayOfWeek];

        if (!hours || !hours.from || !hours.to) continue;

        const fromTime = new Date(`${dateStr}T${hours.from}:00`);
        const toTime = new Date(`${dateStr}T${hours.to}:00`);
        const dayUnavailableTimes: string[] = [];

        for (let current = fromTime.getTime(); current < toTime.getTime(); current += SLOT_DURATION_MS) {
          const slotStart = current;
          const slotEnd = current + SLOT_DURATION_MS;

          const isUnavailable = bookings.some(booking => {
            const bookingStart = new Date(booking.bookingDate).getTime();
            const bookingEnd = bookingStart + (booking.totalDuration || 60) * 60 * 1000;
            return bookingStart < slotEnd && bookingEnd > slotStart;
          });

          if (isUnavailable) {
            dayUnavailableTimes.push(new Date(current).toTimeString().substring(0, 5));
          }
        }

        if (dayUnavailableTimes.length > 0) {
          unavailableSlots.push({ date: dateStr, unavailableTimes: dayUnavailableTimes });
        }
      }

      const openingHours: Record<string, any> = {};
      for (const day of DAYS_OF_WEEK) {
        openingHours[day] = lounge.openingHours[day];
      }

      return { unavailableSlots, loungeOpeningHours: openingHours };
    } catch (error) {
      logger.error(`Error fetching agent availability: ${error.message}`, { error, agentIds: uniqueAgentIds });
      throw error;
    }
  }
}

export default BookingAnalyticsService;
