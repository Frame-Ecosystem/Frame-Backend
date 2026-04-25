import { hash, compare } from 'bcrypt';
import { BCRYPT_ROUNDS, MAX_FAILED_LOGIN_ATTEMPTS, ACCOUNT_LOCKOUT_DURATION_MS } from '@config/constants';
import { CreateUserDto } from '@systems/UserManager/dtos/user.dto';
import { LoginUserDto } from '@systems/AuthSystem/dtos/auth.dto';
import {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  InternalServerException,
  ForbiddenException,
} from '@exceptions/HttpException';
import { TokenData } from '@systems/AuthSystem/interfaces/auth.interface';
import { User } from '@systems/UserManager/interfaces/user.interface';
import userModel from '@systems/UserManager/models/user.model';
import verificationTokenModel from '@systems/AuthSystem/models/verificationToken.model';
import { isEmpty, handleMongoDBDuplicateKeyError } from '@utils/util';
import { v4 as uuidv4 } from 'uuid';
import { logSecurityEvent, logger } from '@utils/logger';
import { sendMagicLinkEmail, isDisposableEmail } from '@utils/email';
import AuthTokenService from '@systems/AuthSystem/services/authToken.service';
import AuthSessionService from '@systems/AuthSystem/services/authSession.service';
import { MAGIC_LINK_BASE_URL } from '@config';

class AuthService {
  private users = userModel;
  private tokenService = new AuthTokenService();
  private sessionService = new AuthSessionService();

  /** Dummy hash used for constant-time comparison when user not found (timing attack prevention) */
  private static readonly DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWX12345';

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

      // Reject disposable/temporary email providers
      if (isDisposableEmail(normalizedEmail)) {
        logger.warn(`Signup attempt with disposable email: ${normalizedEmail}`);
        throw new BadRequestException('Disposable email addresses are not allowed', 'DISPOSABLE_EMAIL');
      }

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

      // Remove any existing verification tokens for this email
      await verificationTokenModel.deleteMany({ email: normalizedEmail, tokenType: { $ne: 'password_reset' } });

      await verificationTokenModel.create(tokenData);

      // Generate magic link (uses LAN IP in dev so phones on same Wi-Fi can reach it)
      const magicLink = `${MAGIC_LINK_BASE_URL}/auth/verify?token=${verificationToken}`;

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
      const tokenData = this.tokenService.createToken(createUserData);
      const refreshToken = await this.tokenService.generateRefreshToken(createUserData, deviceInfo);

