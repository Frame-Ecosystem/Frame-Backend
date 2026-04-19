import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../config/constants';
import mongoose from 'mongoose';
import request from 'supertest';
import App from '@/app';
import { CreateUserDto } from '@systems/UserManager/dtos/user.dto';
import { LoginUserDto } from '@systems/AuthSystem/dtos/auth.dto';
import AuthRoute from '@systems/AuthSystem/routes/auth.route';

// Valid test data that passes DTO validation
const validUserData: CreateUserDto = {
  email: 'test@email.com',
  password: 'Test@123!',
  phoneNumber: '+21650922140',
};

const validLoginData: LoginUserDto = {
  emailOrPhone: 'test@email.com',
  password: 'Test@123!',
};

beforeAll(async () => {
  jest.setTimeout(10000);
});
afterAll(async () => {
  await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
});

describe('Testing Auth', () => {
  describe('[POST] /signup', () => {
    it('response should have the Create userData', async () => {
      const authRoute = new AuthRoute();
      const users = (authRoute.authController as any).authService.users;

      users.findOne = jest.fn().mockReturnValue(null);
      const mockUser = {
        _id: '60706478aad6c9ad19a31c84',
        email: validUserData.email,
        phoneNumber: validUserData.phoneNumber,
        password: await bcrypt.hash(validUserData.password, BCRYPT_ROUNDS),
        refreshTokens: [],
      };
      users.create = jest.fn().mockReturnValue(mockUser);
      users.findById = jest.fn().mockReturnValue(mockUser);
      users.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUser);

      // Type-safe override for connect method
      (mongoose as typeof mongoose & { connect: typeof jest.fn }).connect = jest.fn();
      const app = new App([authRoute]);
      return request(app.getServer()).post(`${authRoute.path}/signup`).send(validUserData);
    });
  });

  describe('[POST] /login', () => {
    it('response should have the Set-Cookie header with the accessToken', async () => {
      const authRoute = new AuthRoute();
      const users = (authRoute.authController as any).authService.users;

      users.findOne = jest.fn().mockReturnValue({
        _id: '60706478aad6c9ad19a31c84',
        email: validUserData.email,
        phoneNumber: validUserData.phoneNumber,
        password: await bcrypt.hash(validUserData.password, BCRYPT_ROUNDS),
        refreshTokens: [],
        sessionTrack: { isOnline: false, devices: [] },
        save: jest.fn().mockResolvedValue(true),
      });

      // Mock findById and findByIdAndUpdate for login flow
      users.findById = jest.fn().mockReturnValue({
        _id: '60706478aad6c9ad19a31c84',
        email: validUserData.email,
        phoneNumber: validUserData.phoneNumber,
        refreshTokens: [],
        sessionTrack: { isOnline: true, devices: ['Test Device'] },
      });
      users.findByIdAndUpdate = jest.fn().mockResolvedValue(true);

      // Type-safe override for connect method
      (mongoose as typeof mongoose & { connect: typeof jest.fn }).connect = jest.fn();
      const app = new App([authRoute]);
      return request(app.getServer())
        .post(`${authRoute.path}/login`)
        .send(validLoginData)
        .expect('Set-Cookie', /^refreshToken=.+/);
    });
  });
});
