import { UpdateUserDto, LocationDto, ChangePasswordDto, UpdateClientProfileDto } from '@dtos/user/user.dto';
import { User } from '@interfaces/user/user.interface';
import userModel from '@models/user/user.model';
import { isEmpty } from '@utils/util';
import {
  BadRequestException,
  NotFoundException,
  InternalServerException,
  HttpException,
  ConflictException,
  UnauthorizedException,
} from '@exceptions/HttpException';
import { logger, logSecurityEvent } from '@utils/logger';
import { compare, hash } from 'bcrypt';
import { BCRYPT_ROUNDS } from '@config/constants';
import { isDisposableEmail, sendVerificationEmail } from '@utils/email';
import UserManagementService from '@services/admin/userManagement.service';
import R2Service from '@services/shared/cloudflareR2.service';

const EMAIL_VERIF_CODE_EXPIRY_MS = 3 * 60 * 1000;

class CurrentUserService {
  public users = userModel;
  private adminService = new UserManagementService();

  // ─── Email Verification ──────────────────────────────────────────────

  /**
   * Send email verification code to the provided email (no auth required)
   */
  public async sendVerificationCode(email: string): Promise<void> {
    if (!email) throw new BadRequestException('Email is required');

    const user = await this.findUserByEmailOrFail(email);

    if (isDisposableEmail(email)) {
      throw new BadRequestException('Disposable email addresses are not allowed');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + EMAIL_VERIF_CODE_EXPIRY_MS);

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
   */
  public async verifyEmailCode(email: string, code: string): Promise<void> {
    if (!email || !code) throw new BadRequestException('Email and code are required');

    const user = await this.findUserByEmailOrFail(email);
    const verifObj = Array.isArray(user.emailVerification) ? user.emailVerification[0] : undefined;

    if (!verifObj?.verifCode) {
      throw new BadRequestException('No verification code sent');
    }

    if (!verifObj.verifCodeExpiresAt || new Date() > new Date(verifObj.verifCodeExpiresAt)) {
      await this.clearVerificationCode(user._id);
      throw new BadRequestException('Verification code expired');
    }

    if (verifObj.verifCode !== code) {
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

  // ─── Password ────────────────────────────────────────────────────────

  /**
   * Change current user's password
   */
  public async changePassword(userId: string, passwordData: ChangePasswordDto): Promise<void> {
    try {
      if (passwordData.newPassword !== passwordData.newPasswordConfirm) {
        throw new BadRequestException('New passwords do not match', 'PASSWORD_MISMATCH');
      }
      if (passwordData.currentPassword === passwordData.newPassword) {
        throw new BadRequestException('New password must be different from current password', 'SAME_PASSWORD');
      }

      const user = await this.findUserByIdOrFail(userId);

      const isPasswordValid = await compare(passwordData.currentPassword, user.password);
      if (!isPasswordValid) {
        logSecurityEvent({
          event: 'LOGIN_FAILED',
          reason: 'Invalid current password during password change',
          userId: String(user._id),
        });
        throw new UnauthorizedException('Current password is incorrect', 'INVALID_PASSWORD');
      }

      const hashedPassword = await hash(passwordData.newPassword, BCRYPT_ROUNDS);

      // Update password, revoke all sessions, reset lockout, and set passwordChangedAt
      await this.users.findByIdAndUpdate(userId, {
        password: hashedPassword,
        refreshTokens: [],
        failedLoginAttempts: 0,
        lockUntil: null,
        passwordChangedAt: new Date(),
        'sessionTrack.isOnline': false,
        'sessionTrack.devices': [],
      });

      logSecurityEvent({
        event: 'SESSION_REVOKED',
        userId: String(user._id),
        reason: 'Password changed - all sessions revoked',
      });
      logger.info(`Password changed for user: ${userId}`);
    } catch (error) {
      this.handleError(error, 'changePassword', userId, 'Failed to change password. Please try again');
    }
  }

  // ─── Profile ─────────────────────────────────────────────────────────

  /**
   * Update current user's profile
   */
  public async updateUser(userId: string, userData: UpdateUserDto): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(userData)) throw new BadRequestException('Invalid request data');

      if (userData.phoneNumber) {
        const existing = await this.users.findOne({ phoneNumber: userData.phoneNumber });
        if (existing && existing._id.toString() !== userId) {
          throw new ConflictException('Phone number already registered', 'PHONE_EXISTS');
        }
      }

      const user = await this.users.findByIdAndUpdate(userId, userData, { new: true });
      if (!user) throw new NotFoundException('User not found');

      logger.info(`Profile updated for user: ${userId}`);
      return user;
    } catch (error) {
      this.handleError(error, 'updateUser', userId);
    }
  }

