import { NextFunction, Request, Response } from 'express';
import { CreateUserDto, LocationDto } from '@dtos/users.dto';
import { User } from '@interfaces/users.interface';
import userService from '@services/users.service';
import cloudinaryService from '@services/cloudinary.service';
import { HttpException } from '@exceptions/HttpException';
import { RequestWithUser } from '@interfaces/auth.interface';
import AuthService from '@services/auth.service';

class UsersController {
  public userService = new userService();
  public authService = new AuthService();

  public getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const findAllUsersData: User[] = await this.userService.findAllUser();

      res.status(200).json({ data: findAllUsersData, message: 'findAll' });
    } catch (error) {
      next(error);
    }
  };

  public getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const findOneUserData: User = await this.userService.findUserById(userId);

      res.status(200).json({ data: findOneUserData, message: 'findOne' });
    } catch (error) {
      next(error);
    }
  };

  public createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateUserDto = req.body;
      const createUserData: User = await this.userService.createUser(userData);

      res.status(201).json({ data: createUserData, message: 'created' });
    } catch (error) {
      next(error);
    }
  };

  public updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const userData: CreateUserDto = req.body;
      const updateUserData: User = await this.userService.updateUser(userId, userData);

      res.status(200).json({ data: updateUserData, message: 'updated' });
    } catch (error) {
      next(error);
    }
  };

  public deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const deleteUserData: User = await this.userService.deleteUser(userId);

      res.status(200).json({ data: deleteUserData, message: 'deleted' });
    } catch (error) {
      next(error);
    }
  };

  public updateUserLocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const locationData: LocationDto = req.body;
      const updatedUserData: User = await this.userService.updateUserLocation(userId, locationData);

      res.status(200).json({ data: updatedUserData, message: 'location updated' });
    } catch (error) {
      next(error);
    }
  };

  public uploadProfileImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;

      if (!req.file) {
        throw new Error('No file uploaded');
      }

      const uploadResult = await cloudinaryService.uploadProfileImage(req.file.buffer, userId);
      const updatedUserData: User = await this.userService.updateProfileImage(userId, uploadResult.url);

      res.status(200).json({ data: updatedUserData, message: 'profile image uploaded and saved' });
    } catch (error) {
      next(error);
    }
  };

  public getProfileImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const imageData = await this.userService.getUserProfileImage(userId);

      res.status(200).json({ data: imageData, message: 'profile image retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public async getUserByToken(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.headers.authorization?.split('Bearer ')[1];
      if (!token) {
        throw new HttpException(400, 'Token is missing');
      }

      const user = await this.authService.getUserByToken(token);
      res.status(200).json({ data: user, message: 'User retrieved successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default UsersController;
