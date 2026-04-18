import { NextFunction, Request, Response } from 'express';
import { CreateUserDto, UpdateUserDto } from '@dtos/user/user.dto';
import { User } from '@interfaces/user/user.interface';
import UserManagementService from '@services/admin/userManagement.service';
import { stripSensitiveFields } from '@utils/util';

class UserManagementController {
  private userManagementService = new UserManagementService();

  public getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = typeof req.query.search === 'string' ? req.query.search : '';

      const { users, total } = await this.userManagementService.findUsersPaginated(search, page, limit);
      res.status(200).json({
        data: users.map(stripSensitiveFields),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        message: 'findAll',
      });
    } catch (error) {
      next(error);
    }
  };

  public getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const user: User = await this.userManagementService.findUserById(userId);
      res.status(200).json({ data: stripSensitiveFields(user), message: 'findOne' });
    } catch (error) {
      next(error);
    }
  };

  public createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateUserDto = req.body;
      const user: User = await this.userManagementService.createUser(userData);
      res.status(201).json({ data: stripSensitiveFields(user), message: 'created' });
    } catch (error) {
      next(error);
    }
  };

  public updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const userData: UpdateUserDto = req.body;
      const user: User = await this.userManagementService.updateUser(userId, userData);
      res.status(200).json({ data: stripSensitiveFields(user), message: 'updated' });
    } catch (error) {
      next(error);
    }
  };

  public deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const user: User = await this.userManagementService.deleteUser(userId);
      res.status(200).json({ data: stripSensitiveFields(user), message: 'deleted' });
    } catch (error) {
      next(error);
    }
  };

  public getOnlineUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const onlineUsers = await this.userManagementService.getOnlineUsers();
      res.status(200).json({ data: onlineUsers, message: 'Online users retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public changeUserBlockedState = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const { isBlocked } = req.body;
      if (typeof isBlocked !== 'boolean') {
        return res.status(400).json({ message: 'isBlocked must be a boolean' });
      }
      const user: User = await this.userManagementService.changeUserBlockedState(userId, isBlocked);
      res.status(200).json({ data: stripSensitiveFields(user), message: `User ${isBlocked ? 'blocked' : 'unblocked'}` });
    } catch (error) {
      next(error);
    }
  };

  public getAllLoungeNames = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lounges = await this.userManagementService.getAllLoungeNames();
      res.status(200).json({
        data: lounges,
        count: lounges.length,
        message: 'Lounge names retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default UserManagementController;
