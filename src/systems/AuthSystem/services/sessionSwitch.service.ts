import { v4 as uuidv4 } from 'uuid';
import { User, RefreshTokenSession } from '@systems/UserManager/interfaces/user.interface';
import { TokenData } from '@systems/AuthSystem/interfaces/auth.interface';
import userModel from '@systems/UserManager/models/user.model';
import {
  HttpException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  InternalServerException,
} from '@exceptions/HttpException';
import { logSecurityEvent, logger } from '@utils/logger';
import AuthTokenService from '@systems/AuthSystem/services/authToken.service';

export interface SessionInfo {
  sessionId: string;
  userId: string;
  displayName: string;
  emailOrPhoneMasked: string;
  deviceName: string;
  createdAt: string; // ISO
  lastUsedAt: string; // ISO
  isCurrent: boolean;
}

/**
 * SessionSwitchService handles multi-account session switching.
 *
 * Key responsibilities:
 * 1. List all active sessions for a user (with masking)
 * 2. Verify session ownership before switching
 * 3. Generate new auth artifacts on successful switch
 * 4. Audit log all switch attempts
 * 5. Enforce behavioral contract: no silent fallback
 */
class SessionSwitchService {
  private users = userModel;
  private tokenService = new AuthTokenService();

  /**
   * Mask email or phone number for display (e.g., user@***.com or +1***5678)
   */
  private maskEmailOrPhone(emailOrPhone?: string): string {
    if (!emailOrPhone) return 'Unknown';

    if (emailOrPhone.includes('@')) {
      // Email: user@example.com -> u***@example.com
      const [localPart, domain] = emailOrPhone.split('@');
      const maskedLocal = localPart.charAt(0) + '***';
      return `${maskedLocal}@${domain}`;
    } else {
      // Phone: +1234567890 -> +1***7890
      const visible = emailOrPhone.slice(-4);
      const prefix = emailOrPhone.slice(0, -4);
      return `${prefix}***${visible}`;
    }
  }

  /**
   * Format display name from user object
   */
  private getDisplayName(user: User): string {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    if (user.loungeTitle) return user.loungeTitle;
    if (user.email) return user.email.split('@')[0];
    return 'Unknown User';
  }

