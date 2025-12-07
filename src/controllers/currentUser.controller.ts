import { NextFunction, Response } from 'express';
import { UpdateUserDto, LocationDto, DeleteAccountDto } from '@dtos/users.dto';
import { RequestWithUser } from '@interfaces/auth.interface';
import { User } from '@interfaces/users.interface';
import { stripSensitiveFields } from '@utils/util';
import CurrentUserService from '@/services/currentUser.service';

class CurrentUserController {

    public changePassword = async (req: RequestWithUser, res: Response, next: NextFunction) => {
      try {
        const userId = req.user._id.toString();
        const passwordData = req.body;
        await this.currentUserService.changePassword(userId, passwordData);
        res.clearCookie('refreshToken', { path: '/' });
        // Optionally clear CSRF token if you use it
        if (res.clearCookie) res.clearCookie('csrf-token', { path: '/' });
        res.status(200).json({ message: 'Password changed successfully. Please login again.' });
      } catch (error) {
        next(error);
      }
    };
  public currentUserService = new CurrentUserService();

  public getMe = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      res.status(200).json({ data: stripSensitiveFields(user), message: 'User retrieved successfully' });
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
}

export default CurrentUserController;
