import BookingService from '../services/booking.service';
import userModel from '@systems/UserManager/models/user.model';

jest.mock('../models/booking.model');
jest.mock('@systems/UserManager/models/user.model');
jest.mock('@systems/BookingSystem/services/queue.service');
jest.mock('@systems/NotificationSystem/services/socket.service', () => ({
  __esModule: true,
  default: { getInstance: jest.fn().mockReturnValue({}) },
}));
jest.mock('@systems/NotificationSystem/services/notification.service', () => ({
  __esModule: true,
  default: { getInstance: jest.fn().mockReturnValue({}) },
}));
jest.mock('@systems/BookingSystem/services/bookingAnalytics.service');
jest.mock('@systems/BookingSystem/services/booking.helpers', () => ({
  validateLoungeServices: jest.fn(),
  validateAgents: jest.fn(),
  calculateServiceTotals: jest.fn(),
}));

describe('BookingService.createAgentQueueBooking', () => {
  let bookingService: BookingService;

  beforeEach(() => {
    jest.resetAllMocks();
    bookingService = new BookingService();
  });

  it('derives lounge and agent IDs from the authenticated agent', async () => {
    (userModel.findOne as jest.Mock).mockResolvedValue({
      _id: 'agent1',
      type: 'agent',
      parentLounge: { toString: () => 'lounge1' },
      services: [{ toString: () => 'service1' }],
    });
    const createLoungeBooking = jest.spyOn(bookingService, 'createLoungeQueueBooking').mockResolvedValue({ _id: 'booking1' } as any);

    await bookingService.createAgentQueueBooking('agent1', {
      visitorName: 'Walk-in Guest',
      loungeServiceIds: ['service1'],
    });

    expect(userModel.findOne).toHaveBeenCalledWith({ _id: 'agent1', type: 'agent', isBlocked: false });
    expect(createLoungeBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        loungeId: 'lounge1',
        agentId: 'agent1',
        visitorName: 'Walk-in Guest',
        loungeServiceIds: ['service1'],
      }),
      false,
    );
  });

  it('rejects services not assigned to the authenticated agent', async () => {
    (userModel.findOne as jest.Mock).mockResolvedValue({
      _id: 'agent1',
      type: 'agent',
      parentLounge: 'lounge1',
      services: ['service1'],
    });
    const createLoungeBooking = jest.spyOn(bookingService, 'createLoungeQueueBooking');

    await expect(
      bookingService.createAgentQueueBooking('agent1', {
        visitorName: 'Walk-in Guest',
        loungeServiceIds: ['service2'],
      }),
    ).rejects.toThrow('Selected services are not assigned to this agent');
    expect(createLoungeBooking).not.toHaveBeenCalled();
  });

  it('forwards existing-client contact details through the agent-scoped booking flow', async () => {
    (userModel.findOne as jest.Mock).mockResolvedValue({
      _id: 'agent1',
      type: 'agent',
      parentLounge: 'lounge1',
      services: [],
    });
    const createLoungeBooking = jest.spyOn(bookingService, 'createLoungeQueueBooking').mockResolvedValue({ _id: 'booking1' } as any);

    await bookingService.createAgentQueueBooking('agent1', {
      clientPhone: '+21612345678',
      clientEmail: 'client@example.com',
    });

    expect(createLoungeBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        loungeId: 'lounge1',
        agentId: 'agent1',
        clientPhone: '+21612345678',
        clientEmail: 'client@example.com',
      }),
      false,
    );
  });

  it('rejects when the authenticated agent has no parent lounge', async () => {
    (userModel.findOne as jest.Mock).mockResolvedValue({ _id: 'agent1', type: 'agent' });

    await expect(bookingService.createAgentQueueBooking('agent1', { visitorName: 'Walk-in Guest' })).rejects.toThrow(
      'Agent or parent lounge not found',
    );
  });
});
