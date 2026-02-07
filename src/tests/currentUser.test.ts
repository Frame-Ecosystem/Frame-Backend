import { ChangePasswordDto } from '../dtos/users.dto';
import bcrypt from 'bcrypt';
describe('changePassword', () => {
  const userId = '1';
  const user = {
    _id: userId,
    password: '$2b$10$saltsaltsaltsaltsaltsaltsaltsaltsaltsalt123456', // bcrypt hash
    refreshTokens: ['token1'],
    sessionTrack: { isOnline: true, devices: ['dev1'] },
  };
  const validDto: ChangePasswordDto = {
    currentPassword: 'OldP@ssword123',
    newPassword: 'NewSecureP@ss456',
    newPasswordConfirm: 'NewSecureP@ss456',
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('should change password if valid', async () => {
    (userModel.findById as jest.Mock).mockResolvedValue(user);
    (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hashed');
    await expect(currentUserService.changePassword(userId, validDto)).resolves.toBeUndefined();
  });
  it('should throw if new passwords do not match', async () => {
    await expect(currentUserService.changePassword(userId, { ...validDto, newPasswordConfirm: 'nope' })).rejects.toThrow(
      'New passwords do not match',
    );
  });
  it('should throw if new password is same as current', async () => {
    await expect(
      currentUserService.changePassword(userId, { ...validDto, newPassword: validDto.currentPassword, newPasswordConfirm: validDto.currentPassword }),
    ).rejects.toThrow('New password must be different from current password');
  });
  it('should throw if user not found', async () => {
    (userModel.findById as jest.Mock).mockResolvedValue(null);
    await expect(currentUserService.changePassword(userId, validDto)).rejects.toThrow('User not found');
  });
  it('should throw if current password is incorrect', async () => {
    (userModel.findById as jest.Mock).mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);
    await expect(currentUserService.changePassword(userId, validDto)).rejects.toThrow('Current password is incorrect');
  });
});
import CurrentUserService from '../services/currentUser.service';
import userModel from '../models/users.model';

jest.mock('../models/users.model');

const currentUserService = new CurrentUserService();

describe('CurrentUserService', () => {
  describe('updateUser', () => {
    it('should update user', async () => {
      (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: '1', email: 'a@email.com' });
      const user = await currentUserService.updateUser('1', { email: 'a@email.com' });
      expect(user).toMatchObject({ _id: '1', email: 'a@email.com' });
    });
    it('should throw if not found', async () => {
      (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(currentUserService.updateUser('1', { email: 'a@email.com' })).rejects.toThrow('User not found');
    });
    it('should handle errors', async () => {
      (userModel.findByIdAndUpdate as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(currentUserService.updateUser('1', { email: 'a@email.com' })).rejects.toThrow('Operation failed. Please try again');
    });
  });

  describe('updateUserLocation', () => {
    it('should update location', async () => {
      (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: '1', location: { latitude: 1, longitude: 2, address: 'A', placeId: 'P' } });
      const user = await currentUserService.updateUserLocation('1', { latitude: 1, longitude: 2, address: 'A', placeId: 'P' });
      expect(user).toMatchObject({ _id: '1', location: { latitude: 1, longitude: 2, address: 'A', placeId: 'P' } });
    });
    it('should throw if not found', async () => {
      (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(currentUserService.updateUserLocation('1', { latitude: 1, longitude: 2, address: 'A', placeId: 'P' })).rejects.toThrow(
        'User not found',
      );
    });
    it('should handle errors', async () => {
      (userModel.findByIdAndUpdate as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(currentUserService.updateUserLocation('1', { latitude: 1, longitude: 2, address: 'A', placeId: 'P' })).rejects.toThrow(
        'Operation failed. Please try again',
      );
    });
  });

  describe('uploadProfileImage', () => {
    it('should upload image', async () => {
      (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: '1', profileImage: 'img.png' });
      const user = await currentUserService.uploadProfileImage('1', { filename: 'img.png' } as Express.Multer.File);
      expect(user).toMatchObject({ _id: '1', profileImage: 'img.png' });
    });
    it('should throw if not found', async () => {
      (userModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(currentUserService.uploadProfileImage('1', { filename: 'img.png' } as Express.Multer.File)).rejects.toThrow('User not found');
    });
    it('should handle errors', async () => {
      (userModel.findByIdAndUpdate as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(currentUserService.uploadProfileImage('1', { filename: 'img.png' } as Express.Multer.File)).rejects.toThrow(
        'Operation failed. Please try again',
      );
    });
  });

  // Add more tests for deleteMe and other methods as needed
});
