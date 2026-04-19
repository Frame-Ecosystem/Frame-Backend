import QueueService from '../services/queue.service';
import { QueuePersonStatus } from '../interfaces/queue.interface';
import { BookingStatus } from '../interfaces/booking.interface';
import queueModel from '../models/queue.model';
import bookingModel from '../models/booking.model';
import agentModel from '@systems/UserManager/models/agent.model';

jest.mock('../models/queue.model');
jest.mock('../models/booking.model');
jest.mock('@systems/UserManager/models/agent.model');

const queueService = new QueueService();

// Helper to create a mock queue document with save()
const mockQueueDoc = (overrides: any = {}) => ({
  _id: 'queue1',
  agentId: 'agent1',
  date: new Date('2026-02-24T00:00:00.000Z'),
  persons: [],
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

// Helper to create a mock booking document with save()
const mockBookingDoc = (overrides: any = {}) => ({
  _id: 'booking1',
  clientId: 'client1',
  loungeId: 'lounge1',
  agentIds: ['agent1'],
  status: BookingStatus.IN_QUEUE,
  bookingDate: new Date(),
  totalDuration: 60,
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('QueueService', () => {
  // ─── createQueue ─────────────────────────────────────────────
  describe('createQueue', () => {
    it('should create a new queue for an agent', async () => {
      (agentModel.findById as jest.Mock).mockResolvedValue({ _id: 'agent1' });
      (queueModel.findOneAndUpdate as jest.Mock).mockResolvedValue(mockQueueDoc());

      const result = await queueService.createQueue('agent1');
      expect(agentModel.findById).toHaveBeenCalledWith('agent1');
      expect(queueModel.findOneAndUpdate).toHaveBeenCalled();
      expect(result).toHaveProperty('agentId', 'agent1');
    });

    it('should throw BadRequestException if agentId is empty', async () => {
      await expect(queueService.createQueue('')).rejects.toThrow('Agent ID is required');
    });

    it('should throw NotFoundException if agent does not exist', async () => {
      (agentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(queueService.createQueue('nonexistent')).rejects.toThrow('Agent not found');
    });
  });

  // ─── getQueueByAgent ─────────────────────────────────────────
  describe('getQueueByAgent', () => {
    it('should return the queue for an agent', async () => {
      const populateChain = {
        populate: jest.fn().mockReturnThis(),
      };
      populateChain.populate
        .mockReturnValueOnce(populateChain) // first populate
        .mockReturnValueOnce(populateChain) // second populate
        .mockResolvedValueOnce(mockQueueDoc()); // third populate resolves

      (queueModel.findOne as jest.Mock).mockReturnValue(populateChain);

      const result = await queueService.getQueueByAgent('agent1');
      expect(result).toHaveProperty('agentId', 'agent1');
    });

    it('should throw BadRequestException if agentId is empty', async () => {
      await expect(queueService.getQueueByAgent('')).rejects.toThrow('Agent ID is required');
    });

    it('should throw NotFoundException if queue not found', async () => {
      const populateChain = {
        populate: jest.fn().mockReturnThis(),
      };
      populateChain.populate.mockReturnValueOnce(populateChain).mockReturnValueOnce(populateChain).mockResolvedValueOnce(null);

      (queueModel.findOne as jest.Mock).mockReturnValue(populateChain);

      await expect(queueService.getQueueByAgent('agent1')).rejects.toThrow('Queue not found for this agent on this date');
    });
  });

  // ─── getQueuesByLounge ────────────────────────────────────────
  describe('getQueuesByLounge', () => {
    it('should return all queues for a lounge', async () => {
      (agentModel.find as jest.Mock).mockResolvedValue([{ _id: 'agent1' }, { _id: 'agent2' }]);

      const populateChain = {
        populate: jest.fn().mockReturnThis(),
      };
      populateChain.populate
        .mockReturnValueOnce(populateChain)
        .mockReturnValueOnce(populateChain)
        .mockResolvedValueOnce([mockQueueDoc(), mockQueueDoc({ agentId: 'agent2' })]);

      (queueModel.find as jest.Mock).mockReturnValue(populateChain);

      const result = await queueService.getQueuesByLounge('lounge1');
      expect(result).toHaveLength(2);
    });

    it('should throw BadRequestException if loungeId is empty', async () => {
      await expect(queueService.getQueuesByLounge('')).rejects.toThrow('Lounge ID is required');
    });
  });

  // ─── addPersonToQueue ─────────────────────────────────────────
  describe('addPersonToQueue', () => {
    it('should add a person to the queue', async () => {
      const queue = mockQueueDoc({ persons: [] });
      const booking = mockBookingDoc();

      (bookingModel.findById as jest.Mock).mockResolvedValue(booking);
      (queueModel.findOne as jest.Mock).mockResolvedValue(queue);

      // Mock getQueueByAgent (called at the end of addPersonToQueue)
      const populateChain = {
        populate: jest.fn().mockReturnThis(),
      };
      populateChain.populate
        .mockReturnValueOnce(populateChain)
        .mockReturnValueOnce(populateChain)
        .mockResolvedValueOnce(mockQueueDoc({ persons: [{ bookingId: 'booking1', position: 1 }] }));

      // findOne is called twice: once in addPersonToQueue, once in getQueueByAgent
      (queueModel.findOne as jest.Mock).mockResolvedValueOnce(queue).mockReturnValueOnce(populateChain);

      const result = await queueService.addPersonToQueue('agent1', { bookingId: 'booking1' });
      expect(queue.save).toHaveBeenCalled();
      expect(result.persons).toHaveLength(1);
    });

    it('should throw BadRequestException if bookingId is empty', async () => {
      await expect(queueService.addPersonToQueue('agent1', { bookingId: '' })).rejects.toThrow('Booking ID is required');
    });

    it('should throw NotFoundException if booking does not exist', async () => {
      (bookingModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(queueService.addPersonToQueue('agent1', { bookingId: 'nonexistent' })).rejects.toThrow('Booking not found');
    });

    it('should throw BadRequestException if booking status is not inQueue', async () => {
      (bookingModel.findById as jest.Mock).mockResolvedValue(mockBookingDoc({ status: BookingStatus.PENDING }));
      await expect(queueService.addPersonToQueue('agent1', { bookingId: 'booking1' })).rejects.toThrow(
        'Only bookings with inQueue status can be added to the queue',
      );
    });

    it('should throw BadRequestException if agent is not assigned to booking', async () => {
      (bookingModel.findById as jest.Mock).mockResolvedValue(mockBookingDoc({ agentIds: ['agent2'] }));
      await expect(queueService.addPersonToQueue('agent1', { bookingId: 'booking1' })).rejects.toThrow('Agent is not assigned to this booking');
    });

    it('should throw BadRequestException if booking is already in queue', async () => {
      const queue = mockQueueDoc({
        persons: [{ bookingId: { toString: () => 'booking1' }, position: 1, status: QueuePersonStatus.WAITING }],
      });
      (bookingModel.findById as jest.Mock).mockResolvedValue(mockBookingDoc());
      (queueModel.findOne as jest.Mock).mockResolvedValue(queue);

      await expect(queueService.addPersonToQueue('agent1', { bookingId: 'booking1' })).rejects.toThrow('Booking is already in this queue');
    });

    it('should create a new queue if none exists for today', async () => {
      const booking = mockBookingDoc();
      const newQueue = mockQueueDoc({ persons: [] });

      (bookingModel.findById as jest.Mock).mockResolvedValue(booking);
      (queueModel.findOne as jest.Mock).mockResolvedValueOnce(null); // no existing queue
      (queueModel.create as jest.Mock).mockResolvedValue(newQueue);

      const populateChain = {
        populate: jest.fn().mockReturnThis(),
      };
      populateChain.populate
        .mockReturnValueOnce(populateChain)
        .mockReturnValueOnce(populateChain)
        .mockResolvedValueOnce(mockQueueDoc({ persons: [{ bookingId: 'booking1', position: 1 }] }));

      (queueModel.findOne as jest.Mock).mockReturnValueOnce(populateChain);

      const result = await queueService.addPersonToQueue('agent1', { bookingId: 'booking1' });
      expect(queueModel.create).toHaveBeenCalled();
      expect(result.persons).toHaveLength(1);
    });
  });

  // ─── updatePersonStatus ───────────────────────────────────────
  describe('updatePersonStatus', () => {
    it('should update person status from waiting to inService', async () => {
      const queue = mockQueueDoc({
        persons: [{ bookingId: { toString: () => 'booking1' }, position: 1, status: QueuePersonStatus.WAITING }],
      });
      (queueModel.findOne as jest.Mock).mockResolvedValueOnce(queue);

      const populateChain = { populate: jest.fn().mockReturnThis() };
      populateChain.populate
        .mockReturnValueOnce(populateChain)
        .mockReturnValueOnce(populateChain)
        .mockResolvedValueOnce(mockQueueDoc({ persons: [{ bookingId: 'booking1', status: QueuePersonStatus.IN_SERVICE }] }));
      (queueModel.findOne as jest.Mock).mockReturnValueOnce(populateChain);

      const result = await queueService.updatePersonStatus('agent1', 'booking1', { status: QueuePersonStatus.IN_SERVICE });
      expect(queue.save).toHaveBeenCalled();
      expect(result.persons[0].status).toBe(QueuePersonStatus.IN_SERVICE);
    });

    it('should update person status from inService to completed', async () => {
      const queue = mockQueueDoc({
        persons: [{ bookingId: { toString: () => 'booking1' }, position: 1, status: QueuePersonStatus.IN_SERVICE }],
      });
      (queueModel.findOne as jest.Mock).mockResolvedValueOnce(queue);

      const populateChain = { populate: jest.fn().mockReturnThis() };
      populateChain.populate
        .mockReturnValueOnce(populateChain)
        .mockReturnValueOnce(populateChain)
        .mockResolvedValueOnce(mockQueueDoc({ persons: [{ bookingId: 'booking1', status: QueuePersonStatus.COMPLETED }] }));
      (queueModel.findOne as jest.Mock).mockReturnValueOnce(populateChain);

      const result = await queueService.updatePersonStatus('agent1', 'booking1', { status: QueuePersonStatus.COMPLETED });
      expect(queue.save).toHaveBeenCalled();
      expect(result.persons[0].status).toBe(QueuePersonStatus.COMPLETED);
    });

    it('should update person status from waiting to absent', async () => {
      const queue = mockQueueDoc({
        persons: [{ bookingId: { toString: () => 'booking1' }, position: 1, status: QueuePersonStatus.WAITING }],
      });
      (queueModel.findOne as jest.Mock).mockResolvedValueOnce(queue);

      const populateChain = { populate: jest.fn().mockReturnThis() };
      populateChain.populate
        .mockReturnValueOnce(populateChain)
        .mockReturnValueOnce(populateChain)
        .mockResolvedValueOnce(mockQueueDoc({ persons: [{ bookingId: 'booking1', status: QueuePersonStatus.ABSENT }] }));
      (queueModel.findOne as jest.Mock).mockReturnValueOnce(populateChain);

      const result = await queueService.updatePersonStatus('agent1', 'booking1', { status: QueuePersonStatus.ABSENT });
      expect(queue.save).toHaveBeenCalled();
      expect(result.persons[0].status).toBe(QueuePersonStatus.ABSENT);
    });

    it('should update person status from absent back to waiting', async () => {
      const queue = mockQueueDoc({
        persons: [{ bookingId: { toString: () => 'booking1' }, position: 1, status: QueuePersonStatus.ABSENT }],
      });
      (queueModel.findOne as jest.Mock).mockResolvedValueOnce(queue);

      const populateChain = { populate: jest.fn().mockReturnThis() };
      populateChain.populate
        .mockReturnValueOnce(populateChain)
        .mockReturnValueOnce(populateChain)
        .mockResolvedValueOnce(mockQueueDoc({ persons: [{ bookingId: 'booking1', status: QueuePersonStatus.WAITING }] }));
      (queueModel.findOne as jest.Mock).mockReturnValueOnce(populateChain);

      const result = await queueService.updatePersonStatus('agent1', 'booking1', { status: QueuePersonStatus.WAITING });
      expect(queue.save).toHaveBeenCalled();
      expect(result.persons[0].status).toBe(QueuePersonStatus.WAITING);
    });

    it('should throw NotFoundException if queue not found', async () => {
      (queueModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(queueService.updatePersonStatus('agent1', 'booking1', { status: QueuePersonStatus.IN_SERVICE })).rejects.toThrow(
        'Queue not found',
      );
    });

    it('should throw NotFoundException if person not in queue', async () => {
      const queue = mockQueueDoc({ persons: [] });
      (queueModel.findOne as jest.Mock).mockResolvedValue(queue);
      await expect(queueService.updatePersonStatus('agent1', 'booking1', { status: QueuePersonStatus.IN_SERVICE })).rejects.toThrow(
        'Booking not found in this queue',
      );
    });

    it('should throw BadRequestException for invalid status transition (completed → waiting)', async () => {
      const queue = mockQueueDoc({
        persons: [{ bookingId: { toString: () => 'booking1' }, position: 1, status: QueuePersonStatus.COMPLETED }],
      });
      (queueModel.findOne as jest.Mock).mockResolvedValue(queue);
      await expect(queueService.updatePersonStatus('agent1', 'booking1', { status: QueuePersonStatus.WAITING })).rejects.toThrow(
        "Cannot transition from 'completed' to 'waiting'",
      );
    });

    it('should throw BadRequestException for invalid status transition (waiting → completed)', async () => {
      const queue = mockQueueDoc({
        persons: [{ bookingId: { toString: () => 'booking1' }, position: 1, status: QueuePersonStatus.WAITING }],
      });
      (queueModel.findOne as jest.Mock).mockResolvedValue(queue);
      await expect(queueService.updatePersonStatus('agent1', 'booking1', { status: QueuePersonStatus.COMPLETED })).rejects.toThrow(
        "Cannot transition from 'waiting' to 'completed'",
      );
    });

    it('should throw BadRequestException for invalid status transition (inService → absent)', async () => {
      const queue = mockQueueDoc({
        persons: [{ bookingId: { toString: () => 'booking1' }, position: 1, status: QueuePersonStatus.IN_SERVICE }],
      });
      (queueModel.findOne as jest.Mock).mockResolvedValue(queue);
      await expect(queueService.updatePersonStatus('agent1', 'booking1', { status: QueuePersonStatus.ABSENT })).rejects.toThrow(
        "Cannot transition from 'inService' to 'absent'",
      );
    });
  });

  // ─── removePersonFromQueue ────────────────────────────────────
  describe('removePersonFromQueue', () => {
    it('should remove a person and re-order positions', async () => {
      const queue = mockQueueDoc({
        persons: [
          { bookingId: { toString: () => 'booking1' }, position: 1, status: QueuePersonStatus.WAITING },
          { bookingId: { toString: () => 'booking2' }, position: 2, status: QueuePersonStatus.WAITING },
          { bookingId: { toString: () => 'booking3' }, position: 3, status: QueuePersonStatus.WAITING },
        ],
      });
      (queueModel.findOne as jest.Mock).mockResolvedValueOnce(queue);

      const populateChain = { populate: jest.fn().mockReturnThis() };
      populateChain.populate
        .mockReturnValueOnce(populateChain)
        .mockReturnValueOnce(populateChain)
        .mockResolvedValueOnce(
          mockQueueDoc({
            persons: [
              { bookingId: 'booking2', position: 1 },
              { bookingId: 'booking3', position: 2 },
            ],
          }),
        );
      (queueModel.findOne as jest.Mock).mockReturnValueOnce(populateChain);

      const result = await queueService.removePersonFromQueue('agent1', 'booking1');
      expect(queue.save).toHaveBeenCalled();
      // After removing position 1, positions 2 and 3 should become 1 and 2
      expect(queue.persons[0].position).toBe(1);
      expect(queue.persons[1].position).toBe(2);
      expect(result.persons).toHaveLength(2);
    });

    it('should throw NotFoundException if queue not found', async () => {
      (queueModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(queueService.removePersonFromQueue('agent1', 'booking1')).rejects.toThrow('Queue not found');
    });

    it('should throw NotFoundException if person not in queue', async () => {
      const queue = mockQueueDoc({ persons: [] });
      (queueModel.findOne as jest.Mock).mockResolvedValue(queue);
      await expect(queueService.removePersonFromQueue('agent1', 'booking1')).rejects.toThrow('Booking not found in this queue');
    });
  });

  // ─── populateDailyQueues ──────────────────────────────────────
  describe('populateDailyQueues', () => {
    it('should process confirmed bookings for today and add to agent queues', async () => {
      const booking = mockBookingDoc({
        _id: 'booking1',
        status: BookingStatus.CONFIRMED,
        agentIds: ['agent1'],
      });

      (bookingModel.find as jest.Mock).mockResolvedValue([booking]);

      // Mock addPersonToQueue internals
      (bookingModel.findById as jest.Mock).mockResolvedValue({
        ...booking,
        status: BookingStatus.IN_QUEUE,
        agentIds: ['agent1'],
      });

      const queue = mockQueueDoc({ persons: [] });
      (queueModel.findOne as jest.Mock).mockResolvedValueOnce(queue);

      const populateChain = { populate: jest.fn().mockReturnThis() };
      populateChain.populate
        .mockReturnValueOnce(populateChain)
        .mockReturnValueOnce(populateChain)
        .mockResolvedValueOnce(mockQueueDoc({ persons: [{ bookingId: 'booking1', position: 1 }] }));
      (queueModel.findOne as jest.Mock).mockReturnValueOnce(populateChain);

      const result = await queueService.populateDailyQueues();
      expect(result.processed).toBe(1);
      expect(booking.save).toHaveBeenCalled();
      expect(booking.status).toBe(BookingStatus.IN_QUEUE);
    });

    it('should return 0 processed when no confirmed bookings exist for today', async () => {
      (bookingModel.find as jest.Mock).mockResolvedValue([]);

      const result = await queueService.populateDailyQueues();
      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle bookings with multiple agents', async () => {
      const booking = mockBookingDoc({
        _id: 'booking1',
        status: BookingStatus.CONFIRMED,
        agentIds: ['agent1', 'agent2'],
      });

      (bookingModel.find as jest.Mock).mockResolvedValue([booking]);

      // For each addPersonToQueue call, mock the internals
      (bookingModel.findById as jest.Mock).mockResolvedValue({
        ...booking,
        status: BookingStatus.IN_QUEUE,
        agentIds: ['agent1', 'agent2'],
      });

      const queue1 = mockQueueDoc({ agentId: 'agent1', persons: [] });
      const queue2 = mockQueueDoc({ agentId: 'agent2', persons: [] });

      const populateChain = { populate: jest.fn().mockReturnThis() };
      populateChain.populate.mockReturnThis().mockResolvedValue(mockQueueDoc({ persons: [{ bookingId: 'booking1' }] }));

      (queueModel.findOne as jest.Mock)
        .mockResolvedValueOnce(queue1) // addPersonToQueue for agent1
        .mockReturnValueOnce(populateChain) // getQueueByAgent for agent1
        .mockResolvedValueOnce(queue2) // addPersonToQueue for agent2
        .mockReturnValueOnce(populateChain); // getQueueByAgent for agent2

      const result = await queueService.populateDailyQueues();
      expect(result.processed).toBe(1);
    });

    it('should collect errors without stopping processing', async () => {
      const booking1 = mockBookingDoc({
        _id: 'booking1',
        status: BookingStatus.CONFIRMED,
        agentIds: ['agent1'],
        save: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const booking2 = mockBookingDoc({
        _id: 'booking2',
        status: BookingStatus.CONFIRMED,
        agentIds: ['agent1'],
      });

      (bookingModel.find as jest.Mock).mockResolvedValue([booking1, booking2]);

      // booking2 succeeds
      (bookingModel.findById as jest.Mock).mockResolvedValue({
        ...booking2,
        status: BookingStatus.IN_QUEUE,
        agentIds: ['agent1'],
      });

      const queue = mockQueueDoc({ persons: [] });
      (queueModel.findOne as jest.Mock).mockResolvedValueOnce(queue);

      const populateChain = { populate: jest.fn().mockReturnThis() };
      populateChain.populate.mockReturnThis().mockResolvedValue(mockQueueDoc({ persons: [{ bookingId: 'booking2' }] }));
      (queueModel.findOne as jest.Mock).mockReturnValueOnce(populateChain);

      const result = await queueService.populateDailyQueues();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.processed).toBe(1);
    });
  });
});
