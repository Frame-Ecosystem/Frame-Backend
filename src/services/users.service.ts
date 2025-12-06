import { hash } from 'bcrypt';
import { CreateUserDto, LocationDto } from '@dtos/users.dto';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { User, Location } from '@interfaces/users.interface';
import userModel from '@models/users.model';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';

class UserService {
  public users = userModel;

  public async findAllUser(): Promise<User[]> {
    try {
      const users: User[] = await this.users.find();
      return users;
    } catch (error) {
      logger.error(`FindAllUser error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  public async findUserById(userId: string): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('FindUserById: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }

      const findUser: User = await this.users.findOne({ _id: userId });
      if (!findUser) {
        logger.info(`FindUserById: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      return findUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`FindUserById error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  public async createUser(userData: CreateUserDto): Promise<User> {
    try {
      if (isEmpty(userData)) {
        logger.warn('CreateUser: empty userData provided');
        throw new BadRequestException('Invalid request data');
      }

      const findUser: User = await this.users.findOne({ email: userData.email });
      if (findUser) {
        logger.info(`CreateUser: email already exists: ${userData.email}`);
        throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
      }

      const hashedPassword = await hash(userData.password, 10);
      const createUserData: User = await this.users.create({ ...userData, password: hashedPassword });

      logger.info(`CreateUser: new user created: ${createUserData._id}`);
      return createUserData;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`CreateUser error: ${error.message}`, { email: userData?.email, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  public async updateUser(userId: string, userData: CreateUserDto): Promise<User> {
    try {
      if (isEmpty(userData)) {
        logger.warn('UpdateUser: empty userData provided');
        throw new BadRequestException('Invalid request data');
      }

      if (userData.email) {
        const findUser: User = await this.users.findOne({ email: userData.email });
        if (findUser && findUser._id != userId) {
          logger.info(`UpdateUser: email conflict for userId ${userId}, email: ${userData.email}`);
          throw new ConflictException('Email already registered', 'EMAIL_EXISTS');
        }
      }

      if (userData.password) {
        const hashedPassword = await hash(userData.password, 10);
        userData = { ...userData, password: hashedPassword };
      }

      const updateUserById: User = await this.users.findByIdAndUpdate(userId, { userData }, { new: true });
      if (!updateUserById) {
        logger.info(`UpdateUser: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`UpdateUser: user updated: ${userId}`);
      return updateUserById;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`UpdateUser error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  public async deleteUser(userId: string): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('DeleteUser: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }

      const deleteUserById: User = await this.users.findByIdAndDelete(userId);
      if (!deleteUserById) {
        logger.info(`DeleteUser: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`DeleteUser: user deleted: ${userId}`);
      return deleteUserById;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`DeleteUser error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  public async updateProfileImage(userId: string, imageUrl: string): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('UpdateProfileImage: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }
      if (isEmpty(imageUrl)) {
        logger.warn('UpdateProfileImage: empty imageUrl provided');
        throw new BadRequestException('Invalid request data');
      }

      const updatedUser: User = await this.users.findByIdAndUpdate(userId, { profileImage: imageUrl }, { new: true });

      if (!updatedUser) {
        logger.info(`UpdateProfileImage: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`UpdateProfileImage: profile image updated for user: ${userId}`);
      return updatedUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`UpdateProfileImage error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  public async updateUserLocation(userId: string, locationData: LocationDto): Promise<User> {
    try {
      if (isEmpty(userId)) {
        logger.warn('UpdateUserLocation: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }
      if (isEmpty(locationData)) {
        logger.warn('UpdateUserLocation: empty locationData provided');
        throw new BadRequestException('Invalid request data');
      }

      const updatedUser: User = await this.users.findByIdAndUpdate(userId, { location: locationData }, { new: true });

      if (!updatedUser) {
        logger.info(`UpdateUserLocation: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`UpdateUserLocation: location updated for user: ${userId}`);
      return updatedUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`UpdateUserLocation error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  public async getUserProfileImage(userId: string): Promise<{ profileImage: string | null }> {
    try {
      if (isEmpty(userId)) {
        logger.warn('GetUserProfileImage: empty userId provided');
        throw new BadRequestException('Invalid request data');
      }

      const user: User = await this.users.findOne({ _id: userId }, { profileImage: 1 });
      if (!user) {
        logger.info(`GetUserProfileImage: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      return { profileImage: user.profileImage || null };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`GetUserProfileImage error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }
}

export default UserService;
