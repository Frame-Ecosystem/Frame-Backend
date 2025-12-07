import { UpdateUserDto, LocationDto } from '@dtos/users.dto';
import { User } from '@interfaces/users.interface';
import userModel from '@models/users.model';
import { isEmpty } from '@utils/util';
import { BadRequestException, NotFoundException, InternalServerException, HttpException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';
import AdminService from './admin.service';

class CurrentUserService {
  public users = userModel;
  private adminService = new AdminService();

  /**
   * Update current user's profile
   */
  public async updateUser(userId: string, userData: UpdateUserDto): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(userData)) {
        logger.warn('CurrentUserService.updateUser: empty userId or userData provided');
        throw new BadRequestException('Invalid request data');
      }
      const user = await this.users.findByIdAndUpdate(userId, userData, { new: true });
      if (!user) {
        logger.info(`CurrentUserService.updateUser: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }
      logger.info(`CurrentUserService.updateUser: profile updated for user: ${userId}`);
      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`CurrentUserService.updateUser error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Update current user's location
   */
  public async updateUserLocation(userId: string, locationData: LocationDto): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(locationData)) {
        logger.warn('CurrentUserService.updateUserLocation: empty userId or locationData provided');
        throw new BadRequestException('Invalid request data');
      }
      const user = await this.users.findByIdAndUpdate(userId, { location: locationData }, { new: true });
      if (!user) {
        logger.info(`CurrentUserService.updateUserLocation: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }
      logger.info(`CurrentUserService.updateUserLocation: location updated for user: ${userId}`);
      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`CurrentUserService.updateUserLocation error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Upload current user's profile image
   */
  public async uploadProfileImage(userId: string, file: Express.Multer.File): Promise<User> {
    try {
      if (isEmpty(userId) || !file) {
        logger.warn('CurrentUserService.uploadProfileImage: empty userId or file provided');
        throw new BadRequestException('Invalid request data');
      }
      const user = await this.users.findByIdAndUpdate(userId, { profileImage: file.filename }, { new: true });
      if (!user) {
        logger.info(`CurrentUserService.uploadProfileImage: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }
      logger.info(`CurrentUserService.uploadProfileImage: profile image updated for user: ${userId}`);
      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`CurrentUserService.uploadProfileImage error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Delete current user's own account
   * Verifies password before delegating to AdminService for actual deletion
   */
  public async deleteMe(userId: string, password: string): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(password)) {
        logger.warn('CurrentUserService.deleteMe: empty userId or password provided');
        throw new BadRequestException('Invalid request data');
      }

      const user = await this.users.findById(userId);
      if (!user) {
        logger.info(`CurrentUserService.deleteMe: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      // Verify password before deletion
      const { compare } = await import('bcrypt');
      const isPasswordValid = await compare(password, user.password);
      if (!isPasswordValid) {
        logger.warn(`CurrentUserService.deleteMe: invalid password for user: ${userId}`);
        throw new BadRequestException('Invalid password', 'INVALID_PASSWORD');
      }

      // Prevent admin from deleting themselves via this endpoint
      if (user.role === 'admin') {
        logger.warn(`CurrentUserService.deleteMe: admin attempted self-deletion: ${userId}`);
        throw new BadRequestException('Admin accounts cannot be deleted via this endpoint', 'ADMIN_SELF_DELETE');
      }

      // Delegate deletion to AdminService
      logger.info(`CurrentUserService.deleteMe: delegating deletion to AdminService for user: ${userId}`);
      return this.adminService.deleteUser(userId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`CurrentUserService.deleteMe error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }
}

export default CurrentUserService;