  /**
   * Update current user's location
   */
  public async updateUserLocation(userId: string, locationData: LocationDto): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(locationData)) throw new BadRequestException('Invalid request data');

      const user = await this.users.findByIdAndUpdate(userId, { location: locationData }, { new: true });
      if (!user) throw new NotFoundException('User not found');

      logger.info(`Location updated for user: ${userId}`);
      return user;
    } catch (error) {
      this.handleError(error, 'updateUserLocation', userId);
    }
  }

  /**
   * Update client-specific profile fields
   */
  public async updateClientProfile(userId: string, clientData: UpdateClientProfileDto): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(clientData)) throw new BadRequestException('Invalid request data');

      const user = await this.findUserByIdOrFail(userId);
      if (user.type !== 'client') {
        throw new BadRequestException('This endpoint is only for client accounts');
      }

      const updateData: Partial<User> = {};
      if (clientData.firstName !== undefined) updateData.firstName = clientData.firstName;
      if (clientData.lastName !== undefined) updateData.lastName = clientData.lastName;

      const updatedUser = await this.users.findByIdAndUpdate(userId, updateData, { new: true });
      if (!updatedUser) throw new NotFoundException('User not found');

      logger.info(`Client profile updated for user: ${userId}`);
      return updatedUser;
    } catch (error) {
      this.handleError(error, 'updateClientProfile', userId);
    }
  }

  /**
   * Update user theme preference
   */
  public async updateTheme(userId: string, theme: string): Promise<User> {
    try {
      if (isEmpty(userId)) throw new BadRequestException('User ID is required');
      if (isEmpty(theme)) throw new BadRequestException('Theme is required');

      const updatedUser = await this.users.findByIdAndUpdate(userId, { theme }, { new: true });
      if (!updatedUser) throw new NotFoundException('User not found');

      logger.info(`Theme updated for user: ${userId}, theme=${theme}`);
      return updatedUser;
    } catch (error) {
      this.handleError(error, 'updateTheme', userId, 'Failed to update theme. Please try again');
    }
  }

  // ─── Image Upload ────────────────────────────────────────────────────

  /**
   * Upload current user's profile image
   */
  public async uploadProfileImage(userId: string, file: Express.Multer.File): Promise<User> {
    return this.uploadImage(
      userId,
      file,
      'profileImage',
      (buffer, id) => R2Service.uploadProfileImage(buffer, id),
      publicId => R2Service.deleteImage(publicId),
    );
  }

  /**
   * Upload cover image for current user
   */
  public async uploadCoverImage(userId: string, file: Express.Multer.File): Promise<User> {
    return this.uploadImage(
      userId,
      file,
      'coverImage',
      (buffer, id) => R2Service.uploadCoverImage(buffer, id),
      publicId => R2Service.deleteImage(publicId),
    );
  }

  // ─── Account Deletion ────────────────────────────────────────────────

  /**
   * Delete current user's own account
   * Verifies password before delegating to AdminService for actual deletion
   */
  public async deleteMe(userId: string, password: string): Promise<User> {
    try {
      if (isEmpty(userId) || isEmpty(password)) throw new BadRequestException('Invalid request data');

      const user = await this.findUserByIdOrFail(userId);

      const isPasswordValid = await compare(password, user.password);
      if (!isPasswordValid) {
        throw new BadRequestException('Invalid password', 'INVALID_PASSWORD');
      }

      if ((user as any).type === 'admin') {
        throw new BadRequestException('Admin accounts cannot be deleted via this endpoint', 'ADMIN_SELF_DELETE');
      }

      logger.info(`Delegating account deletion to AdminService for user: ${userId}`);
      return this.adminService.deleteUser(userId);
    } catch (error) {
      this.handleError(error, 'deleteMe', userId);
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  private async findUserByIdOrFail(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async findUserByEmailOrFail(email: string) {
    const user = await this.users.findOne({ email });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async clearVerificationCode(userId: any): Promise<void> {
    await this.users.findByIdAndUpdate(userId, {
      $set: {
        'emailVerification.0.verifCode': null,
        'emailVerification.0.verifCodeExpiresAt': null,
      },
    });
  }

  private async uploadImage(
    userId: string,
    file: Express.Multer.File,
    field: 'profileImage' | 'coverImage',
    uploadFn: (buffer: Buffer, id: string) => Promise<{ url: string; publicId: string }>,
    deleteFn: (publicId: string) => Promise<void>,
  ): Promise<User> {
    try {
      if (isEmpty(userId) || !file) throw new BadRequestException('Invalid request data');

      const user = await this.findUserByIdOrFail(userId);

      // Delete old image if it exists
      const existing = user[field];
      if (existing?.publicId) {
        try {
          await deleteFn(existing.publicId);
        } catch (deleteError) {
          logger.warn(`Failed to delete old ${field}: ${deleteError.message}`);
        }
      }

      const { url, publicId } = await uploadFn(file.buffer, userId);

      const updatedUser = await this.users.findByIdAndUpdate(userId, { [field]: { url, publicId } }, { new: true });
      logger.info(`${field} uploaded successfully for user: ${userId}`);
      return updatedUser;
    } catch (error) {
      this.handleError(error, `upload${field === 'profileImage' ? 'ProfileImage' : 'CoverImage'}`, userId);
    }
  }

  private handleError(error: any, method: string, userId?: string, message = 'Operation failed. Please try again'): never {
    if (error instanceof HttpException) throw error;
    logger.error(`CurrentUserService.${method} error: ${error.message}`, { userId, stack: error.stack });
    throw new InternalServerException(message);
  }
}

export default CurrentUserService;