      // Update sessionTrack with online status
      await this.sessionService.updateSessionTrack(
        String(createUserData._id),
        Array.isArray(createUserData.refreshTokens) ? createUserData.refreshTokens : [],
      );

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
    return this.tokenService.forgotPassword(email);
  }

  public async resetPassword(token: string, newPassword: string): Promise<void> {
    return this.tokenService.resetPassword(token, newPassword);
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
        findUser = await this.users.findOne({ phoneNumber: identifier });
      }

      if (!findUser) {
        // Perform dummy bcrypt compare to prevent timing-based user enumeration
        await compare(userData.password, AuthService.DUMMY_HASH);
        logSecurityEvent({
          event: 'LOGIN_FAILED',
          reason: 'User not found',
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          attemptedIdentifier: identifier,
          identifierType: isEmail ? 'email' : 'phone',
        });
        throw new UnauthorizedException('Invalid credentials', 'INVALID_CREDENTIALS');
      }

      // Check if account is blocked
      if (findUser.isBlocked) {
        logSecurityEvent({
          event: 'LOGIN_FAILED',
          reason: 'Blocked account login attempt',
          userId: String(findUser._id),
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        });
        throw new ForbiddenException('Account suspended. Please contact support.', 'ACCOUNT_BLOCKED');
      }

      // Check if account is locked due to too many failed attempts
      if (findUser.lockUntil && new Date(findUser.lockUntil) > new Date()) {
        const remainingMs = new Date(findUser.lockUntil).getTime() - Date.now();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        logSecurityEvent({
          event: 'LOGIN_FAILED',
          reason: 'Account locked',
          userId: String(findUser._id),
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          lockUntil: findUser.lockUntil.toISOString(),
        });
        throw new UnauthorizedException(
          `Account temporarily locked. Try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
          'ACCOUNT_LOCKED',
        );
      }

      const isPasswordMatching: boolean = await compare(userData.password, findUser.password);
      if (!isPasswordMatching) {
        // Increment failed login attempts
        const failedAttempts = (findUser.failedLoginAttempts || 0) + 1;
        const updateData: Record<string, unknown> = { failedLoginAttempts: failedAttempts };

        if (failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
          updateData.lockUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS);
          logSecurityEvent({
            event: 'LOGIN_FAILED',
            reason: `Account locked after ${failedAttempts} failed attempts`,
            userId: String(findUser._id),
            ip: deviceInfo?.ip,
            userAgent: deviceInfo?.userAgent,
          });
        } else {
          logSecurityEvent({
            event: 'LOGIN_FAILED',
            reason: 'Invalid password',
            userId: String(findUser._id),
            ip: deviceInfo?.ip,
            userAgent: deviceInfo?.userAgent,
            failedAttempts,
          });
        }

        await this.users.findByIdAndUpdate(findUser._id, updateData);
        throw new UnauthorizedException('Invalid credentials', 'INVALID_CREDENTIALS');
      }

      // Successful login — reset lockout counters
      if (findUser.failedLoginAttempts > 0 || findUser.lockUntil) {
        await this.users.findByIdAndUpdate(findUser._id, {
          failedLoginAttempts: 0,
          lockUntil: null,
        });
      }

      const tokenData = this.tokenService.createToken(findUser);
      const refreshToken = await this.tokenService.generateRefreshToken(findUser, deviceInfo);

      // Update sessionTrack — devices derived from active refresh tokens (single source of truth)
      await this.sessionService.updateSessionTrack(String(findUser._id), Array.isArray(findUser.refreshTokens) ? findUser.refreshTokens : []);

      // Get updated user and session count
      const updatedUser = await this.users.findById(findUser._id);

      const sessionCount = (Array.isArray(updatedUser?.refreshTokens) ? updatedUser.refreshTokens : []).filter(
        s => s && s.expiresAt && new Date(s.expiresAt) > new Date(),
      ).length;

      logSecurityEvent({
        event: 'LOGIN_SUCCESS',
        userId: String(findUser._id),
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
        deviceName: deviceInfo?.deviceName || this.sessionService.parseDeviceName(deviceInfo?.userAgent),
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

  // --- Delegated to AuthTokenService -----------------------------

  public createToken(user: User): TokenData {
    return this.tokenService.createToken(user);
  }

  public async getUserByToken(token: string): Promise<User> {
    return this.tokenService.getUserByToken(token);
  }

  public async generateRefreshToken(user: User, deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string }): Promise<string> {
    return this.tokenService.generateRefreshToken(user, deviceInfo);
  }

  public async refreshAccessToken(
    refreshToken: string,
    deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string },
  ): Promise<{ tokenData: TokenData; newRefreshToken: string }> {
    return this.tokenService.refreshAccessToken(refreshToken, deviceInfo);
  }

  // --- Delegated to AuthSessionService --------------------------

  public async logout(userData: User, jti?: string): Promise<User> {
    return this.sessionService.logout(userData, jti);
  }

  public async logoutAllDevices(userId: string): Promise<void> {
    return this.sessionService.logoutAllDevices(userId);
  }

  public async generateTokensForOAuthUser(
    user: User,
    deviceInfo?: { userAgent?: string; ip?: string; deviceName?: string },
  ): Promise<{ tokenData: TokenData; refreshToken: string }> {
    return this.sessionService.generateTokensForOAuthUser(user, deviceInfo);
  }
}

export default AuthService;
