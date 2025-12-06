import { NextFunction, Request, Response } from 'express';
import { CreateUserDto, LoginUserDto } from '@dtos/users.dto';
import { RequestWithUser } from '@interfaces/auth.interface';
import { User } from '@interfaces/users.interface';
import AuthService from '@services/auth.service';
import { NODE_ENV } from '@config';
import { setCsrfToken, clearCsrfToken } from '@middlewares/csrf.middleware';

class AuthController {
  public authService = new AuthService();

  public signUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateUserDto = req.body;
      const signUpUserData: User = await this.authService.signup(userData);

      res.status(201).json({ data: signUpUserData, message: 'signup' });
    } catch (error) {
      next(error);
    }
  };

  public logIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: LoginUserDto = req.body;

      // Collect device info for session tracking
      const deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress,
        deviceName: req.body.deviceName, // Optional: client can send device name
      };

      const { cookie, findUser, tokenData, refreshToken } = await this.authService.login(userData, deviceInfo);

      // Set refresh token as HttpOnly cookie (not in JSON body for security)
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
      // Set CSRF token for protection against cross-site request forgery
      setCsrfToken(res);
      res.setHeader('Set-Cookie', [cookie]);
      res.status(200).json({
        data: findUser,
        token: tokenData.token,
        expiresIn: tokenData.expiresIn,
        message: 'login',
      });
    } catch (error) {
      next(error);
    }
  };

  public logOut = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userData: User = req.user;
      // Get jti from the current refresh token to logout only this device
      const refreshToken = req.cookies['refreshToken'];
      let jti: string | undefined;
      if (refreshToken) {
        try {
          const decoded = require('jsonwebtoken').verify(refreshToken, require('@config').REFRESH_TOKEN_SECRET);
          jti = decoded.jti;
        } catch {
          // Token invalid, will logout from all devices
        }
      }

      const logOutUserData: User = await this.authService.logout(userData, jti);

      // Clear all auth cookies (access token, refresh token, CSRF token)
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/' });
      clearCsrfToken(res);
      res.status(200).json({ data: logOutUserData, message: 'logout' });
    } catch (error) {
      next(error);
    }
  };

  public logOutAllDevices = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userData: User = req.user;
      await this.authService.logoutAllDevices(userData._id);

      // Clear all auth cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/' });
      clearCsrfToken(res);
      res.status(200).json({ message: 'Logged out from all devices' });
    } catch (error) {
      next(error);
    }
  };

  public getActiveSessions = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const sessions = await this.authService.getActiveSessions(req.user._id);
      res.status(200).json({ data: sessions, message: 'Active sessions' });
    } catch (error) {
      next(error);
    }
  };

  public revokeSession = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { jti } = req.params;
      await this.authService.revokeSession(req.user._id, jti);
      res.status(200).json({ message: 'Session revoked' });
    } catch (error) {
      next(error);
    }
  };

  public refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Read refresh token from HttpOnly cookie
      const refreshToken = req.cookies['refreshToken'];
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token missing' });
      }

      // Collect device info for session tracking
      const deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress,
      };

      const { tokenData, newRefreshToken } = await this.authService.refreshAccessToken(refreshToken, deviceInfo);

      // Set new access token cookie
      const cookie = this.authService.createCookie(tokenData);
      res.setHeader('Set-Cookie', [cookie]);

      // Rotation: set new refresh token cookie
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      res.status(200).json({ data: tokenData, message: 'refresh token' });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
