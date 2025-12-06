import { hash, compare } from 'bcrypt';
import { sign, verify, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { SECRET_KEY, REFRESH_TOKEN_SECRET, NODE_ENV } from '@config';
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
import { isEmpty } from '@utils/util';
import { v4 as uuidv4 } from 'uuid';
import { logSecurityEvent, logger } from '@utils/logger';

// Constants for token expiration
const ACCESS_TOKEN_EXPIRES_IN = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const MAX_SESSIONS_PER_USER = 5; // Limit active sessions per user

class AuthService {
  public users = userModel;

  public async signup(userData: CreateUserDto): Promise<User> {
    try {
      if (isEmpty(userData)) {
        logger.warn('Signup attempt with empty data');
        throw new BadRequestException('Invalid request data');
      }

      const findUser: User = await this.users.findOne({ email: userData.email });
      if (findUser) {
        logger.info(`Signup attempt with existing email: ${userData.email}`);
        throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
      }

      const hashedPassword = await hash(userData.password, 10);
      const createUserData: User = await this.users.create({ ...userData, password: hashedPassword });

      logger.info(`New user registered: ${createUserData._id}`);
      return createUserData;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`Signup error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Registration failed. Please try again');
    }
  }

  public async login(
    userData: LoginUserDto,
    deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string },
  ): Promise<{ cookie: string; findUser: User; tokenData: TokenData; refreshToken: string }> {
    try {
      if (isEmpty(userData)) {
        logger.warn('Login attempt with empty data');
        throw new BadRequestException('Invalid request data');
      }

      // Find user by email or username
      const findUser: User = await this.users.findOne({
        $or: [{ email: userData.emailOrUsername }, { username: userData.emailOrUsername }],
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
      const cookie = this.createCookie(tokenData);
      const refreshToken = await this.generateRefreshToken(findUser, deviceInfo);

      logSecurityEvent({
        event: 'LOGIN_SUCCESS',
        userId: String(findUser._id),
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
      });

      return { cookie, findUser, tokenData, refreshToken };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`Login error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Login failed. Please try again');
    }
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

      if (jti) {
        // Logout from specific device/session
        await this.users.findByIdAndUpdate(findUser._id, {
          $pull: { refreshTokens: { jti } },
        });
        logSecurityEvent({
          event: 'LOGOUT',
          userId: String(findUser._id),
          jti,
        });
      } else {
        // Logout from all devices
        await this.users.findByIdAndUpdate(findUser._id, {
          refreshTokens: [],
        });
        logSecurityEvent({
          event: 'ALL_SESSIONS_REVOKED',
          userId: String(findUser._id),
          reason: 'Logout without jti',
        });
      }

      return findUser;
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
      await this.users.findByIdAndUpdate(userId, { refreshTokens: [] });
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

  public async getActiveSessions(userId: string): Promise<RefreshTokenSession[]> {
    try {
      const user = await this.users.findById(userId);
      if (!user) {
        logger.warn(`GetActiveSessions: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      // Return sessions without the tokenHash for security
      return (user.refreshTokens || [])
        .filter(session => new Date(session.expiresAt) > new Date())
        .map(session => ({
          jti: session.jti,
          tokenHash: '[HIDDEN]',
          userAgent: session.userAgent,
          ip: session.ip,
          deviceName: session.deviceName,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        }));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`GetActiveSessions error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Failed to retrieve sessions');
    }
  }

  public async revokeSession(userId: string, jti: string): Promise<void> {
    try {
      if (!userId || !jti) {
        throw new BadRequestException('Invalid request data');
      }
      await this.users.findByIdAndUpdate(userId, {
        $pull: { refreshTokens: { jti } },
      });
      logSecurityEvent({
        event: 'SESSION_REVOKED',
        userId,
        jti,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`RevokeSession error: ${error.message}`, { userId, jti, stack: error.stack });
      throw new InternalServerException('Failed to revoke session');
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

    return { expiresIn: ACCESS_TOKEN_EXPIRES_IN, token: sign(dataStoredInToken, secretKey, { expiresIn: ACCESS_TOKEN_EXPIRES_IN }) };
  }

  public createCookie(tokenData: TokenData): string {
    const isProduction = NODE_ENV === 'production';
    const secureFlag = isProduction ? ' Secure;' : '';
    return `accessToken=${tokenData.token}; HttpOnly;${secureFlag} SameSite=Strict; Max-Age=${tokenData.expiresIn};`;
  }

  public async generateRefreshToken(user: User, deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string }): Promise<string> {
    // Generate unique token ID for rotation/reuse detection
    const jti = uuidv4();
    const refreshToken = sign({ _id: user._id, jti }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
    // Hash refresh token before storing for security
    const hashedRefreshToken = await hash(refreshToken, 10);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000);

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
        await this.users.findByIdAndUpdate(user._id, { refreshTokens: [] });
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
