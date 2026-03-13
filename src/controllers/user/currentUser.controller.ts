import { NextFunction, Response } from 'express';
import { UpdateUserDto, LocationDto, DeleteAccountDto, UpdateClientProfileDto } from '@dtos/user/users.dto';
import { RequestWithUser } from '@interfaces/auth/auth.interface';
import { User } from '@interfaces/user/users.interface';
import { stripSensitiveFields } from '@utils/util';
import CurrentUserService from '@services/user/currentUser.service';

class CurrentUserController {
  public currentUserService = new CurrentUserService();

  public sendVerificationCode = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      await this.currentUserService.sendVerificationCode(email);
      res.status(200).json({ message: 'Verification code sent to your email.' });
    } catch (error) {
      next(error);
    }
  };

  public verifyEmailCode = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { email, code } = req.body;
      await this.currentUserService.verifyEmailCode(email, code);
      res.status(200).json({ message: 'Email verified successfully.' });
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const passwordData = req.body;
      await this.currentUserService.changePassword(userId, passwordData);
      res.clearCookie('refreshToken', { path: '/' });
      res.clearCookie('csrf-token', { path: '/' });
      res.status(200).json({ message: 'Password changed successfully. Please login again.' });
    } catch (error) {
      next(error);
    }
  };

  public getMe = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      res.status(200).json({ data: stripSensitiveFields(user), message: 'User retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateTheme = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { theme } = req.body;
      const updatedUser = await this.currentUserService.updateTheme(userId, theme);
      res.status(200).json({
        data: stripSensitiveFields(updatedUser),
        message: 'Theme updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public updateMe = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const userData: UpdateUserDto = req.body;
      const updatedUser: User = await this.currentUserService.updateUser(userId, userData);
      res.status(200).json({ data: stripSensitiveFields(updatedUser), message: 'updated' });
    } catch (error) {
      next(error);
    }
  };

  public updateLocation = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const locationData: LocationDto = req.body;
      const updatedUser: User = await this.currentUserService.updateUserLocation(userId, locationData);
      res.status(200).json({ data: stripSensitiveFields(updatedUser), message: 'location updated' });
    } catch (error) {
      next(error);
    }
  };

  public uploadProfileImage = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }
      const userId = req.user._id.toString();
      const updatedUser: User = await this.currentUserService.uploadProfileImage(userId, req.file);
      res.status(200).json({ data: stripSensitiveFields(updatedUser), message: 'Profile image uploaded successfully' });
    } catch (error) {
      next(error);
    }
  };

  public uploadCoverImage = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }
      const userId = req.user._id.toString();
      const updatedUser: User = await this.currentUserService.uploadCoverImage(userId, req.file);
      res.status(200).json({ data: stripSensitiveFields(updatedUser), message: 'Cover image uploaded successfully' });
    } catch (error) {
      next(error);
    }
  };

  public deleteMe = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const { password } = req.body as DeleteAccountDto;
      const deletedUser: User = await this.currentUserService.deleteMe(userId, password);
      res.clearCookie('refreshToken', { path: '/' });
      res.clearCookie('csrf-token', { path: '/' });
      res.status(200).json({ data: stripSensitiveFields(deletedUser), message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateClientProfile = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id.toString();
      const clientData: UpdateClientProfileDto = req.body;
      const updatedUser: User = await this.currentUserService.updateClientProfile(userId, clientData);
      res.status(200).json({ data: stripSensitiveFields(updatedUser), message: 'Client profile updated successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export default CurrentUserController;
