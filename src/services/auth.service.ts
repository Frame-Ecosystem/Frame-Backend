import { hash, compare } from 'bcrypt';
import { sign, verify, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { SECRET_KEY, REFRESH_TOKEN_SECRET } from '@config';
import {
  ACCESS_TOKEN_EXPIRES_SECONDS,
  REFRESH_TOKEN_EXPIRES_SECONDS,
  REFRESH_TOKEN_EXPIRES_STRING,
  MAX_SESSIONS_PER_USER,
  BCRYPT_ROUNDS,
  RETRY_BACKOFF_BASE_MS,
  RETRY_MAX_ATTEMPTS,
} from '../config/constants';
import { CreateUserDto, LoginUserDto, ChangePasswordDto } from '@dtos/users.dto';
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
import { isEmpty, handleMongoDBDuplicateKeyError } from '@utils/util';
import { v4 as uuidv4 } from 'uuid';
import { logSecurityEvent, logger } from '@utils/logger';

class AuthService {
  public users = userModel;

  public async signup(userData: CreateUserDto): Promise<User> {
    try {
      if (isEmpty(userData)) {
        logger.warn('Signup attempt with empty data');
        throw new BadRequestException('Invalid request data');
      }

      // Normalize email to lowercase for consistent storage and lookup
      const normalizedEmail = userData.email.toLowerCase().trim();

      // Normalize username to lowercase for case-insensitive uniqueness
      const normalizedUsername = userData.username.toLowerCase().trim();

      // Check for existing email
      const findByEmail: User = await this.users.findOne({ email: normalizedEmail });
      if (findByEmail) {
        logger.info(`Signup attempt with existing email: ${userData.email}`);
        throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
      }

      // Check for existing username
      const findByUsername: User = await this.users.findOne({ username: normalizedUsername });
      if (findByUsername) {
        logger.info(`Signup attempt with existing username: ${userData.username}`);
        throw new ConflictException('Username already taken', 'USERNAME_EXISTS');
      }

      // Check for existing phone number
      const findByPhone: User = await this.users.findOne({ phoneNumber: userData.phoneNumber });
      if (findByPhone) {
        logger.info(`Signup attempt with existing phone number: ${userData.phoneNumber}`);
        throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
      }

      const hashedPassword = await hash(userData.password, BCRYPT_ROUNDS);
      // Explicitly exclude role from user input - all new users start as 'user' (set by model default)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { role: _ignoredRole, ...safeUserData } = userData as any;

      // Fix #3: Retry logic for race conditions
      const maxRetries = RETRY_MAX_ATTEMPTS;
      let createUserData: User | null = null;
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          createUserData = await this.users.create({
            ...safeUserData,
            email: normalizedEmail,
            username: normalizedUsername,
            password: hashedPassword,
          });
          break; // Success - exit retry loop
        } catch (createError) {
          lastError = createError;
          // If it's a duplicate key error and not the last attempt, retry
          if (createError.code === 11000 && attempt < maxRetries) {
            const waitTime = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt - 1); // Exponential backoff
            logger.warn(`Signup: duplicate key error on attempt ${attempt}/${maxRetries}, retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // Re-check for existing records
            const findByEmail = await this.users.findOne({ email: normalizedEmail });
            if (findByEmail) throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
          } else {
            throw createError;
          }
        }
      }

      if (!createUserData) {
        handleMongoDBDuplicateKeyError(lastError);
        throw lastError;
      }

      logger.info(`New user registered: ${createUserData._id}`);
      return createUserData;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle race condition: if unique index catches a duplicate
      handleMongoDBDuplicateKeyError(error);
      logger.error(`Signup error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Registration failed. Please try again');
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

      // Find user by email or username (normalize for case-insensitive lookup)
      const normalizedIdentifier = userData.emailOrUsername.toLowerCase().trim();
      const findUser: User = await this.users.findOne({
        $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
      });

      if (!findUser) {
        logSecurityEvent({
          event: 'LOGIN_FAILED',
          reason: 'User not found',
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          attemptedIdentifier: userData.emailOrUsername,
        });
        throw new UnauthorizedException('Invalid credentials', 'INVALID_CREDENTIALS');
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
        throw new UnauthorizedException('Invalid credentials', 'INVALID_CREDENTIALS');
      }

      const tokenData = this.createToken(findUser);
      const refreshToken = await this.generateRefreshToken(findUser, deviceInfo);

      // Update sessionTrack with online status only
      // Devices are derived from active refresh tokens - single source of truth
      const derivedDevices = this.getDevicesFromSessions(findUser.refreshTokens || []);

      await this.users.findByIdAndUpdate(findUser._id, {
        'sessionTrack.isOnline': true,
        'sessionTrack.lastSeen': new Date(),
        'sessionTrack.devices': derivedDevices,
      });

      // Get updated user and session count
      const updatedUser = await this.users.findById(findUser._id);
      const sessionCount = (updatedUser?.refreshTokens || []).filter(s => new Date(s.expiresAt) > new Date()).length;

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
    const dataStoredInToken: DataStoredInToken = { _id: user._id, role: user.role };
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
}

export default AuthService;
