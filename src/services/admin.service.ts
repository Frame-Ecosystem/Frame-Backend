import { hash } from 'bcrypt';
import { BCRYPT_ROUNDS, RETRY_BACKOFF_BASE_MS, RETRY_MAX_ATTEMPTS } from '../config/constants';
import { CreateUserDto, UpdateUserDto } from '@dtos/users.dto';
import { User } from '@interfaces/users.interface';
import userModel from '@models/users.model';
import { isEmpty, handleMongoDBDuplicateKeyError } from '@utils/util';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';

class AdminService {
  /**
   * Change isBlocked state for a user
   */
  public async changeUserBlockedState(userId: string, isBlocked: boolean): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('AdminService.changeUserBlockedState: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }
      const updatedUser = await this.users.findByIdAndUpdate(userId, { isBlocked }, { new: true });
      if (!updatedUser) {
        logger.info(`AdminService.changeUserBlockedState: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }
      logger.info(`AdminService.changeUserBlockedState: user ${userId} isBlocked set to ${isBlocked}`);
      return updatedUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`AdminService.changeUserBlockedState error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }
  public users = userModel;

  /**
   * Find all users in the system
   */
  public async findAllUsers(): Promise<User[]> {
    try {
      const users: User[] = await this.users.find();
      logger.info('AdminService: retrieved all users');
      return users;
    } catch (error) {
      logger.error(`AdminService.findAllUsers error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Find a specific user by ID
   */
  public async findUserById(userId: string): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('AdminService.findUserById: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }

      const findUser: User = await this.users.findOne({ _id: userId });
      if (!findUser) {
        logger.info(`AdminService.findUserById: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      return findUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`AdminService.findUserById error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Create a new user (admin can set role)
   */
  public async createUser(userData: CreateUserDto): Promise<User> {
    // Prevent creating a second admin
    if (userData.role && userData.role.toLowerCase() === 'admin' && (await this.users.exists({ role: 'admin' }))) {
      logger.warn('AdminService.createUser: attempt to create a second admin');
      throw new ConflictException('An admin user already exists. Only one admin is allowed.', 'ADMIN_EXISTS');
    }
    try {
      if (isEmpty(userData)) {
        logger.warn('AdminService.createUser: empty userData provided');
        throw new BadRequestException('Invalid request data');
      }

      // Normalize email and username to lowercase
      const normalizedEmail = userData.email.toLowerCase().trim();
      const normalizedUsername = userData.username.toLowerCase().trim();
      // Use provided role or default to 'user'
      const userRole = userData.role || 'user';

      // Check for existing email
      const findByEmail: User = await this.users.findOne({ email: normalizedEmail });
      if (findByEmail) {
        logger.info(`AdminService.createUser: email already exists: ${normalizedEmail}`);
        throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
      }

      // Check for existing username
      const findByUsername: User = await this.users.findOne({ username: normalizedUsername });
      if (findByUsername) {
        logger.info(`AdminService.createUser: username already exists: ${normalizedUsername}`);
        throw new ConflictException('Username already taken', 'USERNAME_EXISTS');
      }

      // Check for existing phone number
      const findByPhone: User = await this.users.findOne({ phoneNumber: userData.phoneNumber });
      if (findByPhone) {
        logger.info(`AdminService.createUser: phone number already exists: ${userData.phoneNumber}`);
        throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
      }

      const hashedPassword = await hash(userData.password, BCRYPT_ROUNDS);
      let createUserData: User | null = null;
      let lastError: any = null;

      // Fix #3: Retry logic with exponential backoff for race conditions
      const maxRetries = RETRY_MAX_ATTEMPTS;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          createUserData = await this.users.create({
            ...userData,
            email: normalizedEmail,
            username: normalizedUsername,
            password: hashedPassword,
            role: userRole,
          });
          break; // Success - exit retry loop
        } catch (createError) {
          lastError = createError;
          // If it's a duplicate key error and not the last attempt, retry
          if (createError.code === 11000 && attempt < maxRetries) {
            const waitTime = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt - 1); // Exponential backoff
            logger.warn(`AdminService.createUser: duplicate key error on attempt ${attempt}/${maxRetries}, retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // Re-check for existing records in case another request succeeded
            const findByEmail = await this.users.findOne({ email: normalizedEmail });
            if (findByEmail) {
              logger.info(`AdminService.createUser: user already exists after retry: ${normalizedEmail}`);
              throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
            }
          } else {
            // Not a duplicate error or final attempt - handle it
            throw createError;
          }
        }
      }

      if (!createUserData) {
        // All retries failed
        handleMongoDBDuplicateKeyError(lastError);
        throw lastError;
      }

      logger.info(`AdminService.createUser: new user created: ${createUserData._id}`);
      return createUserData;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle race condition: if unique index catches a duplicate
      handleMongoDBDuplicateKeyError(error);
      logger.error(`AdminService.createUser error: ${error.message}`, { email: userData?.email, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Update a user's profile
   */
  public async updateUser(userId: string, userData: UpdateUserDto): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(userData)) {
        logger.warn('AdminService.updateUser: empty userId or userData provided');
        throw new BadRequestException('Invalid request data');
      }

      if (userData.email) {
        const normalizedEmail = userData.email.toLowerCase().trim();
        const findUser: User = await this.users.findOne({ email: normalizedEmail });
        if (findUser && findUser._id.toString() !== userId) {
          logger.info(`AdminService.updateUser: email conflict for userId ${userId}, email: ${normalizedEmail}`);
          throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
        }
        // Store normalized email
        userData.email = normalizedEmail;
      }

      if (userData.username) {
        const normalizedUsername = userData.username.toLowerCase().trim();
        const findByUsername: User = await this.users.findOne({ username: normalizedUsername });
        if (findByUsername && findByUsername._id.toString() !== userId) {
          logger.info(`AdminService.updateUser: username conflict for userId ${userId}, username: ${normalizedUsername}`);
          throw new ConflictException('Username already taken', 'USERNAME_EXISTS');
        }
        // Store normalized username
        userData.username = normalizedUsername;
      }

      if (userData.phoneNumber) {
        const findByPhone: User = await this.users.findOne({ phoneNumber: userData.phoneNumber });
        if (findByPhone && findByPhone._id.toString() !== userId) {
          logger.info(`AdminService.updateUser: phone conflict for userId ${userId}, phone: ${userData.phoneNumber}`);
          throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
        }
      }

      const updateUserById: User = await this.users.findByIdAndUpdate(userId, userData, { new: true });
      if (!updateUserById) {
        logger.info(`AdminService.updateUser: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`AdminService.updateUser: user updated: ${userId}`);
      return updateUserById;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Fix #3: Handle race condition with retry for duplicate key errors
      if (error.code === 11000) {
        logger.warn(`AdminService.updateUser: duplicate key error after pre-check for userId ${userId}, retrying once...`);
        try {
          const retryUpdate: User = await this.users.findByIdAndUpdate(userId, userData, { new: true });
          if (!retryUpdate) {
            throw new NotFoundException('User not found');
          }
          logger.info(`AdminService.updateUser: user updated on retry: ${userId}`);
          return retryUpdate;
        } catch (retryError) {
          handleMongoDBDuplicateKeyError(retryError);
        }
      } else {
        handleMongoDBDuplicateKeyError(error);
      }
      logger.error(`AdminService.updateUser error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Delete a user by ID
   */
  public async deleteUser(userId: string): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('AdminService.deleteUser: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }

      const deleteUserById: User = await this.users.findByIdAndDelete(userId);
      if (!deleteUserById) {
        logger.info(`AdminService.deleteUser: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`AdminService.deleteUser: user deleted: ${userId}`);
      return deleteUserById;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`AdminService.deleteUser error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  // ============================================
  // SESSION TRACKING
  // ============================================

  /**
   * Get all online users with their devices and lastSeen
   * Returns only users where isOnline === true
   */
  public async getOnlineUsers(): Promise<
    Array<{
      _id: string;
      email: string;
      username: string;
      sessionTrack: {
        isOnline: boolean;
        lastSeen?: Date;
        devices: Array<{
          name: string;
          ipAddress?: string;
        }>;
      };
    }>
  > {
    try {
      const users = await this.users.find({ 'sessionTrack.isOnline': true }).select('email username sessionTrack');

      const onlineUsers = users.map(user => ({
        _id: String(user._id),
        email: user.email,
        username: user.username,
        sessionTrack: {
          isOnline: user.sessionTrack?.isOnline || false,
          lastSeen: user.sessionTrack?.lastSeen,
          devices: (user.sessionTrack?.devices || []).map(device => ({
            name: typeof device === 'string' ? device : device.name,
            ipAddress: typeof device === 'string' ? undefined : device.ipAddress,
          })),
        },
      }));

      logger.info(`GetOnlineUsers: found ${onlineUsers.length} online users`);
      return onlineUsers;
    } catch (error) {
      logger.error(`GetOnlineUsers error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to retrieve online users');
    }
  }
}

export default AdminService;
