import CurrentUserService from '../services/currentUser.service';
import { UpdateUserDto, LocationDto } from '../dtos/users.dto';
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
