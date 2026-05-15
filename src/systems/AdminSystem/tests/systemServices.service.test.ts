jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    connection: {
      readyState: 1,
    },
  },
}));

jest.mock('@systems/UserManager/models/user.model', () => ({
  __esModule: true,
  default: {
    countDocuments: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('@systems/AdminSystem/models/auditLog.model', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

import SystemServicesService from '@systems/AdminSystem/services/systemServices.service';
import userModel from '@systems/UserManager/models/user.model';
import adminAuditLogModel from '@systems/AdminSystem/models/auditLog.model';

describe('SystemServicesService', () => {
  let service: SystemServicesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SystemServicesService();
  });

  describe('getSystemHealth', () => {
    it('returns healthy status and process/database metrics', async () => {
      const result = await service.getSystemHealth();

      expect(result.status).toBe('healthy');
      expect(result.database).toEqual({
        status: 'connected',
        readyState: 1,
      });
      expect(typeof result.process.uptimeSeconds).toBe('number');
      expect(typeof result.process.nodeVersion).toBe('string');
      expect(result.process.memory).toBeDefined();
    });
  });

  describe('exportUserData', () => {
    it('returns export payload with metadata', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'user@test.com',
        type: 'client',
        sessionTrack: { isOnline: true, devices: [] },
        refreshTokens: [{ jti: 'a' }, { jti: 'b' }],
      };

      const exec = jest.fn().mockResolvedValue(mockUser);
      const lean = jest.fn().mockReturnValue({ exec });
      const select = jest.fn().mockReturnValue({ lean });
      (userModel.findById as jest.Mock).mockReturnValue({ select });

      const result = await service.exportUserData('507f1f77bcf86cd799439011');

      expect(userModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result.user).toEqual(mockUser);
      expect(result.metadata).toEqual({
        hasActiveSession: true,
        refreshTokenCount: 2,
      });
      expect(result.exportedAt).toBeInstanceOf(Date);
    });
  });

  describe('createAuditLog', () => {
    it('persists and returns normalized audit record', async () => {
      const createdAt = new Date('2026-05-15T00:00:00.000Z');
      (adminAuditLogModel.create as jest.Mock).mockResolvedValue({
        _id: 'audit-id-1',
        action: 'ADMIN_USER_FORCE_LOGOUT',
        adminUserId: '507f1f77bcf86cd799439011',
        details: { reason: 'security' },
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        createdAt,
      });

      const result = await service.createAuditLog('ADMIN_USER_FORCE_LOGOUT', '507f1f77bcf86cd799439011', { reason: 'security' }, {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(adminAuditLogModel.create).toHaveBeenCalledWith({
        action: 'ADMIN_USER_FORCE_LOGOUT',
        adminUserId: '507f1f77bcf86cd799439011',
        details: { reason: 'security' },
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(result).toEqual({
        _id: 'audit-id-1',
        action: 'ADMIN_USER_FORCE_LOGOUT',
        adminUserId: '507f1f77bcf86cd799439011',
        details: { reason: 'security' },
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        createdAt,
      });
    });
  });
});