  /**
   * List all active sessions for the authenticated user.
   * Includes the current session ID from the active token's jti.
   */
  public async listSessions(user: User, currentJti?: string): Promise<SessionInfo[]> {
    try {
      if (!user || !user._id) {
        throw new BadRequestException('Invalid user context');
      }

      const now = new Date();
      const activeSessions = (user.refreshTokens || []).filter(s => new Date(s.expiresAt) > now);

      if (activeSessions.length === 0) {
        return [];
      }

      const displayName = this.getDisplayName(user);
      const emailOrPhone = user.email || user.phoneNumber;
      const maskedIdentifier = this.maskEmailOrPhone(emailOrPhone);

      return activeSessions.map(session => ({
        sessionId: session.sessionId || '', // Safe fallback
        userId: String(user._id),
        displayName,
        emailOrPhoneMasked: maskedIdentifier,
        deviceName: session.deviceName || 'Unknown Device',
        createdAt: new Date(session.createdAt).toISOString(),
        lastUsedAt: session.lastUsedAt ? new Date(session.lastUsedAt).toISOString() : new Date(session.createdAt).toISOString(),
        isCurrent: session.jti === currentJti,
      }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`ListSessions error: ${error.message}`, { userId: String(user?._id), stack: error.stack });
      throw new InternalServerException('Failed to list sessions');
    }
  }

  /**
   * Switch to a specific session owned by the user.
   *
   * Behavior:
   * 1. Verify sessionId belongs to the user
   * 2. Verify session is active and not expired
   * 3. Revoke the old session (prevent token reuse chain)
   * 4. Issue new auth artifacts bound to target session
   * 5. Audit log the switch
   *
   * No silent fallback — fails if session invalid.
   */
  public async switchSession(
    user: User,
    targetSessionId: string,
    currentJti: string,
    deviceInfo?: { userAgent?: string; ip?: string },
  ): Promise<{ token: string; expiresIn: number; csrfToken: string; data: any }> {
    try {
      if (!user || !user._id) {
        throw new BadRequestException('Invalid user context');
      }

      if (!targetSessionId) {
        throw new BadRequestException('Session ID is required');
      }

      // Fetch fresh user data to avoid stale session list
      const freshUser = await this.users.findById(user._id);
      if (!freshUser) {
        logSecurityEvent({
          event: 'SESSION_SWITCH_FAILED',
          reason: 'User not found',
          userId: String(user._id),
          targetSessionId,
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        });
        throw new NotFoundException('User not found');
      }

      // Reject blocked accounts
      if (freshUser.isBlocked) {
        logSecurityEvent({
          event: 'SESSION_SWITCH_FAILED',
          reason: 'Blocked account',
          userId: String(freshUser._id),
          targetSessionId,
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        });
        throw new ForbiddenException('Account suspended. Please contact support.');
      }

      const now = new Date();
      const targetSession = (freshUser.refreshTokens || []).find(s => s.sessionId === targetSessionId);

      if (!targetSession) {
        logSecurityEvent({
          event: 'SESSION_SWITCH_FAILED',
          reason: 'Session not found',
          userId: String(freshUser._id),
          targetSessionId,
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        });
        throw new NotFoundException('Session not found or already revoked');
      }

      // Verify session is not expired
      if (new Date(targetSession.expiresAt) < now) {
        // Clean up expired session
        await this.users.findByIdAndUpdate(freshUser._id, {
          $pull: { refreshTokens: { sessionId: targetSessionId } },
        });

        logSecurityEvent({
          event: 'SESSION_SWITCH_FAILED',
          reason: 'Target session expired',
          userId: String(freshUser._id),
          targetSessionId,
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        });
        throw new ConflictException('Session expired. Please login again.');
      }

      // Revoke the current (source) session to prevent token reuse chain
      const updatedSessions = (freshUser.refreshTokens || []).filter(s => s.jti !== currentJti && s.sessionId !== targetSessionId);

      // Add target session back with updated lastUsedAt
      const switchedSession = {
        ...targetSession,
        lastUsedAt: now,
      };
      updatedSessions.push(switchedSession);

      await this.users.findByIdAndUpdate(freshUser._id, { refreshTokens: updatedSessions });

      // Generate new access token for the switched account
      const tokenData = this.tokenService.createToken(freshUser);

      // Generate new refresh token bound to the switched session
      const newRefreshToken = await this.tokenService.generateRefreshToken(freshUser, deviceInfo);

      logSecurityEvent({
        event: 'SESSION_SWITCH_SUCCESS',
        userId: String(freshUser._id),
        sourceSessionId: currentJti, // Old JTI for audit trail
        targetSessionId,
        deviceName: targetSession.deviceName,
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
      });

      // Update global session tracking
      await this.users.findByIdAndUpdate(freshUser._id, { 'sessionTrack.lastSeen': now });

      // Prepare response (caller will set refresh token cookie)
      return {
        token: tokenData.token,
        expiresIn: tokenData.expiresIn,
        csrfToken: uuidv4(), // Frontend will use CSRF endpoint to get fresh token from cookie
        data: freshUser,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`SwitchSession error: ${error.message}`, {
        userId: String(user?._id),
        targetSessionId,
        stack: error.stack,
      });
      throw new InternalServerException('Session switch failed');
    }
  }

  /**
   * Verify the current active session matches the user's expectation.
   * Useful for frontend to assert post-switch correctness.
   */
  public async verifyCurrentSession(
    user: User,
    currentJti: string,
  ): Promise<{ sessionId: string; userId: string; isCurrentSession: boolean }> {
    try {
      if (!user || !user._id) {
        throw new BadRequestException('Invalid user context');
      }

      const session = (user.refreshTokens || []).find(s => s.jti === currentJti);

      if (!session) {
        throw new NotFoundException('Current session not found');
      }

      return {
        sessionId: session.sessionId || '',
        userId: String(user._id),
        isCurrentSession: true,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`VerifyCurrentSession error: ${error.message}`, { userId: String(user?._id), stack: error.stack });
      throw new InternalServerException('Failed to verify session');
    }
  }
}

export default SessionSwitchService;
