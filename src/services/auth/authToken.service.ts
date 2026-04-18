import { sign, verify, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { hash, compare } from 'bcrypt';
import { SECRET_KEY, REFRESH_TOKEN_SECRET } from '@config';
import {
  ACCESS_TOKEN_EXPIRES_SECONDS,
  REFRESH_TOKEN_EXPIRES_SECONDS,
  REFRESH_TOKEN_EXPIRES_STRING,
  MAX_SESSIONS_PER_USER,
  BCRYPT_ROUNDS,
} from '@config/constants';
import { DataStoredInToken, TokenData, RefreshTokenPayload } from '@interfaces/auth/auth.interface';
import { User } from '@interfaces/user/user.interface';
import userModel from '@models/user/user.model';
import {
  HttpException,
  UnauthorizedException,
  NotFoundException,
  InternalServerException,
  BadRequestException,
  ForbiddenException,
} from '@exceptions/HttpException';
import { v4 as uuidv4 } from 'uuid';
import { logSecurityEvent, logger } from '@utils/logger';
import { sendPasswordResetEmail } from '@utils/email';
import verificationTokenModel from '@models/auth/verificationToken.model';
import { FRONTEND_BASE_URL } from '@config';

class AuthTokenService {
  private users = userModel;

  public async getUserByToken(token: string): Promise<User> {
    try {
      if (!token) {
        logSecurityEvent({
          event: 'INVALID_TOKEN',
          reason: 'Empty token provided',
        });
        throw new UnauthorizedException('Authentication failed', 'INVALID_TOKEN');
      }

      const secretKey: string = SECRET_KEY;
      const decodedToken = verify(token, secretKey) as DataStoredInToken;

      const user: User = await this.users.findById(decodedToken._id);
      if (!user) {
        logSecurityEvent({
          event: 'INVALID_TOKEN',
          reason: 'User not found for token',
          userId: decodedToken._id,
        });
        throw new NotFoundException('User not found');
      }

      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      if (error instanceof TokenExpiredError) {
        logSecurityEvent({
          event: 'INVALID_TOKEN',
          reason: 'Token expired',
          expiredAt: error.expiredAt?.toISOString(),
        });
      } else if (error instanceof JsonWebTokenError) {
        logSecurityEvent({
          event: 'INVALID_TOKEN',
          reason: `JWT error: ${error.message}`,
        });
      } else if (error instanceof NotBeforeError) {
        logSecurityEvent({
          event: 'INVALID_TOKEN',
          reason: 'Token not yet valid',
        });
      } else {
        logger.error(`GetUserByToken unexpected error: ${error.message}`, { stack: error.stack });
      }

      throw new UnauthorizedException('Authentication failed', 'INVALID_TOKEN');
    }
  }

  public createToken(user: User): TokenData {
    const dataStoredInToken: DataStoredInToken = { _id: user._id };
    const secretKey: string = SECRET_KEY;

    return { expiresIn: ACCESS_TOKEN_EXPIRES_SECONDS, token: sign(dataStoredInToken, secretKey, { expiresIn: ACCESS_TOKEN_EXPIRES_SECONDS }) };
  }

  public async generateRefreshToken(user: User, deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string }): Promise<string> {
    const jti = uuidv4();
    const refreshToken = sign({ _id: user._id, jti }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_STRING });
    const hashedRefreshToken = await hash(refreshToken, BCRYPT_ROUNDS);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_SECONDS * 1000);

    const newSession = {
      jti,
      tokenHash: hashedRefreshToken,
      userAgent: deviceInfo?.userAgent,
      ip: deviceInfo?.ip,
      deviceName: deviceInfo?.deviceName,
      createdAt: now,
      expiresAt,
    };

    const currentUser = await this.users.findById(user._id);
    let sessions = (currentUser?.refreshTokens || []).filter(s => new Date(s.expiresAt) > now);

    if (sessions.length >= MAX_SESSIONS_PER_USER) {
      sessions = sessions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      sessions = sessions.slice(1);
    }

    sessions.push(newSession);

    await this.users.findByIdAndUpdate(user._id, { refreshTokens: sessions });

    return refreshToken;
  }

  public async refreshAccessToken(
    refreshToken: string,
    deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string },
  ): Promise<{ tokenData: TokenData; newRefreshToken: string }> {
    let decoded: RefreshTokenPayload | null = null;

    try {
      if (!refreshToken) {
        logSecurityEvent({
          event: 'TOKEN_REFRESH_FAILED',
          reason: 'No refresh token provided',
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        });
        throw new UnauthorizedException('Authentication failed', 'INVALID_TOKEN');
      }

      try {
        decoded = verify(refreshToken, REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
      } catch (jwtError) {
        if (jwtError instanceof TokenExpiredError) {
          logSecurityEvent({
            event: 'TOKEN_REFRESH_FAILED',
            reason: 'JWT expired',
            expiredAt: jwtError.expiredAt?.toISOString(),
            ip: deviceInfo?.ip,
            userAgent: deviceInfo?.userAgent,
          });
          throw new UnauthorizedException('Session expired. Please login again', 'TOKEN_EXPIRED');
        } else if (jwtError instanceof JsonWebTokenError) {
          logSecurityEvent({
            event: 'TOKEN_REFRESH_FAILED',
            reason: `JWT malformed: ${jwtError.message}`,
            ip: deviceInfo?.ip,
            userAgent: deviceInfo?.userAgent,
          });
        } else if (jwtError instanceof NotBeforeError) {
          logSecurityEvent({
            event: 'TOKEN_REFRESH_FAILED',
            reason: 'JWT not yet valid (nbf claim)',
            ip: deviceInfo?.ip,
            userAgent: deviceInfo?.userAgent,
          });
        } else {
          logSecurityEvent({
            event: 'TOKEN_REFRESH_FAILED',
            reason: `JWT verification error: ${jwtError.message}`,
            ip: deviceInfo?.ip,
            userAgent: deviceInfo?.userAgent,
          });
        }
        throw new UnauthorizedException('Authentication failed', 'INVALID_TOKEN');
      }

      const user = await this.users.findById(decoded._id);

      if (!user || !user.refreshTokens || user.refreshTokens.length === 0) {
        logSecurityEvent({
          event: 'TOKEN_REFRESH_FAILED',
          reason: 'User not found or no sessions',
          userId: decoded._id,
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        });
        throw new UnauthorizedException('Authentication failed', 'INVALID_TOKEN');
      }

      // Block suspended accounts from refreshing tokens
      if (user.isBlocked) {
        logSecurityEvent({
          event: 'TOKEN_REFRESH_FAILED',
          reason: 'Blocked account refresh attempt',
          userId: String(user._id),
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        });
        // Revoke all sessions for blocked users
        await this.users.findByIdAndUpdate(user._id, {
          refreshTokens: [],
          'sessionTrack.isOnline': false,
          'sessionTrack.devices': [],
        });
        throw new ForbiddenException('Account suspended. Please contact support.', 'ACCOUNT_BLOCKED');
      }

      const session = user.refreshTokens.find(s => s.jti === decoded.jti);

      if (!session) {
        logSecurityEvent({
          event: 'TOKEN_REUSE_DETECTED',
          userId: String(user._id),
          jti: decoded.jti,
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          reason: 'Refresh token already rotated - possible token theft',
          sessionCount: user.refreshTokens.length,
        });

        try {
          await this.users.findByIdAndUpdate(user._id, { refreshTokens: [] });
        } catch (revokeError) {
          logger.error(`Failed to revoke tokens after reuse detection: ${revokeError.message}`, {
            userId: String(user._id),
            stack: revokeError.stack,
          });
          throw new InternalServerException('Security error: Please login again');
        }
        throw new UnauthorizedException('Security alert: Please login again', 'TOKEN_REUSE');
      }

      if (new Date(session.expiresAt) < new Date()) {
        logSecurityEvent({
          event: 'TOKEN_REFRESH_FAILED',
          reason: 'Session expired in DB',
          userId: String(user._id),
          jti: decoded.jti,
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          sessionExpiresAt: session.expiresAt.toISOString(),
        });
        await this.users.findByIdAndUpdate(user._id, {
          $pull: { refreshTokens: { jti: decoded.jti } },
        });
        throw new UnauthorizedException('Session expired. Please login again', 'TOKEN_EXPIRED');
      }

      const isRefreshTokenValid = await compare(refreshToken, session.tokenHash);
      if (!isRefreshTokenValid) {
        logSecurityEvent({
          event: 'TOKEN_REFRESH_FAILED',
          reason: 'Token hash mismatch - possible tampering',
          userId: String(user._id),
          jti: decoded.jti,
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        });
        throw new UnauthorizedException('Authentication failed', 'INVALID_TOKEN');
      }

      await this.users.findByIdAndUpdate(user._id, {
        $pull: { refreshTokens: { jti: decoded.jti } },
      });

      const newRefreshToken = await this.generateRefreshToken(user, deviceInfo);
      const tokenData = this.createToken(user);

      logSecurityEvent({
        event: 'TOKEN_REFRESH_SUCCESS',
        userId: String(user._id),
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
      });

      await this.users.findByIdAndUpdate(user._id, { 'sessionTrack.lastSeen': new Date() });

      return { tokenData, newRefreshToken };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`RefreshAccessToken unexpected error: ${error.message}`, {
        stack: error.stack,
        userId: decoded?._id,
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
      });
      throw new UnauthorizedException('Authentication failed', 'INVALID_TOKEN');
    }
  }

  public async forgotPassword(email: string): Promise<void> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const user = await this.users.findOne({ email: normalizedEmail });
      if (!user) {
        logger.info(`Password reset requested for non-existent email: ${normalizedEmail}`);
        return;
      }

      // Remove any existing password reset tokens for this email
      await verificationTokenModel.deleteMany({ email: normalizedEmail, tokenType: 'password_reset' });

      const resetToken = uuidv4();
      await verificationTokenModel.create({
        token: resetToken,
        email: normalizedEmail,
        type: user.type,
        phoneNumber: user.phoneNumber,
        tokenType: 'password_reset',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const resetLink = `${FRONTEND_BASE_URL}/auth/reset-password?token=${resetToken}`;

      try {
        await sendPasswordResetEmail(normalizedEmail, resetLink);
        logger.info(`Password reset email sent to: ${normalizedEmail}`);
      } catch (emailError) {
        logger.error(`Failed to send password reset email to ${normalizedEmail}: ${emailError.message}`);
        await verificationTokenModel.deleteOne({ token: resetToken });
        throw new InternalServerException('Failed to send reset email. Please try again.');
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`Forgot password error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Password reset request failed. Please try again');
    }
  }

  public async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const resetRecord = await verificationTokenModel.findOne({ token, tokenType: 'password_reset' });
      if (!resetRecord) {
        throw new BadRequestException('Invalid or expired reset link');
      }

      if (new Date() > resetRecord.expiresAt) {
        await verificationTokenModel.deleteOne({ token });
        throw new BadRequestException('Reset link has expired. Please request a new one.');
      }

      const user = await this.users.findOne({ email: resetRecord.email });
      if (!user) {
        await verificationTokenModel.deleteOne({ token });
        throw new BadRequestException('User not found');
      }

      const hashedPassword = await hash(newPassword, BCRYPT_ROUNDS);

      // Update password, invalidate all sessions, reset lockout, and set passwordChangedAt
      await this.users.findByIdAndUpdate(user._id, {
        password: hashedPassword,
        refreshTokens: [],
        failedLoginAttempts: 0,
        lockUntil: null,
        passwordChangedAt: new Date(),
        'sessionTrack.isOnline': false,
        'sessionTrack.devices': [],
      });
      await verificationTokenModel.deleteOne({ token });

      logSecurityEvent({
        event: 'PASSWORD_RESET',
        userId: String(user._id),
        email: resetRecord.email,
        sessionsRevoked: true,
      });

      logger.info(`Password reset successful for user: ${user._id} — all sessions revoked`);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`Reset password error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Password reset failed. Please try again');
    }
  }
}

export default AuthTokenService;
