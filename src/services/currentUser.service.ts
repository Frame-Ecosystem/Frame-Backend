import { UpdateUserDto, LocationDto } from '@dtos/users.dto';
import { User } from '@interfaces/users.interface';
import userModel from '@models/users.model';
import { isEmpty } from '@utils/util';
import { BadRequestException, NotFoundException, InternalServerException, HttpException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';
import AdminService from './admin.service';

class CurrentUserService {
    /**
     * Change current user's password
     */
    public async changePassword(userId: string, passwordData: import('@dtos/users.dto').ChangePasswordDto): Promise<void> {
      try {
        // Validate that new passwords match
        if (passwordData.newPassword !== passwordData.newPasswordConfirm) {
          throw new (await import('@exceptions/HttpException')).BadRequestException('New passwords do not match', 'PASSWORD_MISMATCH');
        }

        // Prevent using same password
        if (passwordData.currentPassword === passwordData.newPassword) {
          throw new (await import('@exceptions/HttpException')).BadRequestException('New password must be different from current password', 'SAME_PASSWORD');
        }

        const user = await this.users.findById(userId);
        if (!user) {
          throw new (await import('@exceptions/HttpException')).NotFoundException('User not found');
        }

        // Verify current password
        const { compare, hash } = await import('bcrypt');
        const isPasswordValid = await compare(passwordData.currentPassword, user.password);
        if (!isPasswordValid) {
          (await import('@utils/logger')).logSecurityEvent({
            event: 'LOGIN_FAILED',
            reason: 'Invalid current password during password change',
            userId: String(user._id),
          });
          throw new (await import('@exceptions/HttpException')).UnauthorizedException('Current password is incorrect', 'INVALID_PASSWORD');
        }

        // Hash new password and update
        const hashedPassword = await hash(passwordData.newPassword, (await import('../config/constants')).BCRYPT_ROUNDS);
        await this.users.findByIdAndUpdate(userId, { password: hashedPassword });

        // Revoke all refresh tokens (force re-login on all devices for security)
        await this.users.findByIdAndUpdate(userId, {
          refreshTokens: [],
          'sessionTrack.isOnline': false,
          'sessionTrack.devices': [],
        });

        (await import('@utils/logger')).logSecurityEvent({
          event: 'SESSION_REVOKED',
          userId: String(user._id),
          reason: 'Password changed - all sessions revoked',
        });

        (await import('@utils/logger')).logger.info(`Password changed for user: ${userId}`);
      } catch (error) {
        if (error instanceof (await import('@exceptions/HttpException')).HttpException) throw error;
        (await import('@utils/logger')).logger.error(`ChangePassword error: ${error.message}`, { userId, stack: error.stack });
        throw new (await import('@exceptions/HttpException')).InternalServerException('Failed to change password. Please try again');
      }
    }
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
