import { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { CreateUserDto, LoginUserDto } from '@dtos/users.dto';
import { RequestWithUser, RefreshTokenPayload } from '@interfaces/auth.interface';
import { User } from '@interfaces/users.interface';
import AuthService from '@services/auth.service';
import { NODE_ENV, REFRESH_TOKEN_SECRET, FRONTEND_BASE_URL } from '@config';
import { setCsrfToken, clearCsrfToken } from '@middlewares/csrf.middleware';
import { stripSensitiveFields } from '@utils/util';

class AuthController {
  public authService = new AuthService();

  public signUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateUserDto = req.body;

      // Collect device info for session tracking
      const userAgent =
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : Array.isArray(req.headers['user-agent'])
          ? req.headers['user-agent'][0]
          : undefined;
      const ip = typeof req.ip === 'string' && req.ip ? req.ip : req.socket?.remoteAddress || 'Unknown';
      const deviceName = typeof req.body?.deviceName === 'string' ? req.body.deviceName : undefined;
      const deviceInfo = { userAgent, ip, deviceName };

      const { message } = await this.authService.signup(userData, deviceInfo);

      res.status(200).json({
        message,
        success: true,
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyMagicLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          message: 'Verification token is required',
          success: false,
        });
      }

      // Collect device info for session tracking
      const userAgent =
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : Array.isArray(req.headers['user-agent'])
          ? req.headers['user-agent'][0]
          : undefined;
      const ip = typeof req.ip === 'string' && req.ip ? req.ip : req.socket?.remoteAddress || 'Unknown';
      const deviceName = typeof req.body?.deviceName === 'string' ? req.body.deviceName : undefined;
      const deviceInfo = { userAgent, ip, deviceName };

      const { user, tokenData, refreshToken } = await this.authService.verifyMagicLink(token, deviceInfo);

      // Detect client type from header
      const clientType = req.headers['x-client-type'];
      if (clientType === 'mobile') {
        // Mobile: return both tokens in body
        res.status(200).json({
          data: stripSensitiveFields(user),
          accessToken: tokenData.token,
          refreshToken,
          expiresIn: tokenData.expiresIn,
          message: 'verification_successful',
        });
      } else {
        // Web: set refresh token as HttpOnly cookie, return only access token
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/',
        });
        setCsrfToken(res);
        res.status(200).json({
          data: stripSensitiveFields(user),
          token: tokenData.token,
          expiresIn: tokenData.expiresIn,
          message: 'verification_successful',
        });
      }
    } catch (error) {
      next(error);
    }
  };

  public forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      await this.authService.forgotPassword(email);
      res.status(200).json({
        message: 'Password reset link sent to your email',
      });
    } catch (error) {
      next(error);
    }
  };

  public resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body;
      await this.authService.resetPassword(token, newPassword);
      res.status(200).json({
        message: 'Password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public logIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: LoginUserDto = req.body;

      // Collect device info for session tracking with type validation
      const userAgent =
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : Array.isArray(req.headers['user-agent'])
          ? req.headers['user-agent'][0]
          : undefined;
      const ip = typeof req.ip === 'string' && req.ip ? req.ip : req.socket?.remoteAddress || 'Unknown';
      const deviceName = typeof req.body?.deviceName === 'string' ? req.body.deviceName : undefined;
      const deviceInfo = { userAgent, ip, deviceName };

      const { findUser, tokenData, refreshToken } = await this.authService.login(userData, deviceInfo);

      // Detect client type from header
      const clientType = req.headers['x-client-type'];
      if (clientType === 'mobile') {
        // Mobile: return both tokens in body
        res.status(200).json({
          data: stripSensitiveFields(findUser),
          accessToken: tokenData.token,
          refreshToken,
          expiresIn: tokenData.expiresIn,
          message: 'login',
        });
      } else {
        // Web: set refresh token as HttpOnly cookie, return only access token
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/',
        });
        setCsrfToken(res);
        res.status(200).json({
          data: stripSensitiveFields(findUser),
          token: tokenData.token,
          expiresIn: tokenData.expiresIn,
          message: 'login',
        });
      }
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

      // Collect device info for session tracking with type validation
      let userAgent: string | undefined = undefined;
      if (typeof req.headers['user-agent'] === 'string') {
        userAgent = req.headers['user-agent'];
      } else if (Array.isArray(req.headers['user-agent'])) {
        userAgent = req.headers['user-agent'][0];
      }
      let ip: string = typeof req.ip === 'string' ? req.ip : req.socket?.remoteAddress || 'Unknown';
      if (typeof ip !== 'string' || !ip) ip = 'Unknown';
      const deviceInfo = { userAgent, ip };

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

  public googleAuthCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // User is attached by Passport strategy
      const user = req.user as User;

      if (!user) {
        return res.status(401).json({ message: 'Google authentication failed' });
      }

      // Collect device info for session tracking
      const userAgent =
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : Array.isArray(req.headers['user-agent'])
          ? req.headers['user-agent'][0]
          : undefined;
      const ip = typeof req.ip === 'string' && req.ip ? req.ip : req.socket?.remoteAddress || 'Unknown';
      const deviceName = typeof req.body?.deviceName === 'string' ? req.body.deviceName : undefined;
      const deviceInfo = { userAgent, ip, deviceName };

      // Generate tokens for the authenticated user
      const { tokenData, refreshToken } = await this.authService.generateTokensForOAuthUser(user, deviceInfo);

      // Detect client type from header
      const clientType = req.headers['x-client-type'];
      if (clientType === 'mobile') {
        // Mobile: return both tokens in body
        res.status(200).json({
          data: stripSensitiveFields(user),
          accessToken: tokenData.token,
          refreshToken,
          expiresIn: tokenData.expiresIn,
          message: 'google-auth',
        });
      } else {
        // Web: set refresh token as HttpOnly cookie, then redirect to frontend callback page
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/',
        });
        setCsrfToken(res);
        const redirectUrl = `${FRONTEND_BASE_URL}/auth/google/callback?status=success&provider=google`;
        return res.redirect(redirectUrl);
      }
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
