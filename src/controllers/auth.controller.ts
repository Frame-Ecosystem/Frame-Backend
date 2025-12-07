import { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { CreateUserDto, LoginUserDto, ChangePasswordDto } from '@dtos/users.dto';
import { RequestWithUser, RefreshTokenPayload } from '@interfaces/auth.interface';
import { User } from '@interfaces/users.interface';
import AuthService from '@services/auth.service';
import { NODE_ENV, REFRESH_TOKEN_SECRET } from '@config';
import { setCsrfToken, clearCsrfToken } from '@middlewares/csrf.middleware';
import { stripSensitiveFields } from '@utils/util';

class AuthController {
  public authService = new AuthService();

  public signUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateUserDto = req.body;
      const signUpUserData: User = await this.authService.signup(userData);

      res.status(201).json({ data: stripSensitiveFields(signUpUserData), message: 'signup' });
    } catch (error) {
      next(error);
    }
  };

  public logIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: LoginUserDto = req.body;

      // Collect device info for session tracking
      // Fix #2: Ensure IP always has a default value
      const deviceInfo = {
        userAgent: req.headers['user-agent'] as string | undefined,
        ip: (req.ip || req.socket?.remoteAddress || 'Unknown') as string,
        deviceName: req.body?.deviceName as string | undefined, // Optional: client can send device name
      };

      const { findUser, tokenData, refreshToken } = await this.authService.login(userData, deviceInfo);

      // Set refresh token as HttpOnly cookie (secure from XSS)
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/', // Sent to all endpoints (auth routes are at root)
      });

      // Set CSRF token for protection against cross-site request forgery
      setCsrfToken(res);

      // Access token returned in body only - client stores in JS memory
      // Client sends it via Authorization header on subsequent requests
      res.status(200).json({
        data: stripSensitiveFields(findUser),
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
      // Get jti from the refresh token cookie to logout only this device
      const refreshToken = req.cookies['refreshToken'];
      let jti: string | undefined;
      if (refreshToken) {
        try {
          const decoded = verify(refreshToken, REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
          jti = decoded.jti;
        } catch {
          // Token invalid, will logout from all devices
        }
      }

      const logOutUserData: User = await this.authService.logout(userData, jti);

      // Clear refresh token cookie and CSRF token
      res.clearCookie('refreshToken', { path: '/' });
      clearCsrfToken(res);
      res.status(200).json({ data: stripSensitiveFields(logOutUserData), message: 'logout' });
    } catch (error) {
      next(error);
    }
  };

  public logOutAllDevices = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userData: User = req.user;
      await this.authService.logoutAllDevices(userData._id);

      // Clear refresh token cookie and CSRF token
      res.clearCookie('refreshToken', { path: '/' });
      clearCsrfToken(res);
      res.status(200).json({ message: 'Logged out from all devices' });
    } catch (error) {
      next(error);
    }
  };

  public refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Read refresh token from HttpOnly cookie (secure from XSS)
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

      // Rotate refresh token - set new one in HttpOnly cookie
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      // Return new access token in body - client stores in JS memory
      res.status(200).json({
        token: tokenData.token,
        expiresIn: tokenData.expiresIn,
        message: 'Token refreshed',
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // PASSWORD MANAGEMENT
  // ============================================

  /**
   * Change password for authenticated user
   */

  // ============================================
  // SESSION TRACKING
  // ============================================

  /**
   * Get all online users with their devices and lastSeen
   */
  public getSessionTrack = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const onlineUsers = await this.authService.getOnlineUsers();
      res.status(200).json({
        data: onlineUsers,
        count: onlineUsers.length,
        message: 'Online users retrieved',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
