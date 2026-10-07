const mockBookingFind = jest.fn();
const mockQuery = {
  populate: jest.fn(),
  sort: jest.fn(),
};

jest.mock('@systems/BookingSystem/models/booking.model', () => ({
  __esModule: true,
  default: { find: mockBookingFind },
}));

jest.mock('@systems/UserManager/models/user.model', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@systems/BookingSystem/services/queue.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@systems/NotificationSystem/services/socket.service', () => ({
  __esModule: true,
  default: { getInstance: jest.fn().mockReturnValue({}) },
}));

jest.mock('@systems/NotificationSystem/services/notification.service', () => ({
  __esModule: true,
  default: { getInstance: jest.fn().mockReturnValue({}) },
}));

jest.mock('@systems/BookingSystem/services/bookingAnalytics.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({})),
}));

import BookingService from '@systems/BookingSystem/services/booking.service';
import { testIds } from '../../../tests/helpers/factories';

describe('agent booking access filters', () => {
  const service = new BookingService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.populate.mockReturnThis();
    mockQuery.sort.mockResolvedValue([]);
    mockBookingFind.mockReturnValue(mockQuery);
  });

  it('selects active bookings assigned to the authenticated agent', async () => {
    await service.getBookingsByAgentId(testIds.agent);

    expect(mockBookingFind).toHaveBeenCalledWith({ agentIds: testIds.agent });
    expect(mockQuery.sort).toHaveBeenCalledWith({ bookingDate: -1 });
  });

  it('scopes booking history to the authenticated agent and terminal statuses', async () => {
    await service.getBookingHistory(testIds.agent, 'agent');

    expect(mockBookingFind).toHaveBeenCalledWith({
      status: { $in: ['completed', 'cancelled', 'absent'] },
      agentIds: testIds.agent,
    });
  });
});
