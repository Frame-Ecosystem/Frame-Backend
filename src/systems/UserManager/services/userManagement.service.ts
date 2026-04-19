import { hash } from 'bcrypt';
import { BCRYPT_ROUNDS, RETRY_BACKOFF_BASE_MS, RETRY_MAX_ATTEMPTS } from '@config/constants';
import { CreateUserDto, UpdateUserDto } from '@systems/UserManager/dtos/user.dto';
import { User } from '@systems/UserManager/interfaces/user.interface';
import userModel from '@systems/UserManager/models/user.model';
import { isEmpty, handleMongoDBDuplicateKeyError } from '@utils/util';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';

class UserManagementService {
  private users = userModel;

  /**
   * Change isBlocked state for a user
   */
  public async changeUserBlockedState(userId: string, isBlocked: boolean): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('UserManagementService.changeUserBlockedState: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }
      const updatedUser = await this.users.findByIdAndUpdate(userId, { isBlocked }, { new: true });
      if (!updatedUser || typeof updatedUser !== 'object') {
        logger.info(`UserManagementService.changeUserBlockedState: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }
      logger.info(`UserManagementService.changeUserBlockedState: user ${userId} isBlocked set to ${isBlocked}`);
      return updatedUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`UserManagementService.changeUserBlockedState error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Find users with pagination and optional search string.
   * Builds a MongoDB filter from the search term if provided.
   */
  public async findUsersPaginated(search: string, page = 1, limit = 20): Promise<{ users: User[]; total: number }> {
    try {
      const filter: any = {};
      if (search) {
        filter.$or = [
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
        ];
      }
      const skip = (page - 1) * limit;
      const [users, total] = await Promise.all([
        this.users
          .find(filter)
          .select('-password -refreshTokens -emailVerification -oauth -fcmTokens -sessionTrack')
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.users.countDocuments(filter).exec(),
      ]);
      logger.info(`UserManagementService: retrieved users page=${page} limit=${limit} search=${search || '(none)'}`);
      return { users, total };
    } catch (error) {
      logger.error(`UserManagementService.findUsersPaginated error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Find a specific user by ID
   */
  public async findUserById(userId: string): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('UserManagementService.findUserById: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }

      const findUser: User = await this.users.findOne({ _id: userId });
      if (!findUser) {
        logger.error(`UserManagementService.findUserById: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      return findUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`UserManagementService.findUserById error: ${error.message}`, { userId, stack: error.stack });
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
        logger.error('UserManagementService.createUser: empty userData provided');
        throw new BadRequestException('Invalid request data');
      }

      // Normalize email to lowercase
      const normalizedEmail = userData.email.toLowerCase().trim();

      // Check for existing email
      const findByEmail: User = await this.users.findOne({ email: normalizedEmail });
      if (findByEmail) {
        logger.error(`UserManagementService.createUser: email already exists: ${normalizedEmail}`);
        throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
      }

      // Check for existing phone number (only if provided)
      if (userData.phoneNumber) {
        const findByPhone: User = await this.users.findOne({ phoneNumber: userData.phoneNumber });
        if (findByPhone) {
          logger.error(`UserManagementService.createUser: phone number already exists: ${userData.phoneNumber}`);
          throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
        }
      }

      const hashedPassword = await hash(userData.password, BCRYPT_ROUNDS);
      let createUserData: User | null = null;
      let lastError: any = null;

      // Retry logic with exponential backoff for race conditions
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
            logger.warn(`UserManagementService.createUser: duplicate key error on attempt ${attempt}/${maxRetries}, retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // Re-check for existing records in case another request succeeded
            const findByEmail = await this.users.findOne({ email: normalizedEmail });
            if (findByEmail) {
              logger.info(`UserManagementService.createUser: user already exists after retry: ${normalizedEmail}`);
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

      logger.info(`UserManagementService.createUser: new user created: ${(createUserData as any)._id}`);
      return createUserData;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle race condition: if unique index catches a duplicate
      handleMongoDBDuplicateKeyError(error);
      logger.error(`UserManagementService.createUser error: ${error.message}`, { email: userData?.email, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Update a user's profile
   */
  public async updateUser(userId: string, userData: UpdateUserDto): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(userData)) {
        logger.warn('UserManagementService.updateUser: empty userId or userData provided');
        throw new BadRequestException('Invalid request data');
      }

      if (userData.email) {
        const normalizedEmail = userData.email.toLowerCase().trim();
        const findUser = await this.users.findOne({ email: normalizedEmail });
        if (findUser && findUser._id.toString() !== userId) {
          logger.info(`UserManagementService.updateUser: email conflict for userId ${userId}, email: ${normalizedEmail}`);
          throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
        }
        // Store normalized email
        userData.email = normalizedEmail;
      }

      if (userData.phoneNumber) {
        const findByPhone = await this.users.findOne({ phoneNumber: userData.phoneNumber });
        if (findByPhone && findByPhone._id.toString() !== userId) {
          logger.info(`UserManagementService.updateUser: phone conflict for userId ${userId}, phone: ${userData.phoneNumber}`);
          throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
        }
      }

      const updateUserById = await this.users.findByIdAndUpdate(userId, userData, { new: true });
      if (!updateUserById) {
        logger.info(`UserManagementService.updateUser: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`UserManagementService.updateUser: user updated: ${userId}`);
      return updateUserById;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Handle race condition with retry for duplicate key errors
      if (error.code === 11000) {
        logger.warn(`UserManagementService.updateUser: duplicate key error after pre-check for userId ${userId}, retrying once...`);
        try {
          const retryUpdate: User = await this.users.findByIdAndUpdate(userId, userData, { new: true });
          if (!retryUpdate) {
            throw new NotFoundException('User not found');
          }
          logger.info(`UserManagementService.updateUser: user updated on retry: ${userId}`);
          return retryUpdate;
        } catch (retryError) {
          handleMongoDBDuplicateKeyError(retryError);
        }
      } else {
        handleMongoDBDuplicateKeyError(error);
      }
      logger.error(`UserManagementService.updateUser error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Delete a user by ID
   */
  public async deleteUser(userId: string): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('UserManagementService.deleteUser: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }

      const deleteUserById: User = await this.users.findByIdAndDelete(userId);
      if (!deleteUserById) {
        logger.info(`UserManagementService.deleteUser: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`UserManagementService.deleteUser: user deleted: ${userId}`);
      return deleteUserById;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`UserManagementService.deleteUser error: ${error.message}`, { userId, stack: error.stack });
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
      const users = await this.users.find({ 'sessionTrack.isOnline': true }).select('email sessionTrack').lean().exec();

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

  /**
   * Get all lounge names and IDs for admin use
   */
  public async getAllLoungeNames(): Promise<{ _id: string; loungeTitle: string }[]> {
    try {
      const lounges = await this.users.find({ type: 'lounge' }, '_id loungeTitle').sort({ loungeTitle: 1 }).lean().exec();
      logger.info(`UserManagementService.getAllLoungeNames: found ${lounges.length} lounges`);
      return lounges.map(lounge => ({
        _id: lounge._id.toString(),
        loungeTitle: lounge.loungeTitle,
      }));
    } catch (error) {
      logger.error(`UserManagementService.getAllLoungeNames error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Failed to retrieve lounge names');
    }
  }
}

export default UserManagementService;
