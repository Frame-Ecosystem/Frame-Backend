import { hash, compare } from 'bcrypt';
import { sign, verify, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { SECRET_KEY, REFRESH_TOKEN_SECRET } from '@config';
import {
  ACCESS_TOKEN_EXPIRES_SECONDS,
  REFRESH_TOKEN_EXPIRES_SECONDS,
  REFRESH_TOKEN_EXPIRES_STRING,
  MAX_SESSIONS_PER_USER,
  BCRYPT_ROUNDS,
} from '../config/constants';
import { CreateUserDto, LoginUserDto } from '@dtos/users.dto';
import {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  InternalServerException,
} from '@exceptions/HttpException';
import { DataStoredInToken, TokenData, RefreshTokenPayload } from '@interfaces/auth.interface';
import { User, RefreshTokenSession } from '@interfaces/users.interface';
import userModel from '@models/users.model';
import verificationTokenModel from '@models/verificationToken.model';
import { isEmpty, handleMongoDBDuplicateKeyError } from '@utils/util';
import { v4 as uuidv4 } from 'uuid';
import { logSecurityEvent, logger } from '@utils/logger';
import { sendMagicLinkEmail, sendPasswordResetEmail } from '@utils/email';

class AuthService {
  public users = userModel;

  public async signup(userData: CreateUserDto, deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string }): Promise<{ message: string }> {
    try {
      if (isEmpty(userData)) {
        logger.warn('Signup attempt with empty data');
        throw new BadRequestException('Invalid request data');
      }

      // Validate that email is provided (required for magic link verification)
      if (!userData.email) {
        logger.warn('Signup attempt without email');
        throw new BadRequestException('Email is required for registration', 'EMAIL_REQUIRED');
      }

      // Normalize email to lowercase for consistent storage and lookup
      const normalizedEmail = userData.email.toLowerCase().trim();

      // Check for existing email
      const findByEmail: User = await this.users.findOne({ email: normalizedEmail });
      if (findByEmail) {
        logger.info(`Signup attempt with existing email: ${userData.email}`);
        throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
      }

      // Check for existing phone number (if provided)
      if (userData.phoneNumber) {
        const findByPhone: User = await this.users.findOne({ phoneNumber: userData.phoneNumber });
        if (findByPhone) {
          logger.error(`Signup attempt with existing phone number: ${userData.phoneNumber}`);
          throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
        }
      }

      // Hash the password for storage
      const hashedPassword = await hash(userData.password, BCRYPT_ROUNDS);

      // Generate a unique verification token
      const verificationToken = uuidv4();

      // Create verification token record (expires in 10 minutes)
      const tokenData = {
        token: verificationToken,
        email: normalizedEmail,
        password: hashedPassword,
        type: userData.type || 'user',
        phoneNumber: userData.phoneNumber,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      };

      await verificationTokenModel.create(tokenData);

      // Generate magic link
      const origin = process.env.ORIGIN || 'http://localhost:3001';
      const magicLink = `${origin}/auth/verify?token=${verificationToken}`;

      // Send magic link email
      try {
        await sendMagicLinkEmail(normalizedEmail, magicLink);
        logger.info(`Magic link sent to: ${normalizedEmail}`);
      } catch (emailError) {
        logger.error(`Failed to send magic link email to ${normalizedEmail}: ${emailError.message}`);
        // Clean up the verification token if email fails
        await verificationTokenModel.deleteOne({ token: verificationToken });
        throw new InternalServerException('Failed to send verification email. Please try again.');
      }

      logSecurityEvent({
        event: 'SIGNUP_INITIATED',
        email: normalizedEmail,
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
        deviceName: deviceInfo?.deviceName,
      });

      return { message: 'Verification email sent. Please check your email and click the link to complete registration.' };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongoDBDuplicateKeyError(error);
      logger.error(`Signup error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Registration failed. Please try again');
    }
  }

  public async verifyMagicLink(
    token: string,
    deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string },
  ): Promise<{ user: User; tokenData: TokenData; refreshToken: string }> {
    try {
      if (isEmpty(token)) {
        logger.warn('Magic link verification attempt with empty token');
        throw new BadRequestException('Verification token is required');
      }

      // Find and validate the verification token
      const verificationRecord = await verificationTokenModel.findOne({ token });
      if (!verificationRecord) {
        logger.warn(`Magic link verification failed: token not found - ${token}`);
        throw new BadRequestException('Invalid or expired verification link');
      }

      // Check if token has expired
      if (new Date() > verificationRecord.expiresAt) {
        logger.warn(`Magic link verification failed: token expired - ${token}`);
        // Clean up expired token
        await verificationTokenModel.deleteOne({ token });
        throw new BadRequestException('Verification link has expired. Please sign up again.');
      }

      // Construct user data from verification token
      const userData = {
        email: verificationRecord.email,
        password: verificationRecord.password,
        phoneNumber: verificationRecord.phoneNumber,
        type: verificationRecord.type,
        isBlocked: false,
        emailVerification: [{ isVerified: true }], // Mark email as verified since they clicked the magic link
      };

      // Double-check that email is still available (race condition protection)
      const existingUser = await this.users.findOne({ email: userData.email });
      if (existingUser) {
        logger.warn(`Magic link verification failed: email already exists - ${userData.email}`);
        await verificationTokenModel.deleteOne({ token });
        throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
      }

      // Check phone number if provided
      if (userData.phoneNumber) {
        const existingPhone = await this.users.findOne({ phoneNumber: userData.phoneNumber });
        if (existingPhone) {
          logger.warn(`Magic link verification failed: phone already exists - ${userData.phoneNumber}`);
          await verificationTokenModel.deleteOne({ token });
          throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
        }
      }

      // Create the user account
      const createUserData = await this.users.create(userData);
      logger.info(`User account created via magic link verification: ${createUserData._id}`);

      // Clean up the verification token
      await verificationTokenModel.deleteOne({ token });

      // Generate tokens for login
      const tokenData = this.createToken(createUserData);
      const refreshToken = await this.generateRefreshToken(createUserData, deviceInfo);

      // Update sessionTrack with online status
      const derivedDevices = this.getDevicesFromSessions(Array.isArray(createUserData.refreshTokens) ? createUserData.refreshTokens : []);

      await this.users.findByIdAndUpdate(createUserData._id, {
        'sessionTrack.isOnline': true,
        'sessionTrack.lastSeen': new Date(),
        'sessionTrack.devices': derivedDevices,
      });

      // Get updated user
      const updatedUser = await this.users.findById(createUserData._id);

      logSecurityEvent({
        event: 'SIGNUP_COMPLETED',
        userId: String(createUserData._id),
        email: userData.email,
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
        deviceName: deviceInfo?.deviceName,
      });

      return { user: updatedUser, tokenData, refreshToken };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`Magic link verification error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Verification failed. Please try again');
    }
  }

  public async forgotPassword(email: string): Promise<void> {
    try {
      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Find user by email
      const user = await this.users.findOne({ email: normalizedEmail });
      if (!user) {
        // Don't reveal if email exists or not for security
        logger.info(`Password reset requested for non-existent email: ${normalizedEmail}`);
        return; // Silently return to prevent email enumeration
      }

      // Generate reset token
      const resetToken = uuidv4();

      // Create password reset token record (expires in 10 minutes)
      const tokenData = {
        token: resetToken,
        email: normalizedEmail,
        type: user.type,
        phoneNumber: user.phoneNumber,
        tokenType: 'password_reset',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      };

      await verificationTokenModel.create(tokenData);

      // Generate reset link
      const origin = process.env.ORIGIN || 'http://localhost:3001';
      const resetLink = `${origin}/auth/reset-password?token=${resetToken}`;

      // Send reset email
      try {
        await sendPasswordResetEmail(normalizedEmail, resetLink);
        logger.info(`Password reset email sent to: ${normalizedEmail}`);
      } catch (emailError) {
        logger.error(`Failed to send password reset email to ${normalizedEmail}: ${emailError.message}`);
        // Clean up the reset token if email fails
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
      // Find and validate the reset token
      const resetRecord = await verificationTokenModel.findOne({ token, tokenType: 'password_reset' });
      if (!resetRecord) {
        logger.warn(`Password reset failed: token not found - ${token}`);
        throw new BadRequestException('Invalid or expired reset link');
      }

      // Check if token has expired
      if (new Date() > resetRecord.expiresAt) {
        logger.warn(`Password reset failed: token expired - ${token}`);
        // Clean up expired token
        await verificationTokenModel.deleteOne({ token });
        throw new BadRequestException('Reset link has expired. Please request a new one.');
      }

      // Find user by email
      const user = await this.users.findOne({ email: resetRecord.email });
      if (!user) {
        logger.error(`Password reset failed: user not found - ${resetRecord.email}`);
        await verificationTokenModel.deleteOne({ token });
        throw new BadRequestException('User not found');
      }

      // Hash new password
      const hashedPassword = await hash(newPassword, BCRYPT_ROUNDS);

      // Update user password
      await this.users.findByIdAndUpdate(user._id, { password: hashedPassword });

      // Clean up the reset token
      await verificationTokenModel.deleteOne({ token });

      logSecurityEvent({
        event: 'PASSWORD_RESET',
        userId: String(user._id),
        email: resetRecord.email,
      });

      logger.info(`Password reset successful for user: ${user._id}`);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`Reset password error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Password reset failed. Please try again');
    }
  }

  public async login(
    userData: LoginUserDto,
    deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string },
  ): Promise<{ findUser: User; tokenData: TokenData; refreshToken: string }> {
    try {
      if (isEmpty(userData)) {
        logger.warn('Login attempt with empty data');
        throw new BadRequestException('Invalid request data');
      }

      // Determine if input is email or phone number
      const identifier = userData.emailOrPhone.trim();
      const isEmail = identifier.includes('@');

      // Find user by email or phone
      let findUser: User;
      if (isEmail) {
        const normalizedEmail = identifier.toLowerCase();
        findUser = await this.users.findOne({ email: normalizedEmail });
      } else {
        // Assume it's a phone number
        findUser = await this.users.findOne({ phoneNumber: identifier });
      }

      if (!findUser) {
        logSecurityEvent({
          event: 'LOGIN_FAILED',
          reason: 'User not found',
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          attemptedIdentifier: identifier,
          identifierType: isEmail ? 'email' : 'phone',
        });
        const fieldName = isEmail ? 'email' : 'phone number';
        throw new UnauthorizedException(`Invalid ${fieldName}`, 'INVALID_IDENTIFIER');
      }

      const isPasswordMatching: boolean = await compare(userData.password, findUser.password);
      if (!isPasswordMatching) {
        logSecurityEvent({
          event: 'LOGIN_FAILED',
          reason: 'Invalid password',
          userId: String(findUser._id),
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        });
        throw new UnauthorizedException('Invalid password', 'INVALID_PASSWORD');
      }

      const tokenData = this.createToken(findUser);
      const refreshToken = await this.generateRefreshToken(findUser, deviceInfo);

      // Update sessionTrack with online status only
      // Devices are derived from active refresh tokens - single source of truth
      const derivedDevices = this.getDevicesFromSessions(Array.isArray(findUser.refreshTokens) ? findUser.refreshTokens : []);

      await this.users.findByIdAndUpdate(findUser._id, {
        'sessionTrack.isOnline': true,
        'sessionTrack.lastSeen': new Date(),
        'sessionTrack.devices': derivedDevices,
      });

      // Get updated user and session count
      const updatedUser = await this.users.findById(findUser._id);

      // Debug: Verify the isOnline status was set
      logger.info('AuthService.login: sessionTrack status after update', {
        userId: String(findUser._id),
        email: findUser.email,
        isOnline: updatedUser?.sessionTrack?.isOnline,
        lastSeen: updatedUser?.sessionTrack?.lastSeen,
        devices: updatedUser?.sessionTrack?.devices,
      });

      const sessionCount = (Array.isArray(updatedUser?.refreshTokens) ? updatedUser.refreshTokens : []).filter(
        s => s && s.expiresAt && new Date(s.expiresAt) > new Date(),
      ).length;

      logSecurityEvent({
        event: 'LOGIN_SUCCESS',
        userId: String(findUser._id),
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
        deviceName: deviceInfo?.deviceName || this.parseDeviceName(deviceInfo?.userAgent),
        sessionCount,
        hasMultipleSessions: sessionCount > 1,
      });

      return { findUser: updatedUser, tokenData, refreshToken };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`Login error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Login failed. Please try again');
    }
  }

  // Helper to parse device name from user agent
  private parseDeviceName(userAgent?: string): string {
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
   * Derive devices from active refresh token sessions
   * This is the single source of truth for device tracking
   * Deduplicates based on name + IP combination
   * Fix #2: Provides default 'Unknown IP' when IP is undefined
   */
  private getDevicesFromSessions(sessions: RefreshTokenSession[]): Array<{ name: string; ipAddress?: string }> {
    const devices = sessions.map(s => ({
      name: s.deviceName || 'Unknown Device',
      ipAddress: s.ip || 'Unknown IP', // Fix #2: Default IP when undefined
    }));

    // Deduplicate by name + IP combination
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

      // Get the device name from the session being logged out
      const sessionToRemove = findUser.refreshTokens?.find(s => s.jti === jti);
      const deviceToRemove = sessionToRemove?.deviceName || 'Unknown Device';

      if (jti) {
        // Logout from specific device/session
        await this.users.findByIdAndUpdate(findUser._id, {
          $pull: { refreshTokens: { jti } },
          'sessionTrack.lastSeen': new Date(),
        });

        // Check remaining active sessions to update online status and devices
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
        // Logout from all devices - set offline and clear devices
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
      // Fix #4: Add error handling for revocation failure
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

      // Detailed internal logging for JWT errors
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
    // Generate unique token ID for rotation/reuse detection
    const jti = uuidv4();
    const refreshToken = sign({ _id: user._id, jti }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_STRING });
    // Hash refresh token before storing for security
    const hashedRefreshToken = await hash(refreshToken, BCRYPT_ROUNDS);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_SECONDS * 1000);

    const newSession: RefreshTokenSession = {
      jti,
      tokenHash: hashedRefreshToken,
      userAgent: deviceInfo?.userAgent,
      ip: deviceInfo?.ip,
      deviceName: deviceInfo?.deviceName,
      createdAt: now,
      expiresAt,
    };

    // Get current sessions, remove expired ones, and limit to MAX_SESSIONS_PER_USER
    const currentUser = await this.users.findById(user._id);
    let sessions = (currentUser?.refreshTokens || []).filter(s => new Date(s.expiresAt) > now);

    // If at max sessions, remove the oldest one
    if (sessions.length >= MAX_SESSIONS_PER_USER) {
      sessions = sessions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      sessions = sessions.slice(1); // Remove oldest
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
        // Detailed internal logging for JWT-specific errors
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

      // Find the session with matching jti
      const session = user.refreshTokens.find(s => s.jti === decoded.jti);

      if (!session) {
        // Token reuse detected! jti not found but token is valid
        // This means the token was already rotated - possible theft
        logSecurityEvent({
          event: 'TOKEN_REUSE_DETECTED',
          userId: String(user._id),
          jti: decoded.jti,
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          reason: 'Refresh token already rotated - possible token theft',
          sessionCount: user.refreshTokens.length,
        });

        // Fix #4: Add error handling for token revocation failure
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

      // Check if session is expired (belt-and-suspenders with JWT exp)
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
        // Remove expired session
        await this.users.findByIdAndUpdate(user._id, {
          $pull: { refreshTokens: { jti: decoded.jti } },
        });
        throw new UnauthorizedException('Session expired. Please login again', 'TOKEN_EXPIRED');
      }

      // Compare hashed refresh token
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

      // Remove old session before rotation
      await this.users.findByIdAndUpdate(user._id, {
        $pull: { refreshTokens: { jti: decoded.jti } },
      });

      // Rotation: issue new refresh token with new jti
      const newRefreshToken = await this.generateRefreshToken(user, deviceInfo);
      const tokenData = this.createToken(user);

      logSecurityEvent({
        event: 'TOKEN_REFRESH_SUCCESS',
        userId: String(user._id),
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
      });

      // Update lastSeen on token refresh
      await this.users.findByIdAndUpdate(user._id, { 'sessionTrack.lastSeen': new Date() });

      return { tokenData, newRefreshToken };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Unexpected error - log full details internally
      logger.error(`RefreshAccessToken unexpected error: ${error.message}`, {
        stack: error.stack,
        userId: decoded?._id,
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
      });
      throw new UnauthorizedException('Authentication failed', 'INVALID_TOKEN');
    }
  }

  public async generateTokensForOAuthUser(
    user: User,
    deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string },
  ): Promise<{ tokenData: TokenData; refreshToken: string }> {
    try {
      // Use the same flow as regular login/signup
      const tokenData = this.createToken(user);
      const refreshToken = await this.generateRefreshToken(user, deviceInfo);

      // Update sessionTrack
      const derivedDevices = this.getDevicesFromSessions(Array.isArray(user.refreshTokens) ? user.refreshTokens : []);
      await this.users.findByIdAndUpdate(user._id, {
        'sessionTrack.isOnline': true,
        'sessionTrack.lastSeen': new Date(),
        'sessionTrack.devices': derivedDevices,
      });

      // Log successful OAuth authentication
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

export default AuthService;
