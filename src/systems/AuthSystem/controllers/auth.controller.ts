import { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { CreateUserDto } from '@systems/UserManager/dtos/user.dto';
import { LoginUserDto } from '@systems/AuthSystem/dtos/auth.dto';
import { RequestWithUser, RefreshTokenPayload } from '@systems/AuthSystem/interfaces/auth.interface';
import { User } from '@systems/UserManager/interfaces/user.interface';
import AuthService from '@systems/AuthSystem/services/auth.service';
import { NODE_ENV, REFRESH_TOKEN_SECRET, FRONTEND_BASE_URL } from '@config';
import { setCsrfToken, clearCsrfToken } from '@middlewares/csrf.middleware';
import { stripSensitiveFields } from '@utils/util';

/** 7-day cookie max age in milliseconds */
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

class AuthController {
  private authService = new AuthService();

  /**
   * Extract device info from the request for session tracking.
   */
  private extractDeviceInfo(req: Request): { userAgent?: string; ip: string; deviceName?: string } {
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : Array.isArray(req.headers['user-agent'])
        ? req.headers['user-agent'][0]
        : undefined;
    const ip = typeof req.ip === 'string' && req.ip ? req.ip : req.socket?.remoteAddress || 'Unknown';
    const deviceName = typeof req.body?.deviceName === 'string' ? req.body.deviceName : undefined;
    return { userAgent, ip, deviceName };
  }

  /**
   * Set the refresh token HttpOnly cookie on the response.
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string, sameSite: 'strict' | 'lax' = 'strict'): void {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite,
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/',
    });
  }

  /**
   * Send an auth response, branching on mobile vs web client.
   * Mobile: returns both tokens in the body.
   * Web: sets refresh token as HttpOnly cookie, returns access token.
   */
  private sendAuthResponse(
    req: Request,
    res: Response,
    userData: User,
    tokenData: { token: string; expiresIn: number },
    refreshToken: string,
    message: string,
  ): void {
    const isMobile = req.headers['x-client-type'] === 'mobile';
    if (isMobile) {
      res.status(200).json({
        data: stripSensitiveFields(userData),
        accessToken: tokenData.token,
        refreshToken,
        expiresIn: tokenData.expiresIn,
        message,
      });
    } else {
      this.setRefreshTokenCookie(res, refreshToken);
      setCsrfToken(res);
      res.status(200).json({
        data: stripSensitiveFields(userData),
        token: tokenData.token,
        expiresIn: tokenData.expiresIn,
        message,
      });
    }
  }

  public signUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateUserDto = req.body;
      const deviceInfo = this.extractDeviceInfo(req);
      const { message } = await this.authService.signup(userData, deviceInfo);

      res.status(200).json({ message, success: true });
    } catch (error) {
      next(error);
    }
  };

  public verifyMagicLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: 'Verification token is required', success: false });
      }

      const deviceInfo = this.extractDeviceInfo(req);
      const { user, tokenData, refreshToken } = await this.authService.verifyMagicLink(token, deviceInfo);

      this.sendAuthResponse(req, res, user, tokenData, refreshToken, 'verification_successful');
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
      const deviceInfo = this.extractDeviceInfo(req);
      const { findUser, tokenData, refreshToken } = await this.authService.login(userData, deviceInfo);

      this.sendAuthResponse(req, res, findUser, tokenData, refreshToken, 'login');
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
      const userData = req.user;
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
      const refreshToken = req.cookies['refreshToken'] || req.body?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token missing' });
      }

      const isMobile = req.headers['x-client-type'] === 'mobile';
      const { userAgent, ip } = this.extractDeviceInfo(req);
      const { tokenData, newRefreshToken } = await this.authService.refreshAccessToken(refreshToken, { userAgent, ip });

      if (isMobile) {
        res.status(200).json({
          token: tokenData.token,
          refreshToken: newRefreshToken,
          expiresIn: tokenData.expiresIn,
          message: 'Token refreshed',
        });
      } else {
        this.setRefreshTokenCookie(res, newRefreshToken);
        res.status(200).json({
          token: tokenData.token,
          expiresIn: tokenData.expiresIn,
          message: 'Token refreshed',
        });
      }
    } catch (error) {
      next(error);
    }
  };

  public googleAuthCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      if (!user) {
        return res.status(401).json({ message: 'Google authentication failed' });
      }

      const deviceInfo = this.extractDeviceInfo(req);
      const { tokenData, refreshToken } = await this.authService.generateTokensForOAuthUser(user, deviceInfo);

      const isMobile = req.headers['x-client-type'] === 'mobile';
      if (isMobile) {
        res.status(200).json({
          data: stripSensitiveFields(user),
          accessToken: tokenData.token,
          refreshToken,
          expiresIn: tokenData.expiresIn,
          message: 'google-auth',
        });
      } else {
        this.setRefreshTokenCookie(res, refreshToken, 'lax');
        setCsrfToken(res);
        return res.redirect(`${FRONTEND_BASE_URL}/auth/google/callback?status=success&provider=google`);
      }
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
