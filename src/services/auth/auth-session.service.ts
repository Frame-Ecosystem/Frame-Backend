import { User, RefreshTokenSession } from '@interfaces/user/users.interface';
import { TokenData } from '@interfaces/auth/auth.interface';
import userModel from '@models/user/users.model';
import { HttpException, BadRequestException, UnauthorizedException, InternalServerException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logSecurityEvent, logger } from '@utils/logger';
import AuthTokenService from '@services/auth/auth-token.service';

class AuthSessionService {
  private users = userModel;
  private tokenService = new AuthTokenService();

  /**
   * Update sessionTrack with online status, lastSeen timestamp, and derived devices.
   * Single source of truth for keeping sessionTrack in sync with active refresh tokens.
   */
  public async updateSessionTrack(userId: string, sessions: any[]): Promise<void> {
    const derivedDevices = this.getDevicesFromSessions(sessions);
    await this.users.findByIdAndUpdate(userId, {
      'sessionTrack.isOnline': true,
      'sessionTrack.lastSeen': new Date(),
      'sessionTrack.devices': derivedDevices,
    });
  }

  /**
   * Parse a device name from the user agent string.
   */
  public parseDeviceName(userAgent?: string): string {
    if (!userAgent) return 'Unknown Device';

    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Macintosh')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux PC';
    if (userAgent.includes('Chrome')) return 'Chrome Browser';
    if (userAgent.includes('Firefox')) return 'Firefox Browser';
    if (userAgent.includes('Safari')) return 'Safari Browser';

    return 'Unknown Device';
  }

  /**
   * Derive devices from active refresh token sessions.
   * Single source of truth for device tracking.
   * Deduplicates based on name + IP combination.
   */
  public getDevicesFromSessions(sessions: RefreshTokenSession[]): Array<{ name: string; ipAddress?: string }> {
    const devices = sessions.map(s => ({
      name: s.deviceName || 'Unknown Device',
      ipAddress: s.ip || 'Unknown IP',
    }));

    const seen = new Set<string>();
    return devices.filter(device => {
      const key = `${device.name}|${device.ipAddress}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  public async logout(userData: User, jti?: string): Promise<User> {
    try {
      if (isEmpty(userData)) {
        logger.warn('Logout attempt with empty user data');
        throw new BadRequestException('Invalid request data');
      }

      const findUser: User = await this.users.findOne({ email: userData.email });
      if (!findUser) {
        logger.warn(`Logout attempt for non-existent user: ${userData.email}`);
        throw new UnauthorizedException('Unauthorized access');
      }

      const sessionToRemove = findUser.refreshTokens?.find(s => s.jti === jti);
      const deviceToRemove = sessionToRemove?.deviceName || 'Unknown Device';

      if (jti) {
        await this.users.findByIdAndUpdate(findUser._id, {
          $pull: { refreshTokens: { jti } },
          'sessionTrack.lastSeen': new Date(),
        });

        const updatedUser = await this.users.findById(findUser._id);
        const remainingSessions = (updatedUser?.refreshTokens || []).filter(s => new Date(s.expiresAt) > new Date());
        const derivedDevices = this.getDevicesFromSessions(remainingSessions);

        await this.users.findByIdAndUpdate(findUser._id, {
          'sessionTrack.isOnline': remainingSessions.length > 0,
          'sessionTrack.devices': derivedDevices,
        });

        logSecurityEvent({
          event: 'LOGOUT',
          userId: String(findUser._id),
          jti,
          deviceRemoved: deviceToRemove,
          remainingSessions: remainingSessions.length,
        });
      } else {
        await this.users.findByIdAndUpdate(findUser._id, {
          refreshTokens: [],
          'sessionTrack.isOnline': false,
          'sessionTrack.lastSeen': new Date(),
          'sessionTrack.devices': [],
        });
        logSecurityEvent({
          event: 'ALL_SESSIONS_REVOKED',
          userId: String(findUser._id),
          reason: 'Logout without jti',
        });
      }

      return await this.users.findById(findUser._id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`Logout error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Logout failed. Please try again');
    }
  }

  public async logoutAllDevices(userId: string): Promise<void> {
    try {
      if (!userId) {
        throw new BadRequestException('Invalid request data');
      }
      try {
        await this.users.findByIdAndUpdate(userId, {
          refreshTokens: [],
          'sessionTrack.isOnline': false,
          'sessionTrack.lastSeen': new Date(),
          'sessionTrack.devices': [],
        });
      } catch (revokeError) {
        logger.error(`Failed to revoke all sessions for user ${userId}: ${revokeError.message}`, {
          stack: revokeError.stack,
        });
        throw new InternalServerException('Failed to logout from all devices');
      }

      logSecurityEvent({
        event: 'ALL_SESSIONS_REVOKED',
        userId,
        reason: 'User requested logout from all devices',
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LogoutAllDevices error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Failed to logout from all devices');
    }
  }

  public async generateTokensForOAuthUser(
    user: User,
    deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string },
  ): Promise<{ tokenData: TokenData; refreshToken: string }> {
    try {
      const tokenData = this.tokenService.createToken(user);
      const refreshToken = await this.tokenService.generateRefreshToken(user, deviceInfo);

      await this.updateSessionTrack(
        String(user._id),
        Array.isArray(user.refreshTokens) ? user.refreshTokens : [],
      );

      logSecurityEvent({
        event: 'OAUTH_LOGIN_SUCCESS',
        userId: String(user._id),
        email: user.email,
        provider: 'google',
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
      });

      return { tokenData, refreshToken };
    } catch (error) {
      logger.error(`OAuth token generation failed: ${error.message}`, {
        stack: error.stack,
        userId: user._id,
        email: user.email,
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
      });
      throw new InternalServerException('Authentication failed');
    }
  }
}

export default AuthSessionService;
