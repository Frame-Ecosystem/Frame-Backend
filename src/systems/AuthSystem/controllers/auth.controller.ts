import { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { CreateUserDto } from '@systems/UserManager/dtos/user.dto';
import { LoginUserDto, SwitchSessionDto } from '@systems/AuthSystem/dtos/auth.dto';
import { RequestWithUser, RefreshTokenPayload } from '@systems/AuthSystem/interfaces/auth.interface';
import { User } from '@systems/UserManager/interfaces/user.interface';
import AuthService from '@systems/AuthSystem/services/auth.service';
import SessionSwitchService from '@systems/AuthSystem/services/sessionSwitch.service';
import {
  NODE_ENV,
  REFRESH_TOKEN_SECRET,
  FRONTEND_BASE_URL,
  REFRESH_TOKEN_COOKIE_DOMAIN,
  REFRESH_TOKEN_COOKIE_SAMESITE,
  REFRESH_TOKEN_COOKIE_SECURE,
} from '@config';
import { setCsrfToken, clearCsrfToken } from '@middlewares/csrf.middleware';
import { stripSensitiveFields } from '@utils/util';

/** 7-day cookie max age in milliseconds */
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

class AuthController {
  private authService = new AuthService();
  private sessionSwitchService = new SessionSwitchService();

  /**
   * Decode a refresh token payload with runtime validation.
   */
  private decodeRefreshTokenPayload(refreshToken: string): RefreshTokenPayload | null {
    if (!REFRESH_TOKEN_SECRET) return null;

    const decoded = verify(refreshToken, REFRESH_TOKEN_SECRET);
    if (!decoded || typeof decoded !== 'object') return null;

    const payload = decoded as Record<string, unknown>;
    if (typeof payload._id !== 'string' || typeof payload.jti !== 'string') return null;

    return payload as unknown as RefreshTokenPayload;
  }

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
   * Resolve whether the request was made via HTTPS (including behind reverse proxy).
   */
  private isSecureRequest(req: Request): boolean {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    return req.secure || proto === 'https';
  }

  /**
   * Set the refresh token HttpOnly cookie on the response.
   * In local HTTP development, use SameSite=Lax to avoid invalid cookie rejection.
   */
  private getRefreshTokenCookieOptions(req: Request, sameSite?: 'strict' | 'lax' | 'none') {
    const isProduction = NODE_ENV === 'production';
    const isSecure = REFRESH_TOKEN_COOKIE_SECURE === 'auto' ? isProduction || this.isSecureRequest(req) : REFRESH_TOKEN_COOKIE_SECURE === 'true';

    const autoSameSite = isSecure ? 'none' : 'lax';
    const site = sameSite ?? (REFRESH_TOKEN_COOKIE_SAMESITE === 'auto' ? autoSameSite : REFRESH_TOKEN_COOKIE_SAMESITE);

    return {
      httpOnly: true,
      secure: isSecure,
      sameSite: (site as any) || 'lax',
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/',
      ...(isProduction && REFRESH_TOKEN_COOKIE_DOMAIN ? { domain: REFRESH_TOKEN_COOKIE_DOMAIN } : {}),
    };
  }

  private setRefreshTokenCookie(req: Request, res: Response, refreshToken: string, sameSite?: 'strict' | 'lax' | 'none'): void {
    res.cookie('refreshToken', refreshToken, this.getRefreshTokenCookieOptions(req, sameSite));
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
      this.setRefreshTokenCookie(req, res, refreshToken);
      setCsrfToken(res);

      const origin = req.headers.origin;
      const isDevWebOrigin = NODE_ENV !== 'production' && typeof origin === 'string' && origin.startsWith('http://');

      res.status(200).json({
        data: stripSensitiveFields(userData),
        token: tokenData.token,
        expiresIn: tokenData.expiresIn,
        ...(NODE_ENV !== 'production' && isDevWebOrigin ? { refreshToken } : {}),
        message,
      });
    }
  }

  public getCsrfToken = (req: Request, res: Response, next: NextFunction) => {
    try {
      setCsrfToken(res);
      res.status(200).json({ message: 'CSRF token generated', success: true });
    } catch (error) {
      next(error);
    }
  };

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

  public resendVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      const { message } = await this.authService.resendVerification(email);
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
      const { passwordStrength } = await this.authService.resetPassword(token, newPassword);
      res.status(200).json({
        message: 'Password reset successfully',
        passwordStrength,
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
          const decoded = this.decodeRefreshTokenPayload(refreshToken);
          jti = decoded?.jti;
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
        this.setRefreshTokenCookie(req, res, newRefreshToken);
        setCsrfToken(res);

        const origin = req.headers.origin;
        const isDevWebOrigin = NODE_ENV !== 'production' && typeof origin === 'string' && origin.startsWith('http://');

        res.status(200).json({
          token: tokenData.token,
          expiresIn: tokenData.expiresIn,
          ...(NODE_ENV !== 'production' && isDevWebOrigin ? { refreshToken: newRefreshToken } : {}),
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
        this.setRefreshTokenCookie(req, res, refreshToken, 'lax');
        setCsrfToken(res);
        return res.redirect(`${FRONTEND_BASE_URL}/auth/google/callback?status=success&provider=google`);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * List all active sessions for the authenticated user.
   * GET /v1/auth/sessions
   *
   * Response: array of {sessionId, userId, displayName, emailOrPhoneMasked, deviceName, createdAt, lastUsedAt, isCurrent}
   */
  public listSessions = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const refreshToken = req.cookies['refreshToken'];
      let currentJti: string | undefined;

      if (refreshToken) {
        try {
          const decoded = this.decodeRefreshTokenPayload(refreshToken);
          currentJti = decoded?.jti;
        } catch {
          // Ignore decode errors
        }
      }

      const sessions = await this.sessionSwitchService.listSessions(user, currentJti);
      res.status(200).json({
        data: sessions,
        message: 'Sessions retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Switch to a specific session.
   * POST /v1/auth/switch-session
   *
   * Request: {sessionId: string}
   * Response: {token, expiresIn, csrfToken, data: user}
   *
   * Behavior:
   * 1. Verify sessionId belongs to user
   * 2. Verify session is active and not expired
   * 3. Issue new auth artifacts for target session
   * 4. Set new refresh token cookie
   * 5. Audit log the switch
   */
  public switchSession = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const { sessionId } = req.body as SwitchSessionDto;
      const refreshToken = req.cookies['refreshToken'];

      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token missing' });
      }

      let currentJti: string | undefined;
      try {
        const decoded = this.decodeRefreshTokenPayload(refreshToken);
        currentJti = decoded?.jti;
      } catch {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }

      const { userAgent, ip } = this.extractDeviceInfo(req);
      const result = await this.sessionSwitchService.switchSession(user, sessionId, currentJti, { userAgent, ip });

      // Generate new refresh token for the target session
      const newRefreshToken = await this.authService.generateRefreshToken(user, { userAgent, ip });

      const isMobile = req.headers['x-client-type'] === 'mobile';
      if (isMobile) {
        res.status(200).json({
          token: result.token,
          refreshToken: newRefreshToken,
          expiresIn: result.expiresIn,
          data: stripSensitiveFields(user),
          message: 'Session switched successfully',
        });
      } else {
        this.setRefreshTokenCookie(req, res, newRefreshToken);
        setCsrfToken(res);

        res.status(200).json({
          token: result.token,
          expiresIn: result.expiresIn,
          data: stripSensitiveFields(user),
          message: 'Session switched successfully',
        });
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Verify the current active session.
   * POST /v1/auth/switch-session/verify
   *
   * Response: {sessionId, userId, isCurrentSession}
   *
   * Useful for frontend to assert post-switch correctness.
   */
  public verifySwitchSession = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const refreshToken = req.cookies['refreshToken'];

      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token missing' });
      }

      let currentJti: string | undefined;
      try {
        const decoded = this.decodeRefreshTokenPayload(refreshToken);
        currentJti = decoded?.jti;
      } catch {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }

      const result = await this.sessionSwitchService.verifyCurrentSession(user, currentJti);
      res.status(200).json({
        data: result,
        message: 'Session verified successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
