import { NextFunction, Request, Response } from 'express';
import { CreateUserDto, UpdateUserDto, LocationDto } from '@dtos/users.dto';
import { User } from '@interfaces/users.interface';
import AdminService from '@services/admin.service';
import { stripSensitiveFields } from '@utils/util';

class AdminController {
  public adminService = new AdminService();

  public getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users: User[] = await this.adminService.findAllUsers();
      res.status(200).json({ data: users.map(stripSensitiveFields), message: 'findAll' });
    } catch (error) {
      next(error);
    }
  };

  public getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const user: User = await this.adminService.findUserById(userId);
      res.status(200).json({ data: stripSensitiveFields(user), message: 'findOne' });
    } catch (error) {
      next(error);
    }
  };

  public createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateUserDto = req.body;
      const user: User = await this.adminService.createUser(userData);
      res.status(201).json({ data: stripSensitiveFields(user), message: 'created' });
    } catch (error) {
      next(error);
    }
  };

  public updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const userData: UpdateUserDto = req.body;
      const user: User = await this.adminService.updateUser(userId, userData);
      res.status(200).json({ data: stripSensitiveFields(user), message: 'updated' });
    } catch (error) {
      next(error);
    }
  };

  public deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.id;
      const user: User = await this.adminService.deleteUser(userId);
      res.status(200).json({ data: stripSensitiveFields(user), message: 'deleted' });
    } catch (error) {
      next(error);
    }
  };

  public getOnlineUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const onlineUsers = await this.adminService.getOnlineUsers();
      res.status(200).json({ data: onlineUsers, message: 'Online users retrieved' });
    } catch (error) {
      next(error);
    }
  };
}

export default AdminController;
