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
      if (!updatedUser || typeof updatedUser !== 'object') {
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
   * Find users with pagination and search/filter
   */
  public async findUsersPaginated(filter: any, page = 1, limit = 20): Promise<{ users: User[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const [users, total] = await Promise.all([this.users.find(filter).skip(skip).limit(limit), this.users.countDocuments(filter)]);
      logger.info(`AdminService: retrieved users page=${page} limit=${limit} filter=${JSON.stringify(filter)}`);
      return { users, total };
    } catch (error) {
      logger.error(`AdminService.findUsersPaginated error: ${error.message}`, { stack: error.stack });
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
        logger.error(`AdminService.findUserById: user not found: ${userId}`);
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
   * Create a new user (admin can set type: client, lounge, or regular user)
   */
  public async createUser(userData: CreateUserDto): Promise<User> {
    // Note: Admins cannot be created through this endpoint
    // Use the ensureAdminExists utility for admin creation
    try {
      if (isEmpty(userData)) {
        logger.error('AdminService.createUser: empty userData provided');
        throw new BadRequestException('Invalid request data');
      }

      // Normalize email to lowercase
      const normalizedEmail = userData.email.toLowerCase().trim();

      // Check for existing email
      const findByEmail: User = await this.users.findOne({ email: normalizedEmail });
      if (findByEmail) {
        logger.error(`AdminService.createUser: email already exists: ${normalizedEmail}`);
        throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
      }

      // Check for existing phone number (only if provided)
      if (userData.phoneNumber) {
        const findByPhone: User = await this.users.findOne({ phoneNumber: userData.phoneNumber });
        if (findByPhone) {
          logger.error(`AdminService.createUser: phone number already exists: ${userData.phoneNumber}`);
          throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
        }
      }

      const hashedPassword = await hash(userData.password, BCRYPT_ROUNDS);
      let createUserData: User | null = null;
      let lastError: any = null;

      // Fix #3: Retry logic with exponential backoff for race conditions
      const maxRetries = RETRY_MAX_ATTEMPTS;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Use appropriate discriminator model based on type
          const baseData = {
            ...userData,
            email: normalizedEmail,
            password: hashedPassword,
          };

          // Create user with type
          createUserData = await userModel.create(baseData);
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
      const users = await this.users.find({ 'sessionTrack.isOnline': true }).select('email sessionTrack');

      const onlineUsers = users.map(user => ({
        _id: String(user._id),
        email: user.email,
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
