jest.mock('@systems/UserManager/models/user.model', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
  isAdmin: (u) => u?.type === 'admin',
  isLounge: (u) => u?.type === 'lounge',
  isClient: (u) => u?.type === 'client',
}));

import UserManagementService from '@systems/UserManager/services/userManagement.service';
import { CreateUserDto, UpdateUserDto } from '@systems/UserManager/dtos/user.dto';
import userModel from '@systems/UserManager/models/user.model';

const adminService = new UserManagementService();

describe('UserManagementService', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('findUsersPaginated', () => {
    it('returns paginated users', async () => {
      const chain: any = { select: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([{ _id: '1', email: 'a@e.com' }]) };
      (userModel.find as jest.Mock).mockReturnValue(chain);
      (userModel.countDocuments as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
      const res = await adminService.findUsersPaginated('', 1, 20);
      expect(res).toEqual({ users: [{ _id: '1', email: 'a@e.com' }], total: 1 });
    });
  });

  describe('findUserById', () => {
    it('returns user', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue({ _id: '1', email: 'a@e.com' });
      expect(await adminService.findUserById('1')).toEqual({ _id: '1', email: 'a@e.com' });
    });
    it('throws when not found', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(adminService.findUserById('1')).rejects.toThrow('User not found');
    });
  });

  describe('createUser', () => {
    const dto = { email: 'a@e.com', password: 'pass', phoneNumber: '123' };
    it('creates user', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(null);
      (userModel.create as jest.Mock).mockResolvedValue({ _id: '1', ...dto });
      const u = await adminService.createUser(dto);
      expect(u).toMatchObject({ _id: '1', email: 'a@e.com' });
    });
  });

  describe('updateUser', () => {
    const dto = { email: 'a@e.com', phoneNumber: '123' };
    it('updates user', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(null);
      (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: '1', ...dto });
      const u = await adminService.updateUser('1', dto);
      expect(u).toMatchObject({ _id: '1', email: 'a@e.com' });
    });
    it('throws when not found', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(null);
      (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(adminService.updateUser('1', dto)).rejects.toThrow('User not found');
    });
  });

  describe('deleteUser', () => {
    it('deletes user', async () => {
      (userModel.findByIdAndDelete as jest.Mock).mockResolvedValue({ _id: '1', email: 'a@e.com' });
      const u = await adminService.deleteUser('1');
      expect(u).toMatchObject({ _id: '1', email: 'a@e.com' });
    });
    it('throws when not found', async () => {
      (userModel.findByIdAndDelete as jest.Mock).mockResolvedValue(null);
      await expect(adminService.deleteUser('1')).rejects.toThrow('User not found');
    });
  });

  describe('getOnlineUsers', () => {
    it('returns online users', async () => {
      const list = [{ _id: '1', email: 'a@e.com', firstName: 'T', lastName: 'U', sessionTrack: { isOnline: true, devices: [] } }];
      const q: any = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(list) };
      (userModel.find as jest.Mock).mockReturnValue(q);
      const users = await adminService.getOnlineUsers();
      expect(users[0]).toMatchObject({ _id: '1', email: 'a@e.com' });
    });
  });
});