import AdminService from '../services/admin.service';
import { CreateUserDto, UpdateUserDto } from '../dtos/users.dto';
import userModel from '../models/users.model';

jest.mock('../models/users.model');

const adminService = new AdminService();

describe('AdminService', () => {
  describe('findUsersPaginated', () => {
    it('should return paginated users', async () => {
      (userModel.find as jest.Mock).mockResolvedValue([{ _id: '1', email: 'a@email.com' }]);
      (userModel.countDocuments as jest.Mock).mockResolvedValue(1);
      const result = await adminService.findUsersPaginated({}, 1, 20);
      expect(result).toEqual({ users: [{ _id: '1', email: 'a@email.com' }], total: 1 });
    });
    it('should handle errors', async () => {
      (userModel.find as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(adminService.findUsersPaginated({}, 1, 20)).rejects.toThrow('Operation failed. Please try again');
    });
  });

  describe('findUserById', () => {
    it('should return user by id', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue({ _id: '1', email: 'a@email.com' });
      const user = await adminService.findUserById('1');
      expect(user).toEqual({ _id: '1', email: 'a@email.com' });
    });
    it('should throw if user not found', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(adminService.findUserById('1')).rejects.toThrow('User not found');
    });
    it('should throw on error', async () => {
      (userModel.findOne as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(adminService.findUserById('1')).rejects.toThrow('Operation failed. Please try again');
    });
  });

  describe('createUser', () => {
    const dto: CreateUserDto = { email: 'a@email.com', password: 'pass', phoneNumber: '123' };
    it('should create user', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      (userModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      (userModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      (userModel.create as jest.Mock).mockResolvedValue({ _id: '1', ...dto });
      const user = await adminService.createUser(dto);
      expect(user).toMatchObject({ _id: '1', email: 'a@email.com' });
    });
    it('should throw if email exists', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValueOnce({});
      await expect(adminService.createUser(dto)).rejects.toThrow('Email already registered');
    });
    it('should throw if username exists', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      (userModel.findOne as jest.Mock).mockResolvedValueOnce({});
      await expect(adminService.createUser(dto)).rejects.toThrow('Username already taken');
    });
    it('should throw if phone exists', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      (userModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      (userModel.findOne as jest.Mock).mockResolvedValueOnce({});
      await expect(adminService.createUser(dto)).rejects.toThrow('Phone number already registered');
    });
    it('should handle errors', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      (userModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      (userModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      (userModel.create as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(adminService.createUser(dto)).rejects.toThrow('Operation failed. Please try again');
    });
  });

  describe('updateUser', () => {
    const dto: UpdateUserDto = { email: 'a@email.com', phoneNumber: '123' };
    it('should update user', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(null);
      (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: '1', ...dto });
      const user = await adminService.updateUser('1', dto);
      expect(user).toMatchObject({ _id: '1', email: 'a@email.com' });
    });
    it('should throw if not found', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(null);
      (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(adminService.updateUser('1', dto)).rejects.toThrow('User not found');
    });
    it('should handle errors', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(null);
      (userModel.findByIdAndUpdate as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(adminService.updateUser('1', dto)).rejects.toThrow('Operation failed. Please try again');
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      (userModel.findByIdAndDelete as jest.Mock).mockResolvedValue({ _id: '1', email: 'a@email.com' });
      const user = await adminService.deleteUser('1');
      expect(user).toMatchObject({ _id: '1', email: 'a@email.com' });
    });
    it('should throw if not found', async () => {
      (userModel.findByIdAndDelete as jest.Mock).mockResolvedValue(null);
      await expect(adminService.deleteUser('1')).rejects.toThrow('User not found');
    });
    it('should handle errors', async () => {
      (userModel.findByIdAndDelete as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(adminService.deleteUser('1')).rejects.toThrow('Operation failed. Please try again');
    });
  });

  describe('getOnlineUsers', () => {
    it('should return online users', async () => {
      (userModel.find as jest.Mock).mockResolvedValue([
        { _id: '1', email: 'a@email.com', username: 'user', sessionTrack: { isOnline: true, devices: [] } },
      ]);
      const users = await adminService.getOnlineUsers();
      expect(users[0]).toMatchObject({ _id: '1', email: 'a@email.com', username: 'user' });
    });
    it('should handle errors', async () => {
      (userModel.find as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(adminService.getOnlineUsers()).rejects.toThrow('Failed to retrieve online users');
    });
  });
});
