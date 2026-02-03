import { UpdateUserDto, LocationDto } from '@dtos/users.dto';
import { User } from '@interfaces/users.interface';
import userModel from '@models/users.model';
import { isEmpty } from '@utils/util';
import { BadRequestException, NotFoundException, InternalServerException, HttpException, ConflictException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';
import { REQUEST_BODY_LIMIT } from '../config/constants';
import AdminService from './admin.service';
import CloudinaryService from './cloudinary.service';

class CurrentUserService {
  /**
   * Send email verification code to the provided email (no auth required)
   * @param email - Email address to send verification code
   */
  public async sendVerificationCode(email: string): Promise<void> {
    if (!email) {
      logger.error('sendVerificationCode: Email is required');
      throw new BadRequestException('Email is required');
    }
    const user = await this.users.findOne({ email });
    if (!user || typeof user !== 'object') {
      logger.error(`sendVerificationCode: User not found for email=${email}`);
      throw new NotFoundException('User not found');
    }
    // Check for disposable email
    const { isDisposableEmail, sendVerificationEmail } = await import('../utils/email');
    if (isDisposableEmail(email)) {
      logger.error(`sendVerificationCode: Disposable email attempted for email=${email}`);
      throw new BadRequestException('Disposable email addresses are not allowed');
    }
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // Set expiration (3 minutes from now)
    const EMAIL_VERIF_CODE_EXPIRY_MS = 3 * 60 * 1000;
    const expiresAt = new Date(Date.now() + EMAIL_VERIF_CODE_EXPIRY_MS);
    // Store code and expiration in emailVerification
    await this.users.findByIdAndUpdate(user._id, {
      $set: {
        'emailVerification.0.verifCode': code,
        'emailVerification.0.verifCodeExpiresAt': expiresAt,
      },
    });
    await sendVerificationEmail(email, code);
  }

  /**
   * Verify email code by email and code (no auth required)
   * @param email - Email address
   * @param code - Verification code
   */
  public async verifyEmailCode(email: string, code: string): Promise<void> {
    if (!email || !code) {
      logger.error('verifyEmailCode: Email and code are required');
      throw new BadRequestException('Email and code are required');
    }
    const user = await this.users.findOne({ email });
    if (!user || typeof user !== 'object') {
      logger.error(`verifyEmailCode: User not found for email=${email}`);
      throw new NotFoundException('User not found');
    }
    const verifObj = Array.isArray(user.emailVerification) ? user.emailVerification[0] : undefined;
    if (!verifObj || !verifObj.verifCode) {
      logger.error(`verifyEmailCode: No verification code sent for email=${email}`);
      throw new BadRequestException('No verification code sent');
    }
    if (!verifObj.verifCodeExpiresAt || new Date() > new Date(verifObj.verifCodeExpiresAt)) {
      // Expired: clear code and expiration
      await this.users.findByIdAndUpdate(user._id, {
        $set: {
          'emailVerification.0.verifCode': null,
          'emailVerification.0.verifCodeExpiresAt': null,
        },
      });
      logger.error(`verifyEmailCode: Verification code expired for email=${email}`);
      throw new BadRequestException('Verification code expired');
    }
    if (verifObj.verifCode !== code) {
      logger.error(`verifyEmailCode: Invalid verification code for email=${email}`);
      throw new BadRequestException('Invalid verification code');
    }
    await this.users.findByIdAndUpdate(user._id, {
      $set: {
        'emailVerification.0.isVerified': true,
        'emailVerification.0.verifCode': null,
        'emailVerification.0.verifCodeExpiresAt': null,
      },
    });
  }
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
        throw new (await import('@exceptions/HttpException')).BadRequestException(
          'New password must be different from current password',
          'SAME_PASSWORD',
        );
      }

      const user = await this.users.findById(userId);
      if (!user || typeof user !== 'object') {
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

      // Check for phone number uniqueness if phoneNumber is being updated
      if (userData.phoneNumber) {
        const findByPhone: User = await this.users.findOne({ phoneNumber: userData.phoneNumber });
        if (findByPhone && findByPhone._id.toString() !== userId) {
          logger.info(`CurrentUserService.updateUser: phone conflict for userId ${userId}, phone: ${userData.phoneNumber}`);
          throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
        }
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

      const user = await this.users.findById(userId);
      if (!user) {
        logger.info(`CurrentUserService.uploadProfileImage: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      // Delete old profile image from Cloudinary if it exists
      if (user.profileImage?.publicId) {
        try {
          await CloudinaryService.deleteProfileImage(user.profileImage.publicId);
        } catch (deleteError) {
          logger.warn(`Failed to delete old profile image: ${deleteError.message}`);
          // Continue with upload even if delete fails
        }
      }

      // Upload new image to Cloudinary
      const { url, publicId } = await CloudinaryService.uploadProfileImage(file.buffer, userId);

      // Update user document with new profile image URL and publicId
      const updatedUser = await this.users.findByIdAndUpdate(
        userId,
        {
          profileImage: {
            url,
            publicId,
          },
        },
        { new: true },
      );

      logger.info(`CurrentUserService.uploadProfileImage: profile image uploaded successfully for user: ${userId}`);
      return updatedUser;
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
      const userDoc = await this.users.findById(userId);
      if (userDoc && (userDoc as any).type === 'admin') {
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

  /**
   * Update lounge-specific profile fields
   */
  public async updateLoungeProfile(userId: string, loungeData: import('@dtos/users.dto').UpdateLoungeProfileDto): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(loungeData)) {
        logger.warn('CurrentUserService.updateLoungeProfile: empty userId or loungeData provided');
        throw new BadRequestException('Invalid request data');
      }

      // Verify user is a lounge
      const user = await this.users.findById(userId);
      if (!user) {
        logger.info(`CurrentUserService.updateLoungeProfile: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      if (user.type !== 'lounge') {
        logger.warn(`CurrentUserService.updateLoungeProfile: user ${userId} is not a lounge (type: ${user.type})`);
        throw new BadRequestException('This endpoint is only for lounge accounts');
      }

      // Update lounge-specific fields
      const updateData: Partial<User> = {};

      if (loungeData.loungeTitle !== undefined) {
        updateData.loungeTitle = loungeData.loungeTitle;
      }

      if (loungeData.openingHours !== undefined) {
        updateData.openingHours = loungeData.openingHours;
      }

      const updatedUser = await this.users.findByIdAndUpdate(userId, updateData, { new: true });
      if (!updatedUser) {
        logger.info(`CurrentUserService.updateLoungeProfile: user not found after update: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`CurrentUserService.updateLoungeProfile: lounge profile updated for user: ${userId}`);
      return updatedUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`CurrentUserService.updateLoungeProfile error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }

  /**
   * Update client-specific profile fields
   */
  public async updateClientProfile(userId: string, clientData: import('@dtos/users.dto').UpdateClientProfileDto): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(clientData)) {
        logger.warn('CurrentUserService.updateClientProfile: empty userId or clientData provided');
        throw new BadRequestException('Invalid request data');
      }

      // Verify user is a client
      const user = await this.users.findById(userId);
      if (!user) {
        logger.info(`CurrentUserService.updateClientProfile: user not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      if (user.type !== 'client') {
        logger.warn(`CurrentUserService.updateClientProfile: user ${userId} is not a client (type: ${user.type})`);
        throw new BadRequestException('This endpoint is only for client accounts');
      }

      // Update client-specific fields
      const updateData: Partial<User> = {};

      if (clientData.firstName !== undefined) {
        updateData.firstName = clientData.firstName;
      }
      if (clientData.lastName !== undefined) {
        updateData.lastName = clientData.lastName;
      }

      const updatedUser = await this.users.findByIdAndUpdate(userId, updateData, { new: true });
      if (!updatedUser) {
        logger.info(`CurrentUserService.updateClientProfile: user not found after update: ${userId}`);
        throw new NotFoundException('User not found');
      }

      logger.info(`CurrentUserService.updateClientProfile: client profile updated for user: ${userId}`);
      return updatedUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`CurrentUserService.updateClientProfile error: ${error.message}`, { userId, stack: error.stack });
      throw new InternalServerException('Operation failed. Please try again');
    }
  }
}

export default CurrentUserService;
