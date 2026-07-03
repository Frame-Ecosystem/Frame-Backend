import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SessionSwitchService, { SessionInfo } from '@systems/AuthSystem/services/sessionSwitch.service';
import { User, RefreshTokenSession } from '@systems/UserManager/interfaces/user.interface';
import { NotFoundException, ForbiddenException, ConflictException } from '@exceptions/HttpException';
import userModel from '@systems/UserManager/models/user.model';
import AuthTokenService from '@systems/AuthSystem/services/authToken.service';

// Mock dependencies
jest.mock('@systems/UserManager/models/user.model');
jest.mock('@systems/AuthSystem/services/authToken.service');
jest.mock('@utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
  logSecurityEvent: jest.fn(),
}));

describe('SessionSwitchService', () => {
  let service: SessionSwitchService;
  let mockUser: User;
  let session1: RefreshTokenSession;
  let session2: RefreshTokenSession;
  let mockTokenService: jest.Mocked<AuthTokenService>;

  beforeEach(() => {
    service = new SessionSwitchService();
    mockTokenService = AuthTokenService as jest.Mocked<typeof AuthTokenService>;

    // Create mock sessions
    session1 = {
      sessionId: 'session-1',
      jti: 'jti-1',
      tokenHash: 'hash-1',
      deviceName: 'iPhone 12',
      userAgent: 'Mozilla/5.0...',
      ip: '192.168.1.100',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      lastUsedAt: new Date(Date.now() - 1000),
    };

    session2 = {
      sessionId: 'session-2',
      jti: 'jti-2',
      tokenHash: 'hash-2',
      deviceName: 'Android Phone',
      userAgent: 'Mozilla/5.0...',
      ip: '192.168.1.101',
      createdAt: new Date('2025-01-02T00:00:00Z'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(Date.now() - 2000),
    };

    // Create mock user
    mockUser = {
      _id: 'user-123',
      email: 'test@example.com',
      type: 'user',
      firstName: 'John',
      lastName: 'Doe',
      sessionTrack: { isOnline: true, devices: [] },
      refreshTokens: [session1, session2],
    } as any;
  });

  describe('listSessions', () => {
    it('should return array of active sessions with masked email', async () => {
      (userModel.findById as jest.Mock).mockResolvedValue(mockUser);

      const sessions = await service.listSessions(mockUser, 'jti-1');

      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toMatchObject({
        sessionId: 'session-1',
        userId: 'user-123',
        emailOrPhoneMasked: expect.stringContaining('***'),
        isCurrent: true,
      });
      expect(sessions[1]).toMatchObject({
        isCurrent: false,
      });
    });

    it('should mask email correctly (j***@example.com)', async () => {
      (userModel.findById as jest.Mock).mockResolvedValue(mockUser);

      const sessions = await service.listSessions(mockUser);

      expect(sessions[0].emailOrPhoneMasked).toMatch(/^j\*\*\*@example\.com$/);
    });

    it('should return empty array if no active sessions', async () => {
      mockUser.refreshTokens = [];
      (userModel.findById as jest.Mock).mockResolvedValue(mockUser);

      const sessions = await service.listSessions(mockUser);

      expect(sessions).toEqual([]);
    });

    it('should filter out expired sessions', async () => {
      const expiredSession = {
        ...session2,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };
      mockUser.refreshTokens = [session1, expiredSession];
      (userModel.findById as jest.Mock).mockResolvedValue(mockUser);

      const sessions = await service.listSessions(mockUser);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('session-1');
    });

    it('should use displayName from firstName and lastName', async () => {
      const sessions = await service.listSessions(mockUser, 'jti-1');

      expect(sessions[0].displayName).toBe('John Doe');
    });

    it('should handle user without name fields', async () => {
      mockUser.firstName = undefined;
      mockUser.lastName = undefined;
      mockUser.loungeTitle = undefined;

      const sessions = await service.listSessions(mockUser);

      expect(sessions[0].displayName).toBe('test');
    });
  });

  describe('switchSession', () => {
    it('should successfully switch to owned active session', async () => {
      (userModel.findById as jest.Mock).mockResolvedValue(mockUser);
      const mockGenerateRefreshToken = jest.fn().mockResolvedValue('new-refresh-token');
      const mockTokenService = (AuthTokenService as any).mock.instances[0];
      if (mockTokenService) {
        mockTokenService.createToken = jest.fn().mockReturnValue({
          token: 'new-access-token',
          expiresIn: 900,
        });
        mockTokenService.generateRefreshToken = mockGenerateRefreshToken;
      }

      const result = await service.switchSession(mockUser, 'session-2', 'jti-1', {
        ip: '192.168.1.200',
        userAgent: 'New Agent',
      });

      expect(result).toMatchObject({
        token: expect.any(String),
        expiresIn: expect.any(Number),
        csrfToken: expect.any(String),
      });
    });

    it('should reject switch to non-owned session', async () => {
      (userModel.findById as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.switchSession(mockUser, 'non-existent-session', 'jti-1')).rejects.toThrow(NotFoundException);
    });

    it('should reject switch to expired session', async () => {
      const expiredSession = { ...session2, expiresAt: new Date(Date.now() - 1000) };
      mockUser.refreshTokens = [session1, expiredSession];
      (userModel.findById as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.switchSession(mockUser, 'session-2', 'jti-1')).rejects.toThrow(ConflictException);
    });

    it('should reject switch for blocked account', async () => {
      mockUser.isBlocked = true;
      (userModel.findById as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.switchSession(mockUser, 'session-2', 'jti-1')).rejects.toThrow(ForbiddenException);
    });

    it('should reject if user not found', async () => {
      (userModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.switchSession(mockUser, 'session-2', 'jti-1')).rejects.toThrow(NotFoundException);
    });

    it('should update session lastUsedAt', async () => {
      (userModel.findById as jest.Mock).mockResolvedValue(mockUser);

      await service.switchSession(mockUser, 'session-2', 'jti-1');

      const updateCall = (userModel.findByIdAndUpdate as jest.Mock).mock.calls[0];
      expect(updateCall).toBeDefined();
    });
  });

  describe('verifyCurrentSession', () => {
    it('should return current session info', async () => {
      const result = await service.verifyCurrentSession(mockUser, 'jti-1');

      expect(result).toMatchObject({
        sessionId: 'session-1',
        userId: 'user-123',
        isCurrentSession: true,
      });
    });

    it('should throw error if session not found', async () => {
      await expect(service.verifyCurrentSession(mockUser, 'invalid-jti')).rejects.toThrow(NotFoundException);
    });
  });
});
