import { NextFunction, Response } from 'express';
import { verify, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { SECRET_KEY } from '@config';
import { HttpException } from '@exceptions/HttpException';
import { DataStoredInToken, RequestWithUser } from '@interfaces/auth/auth.interface';
import userModel from '@models/user/users.model';
import { logSecurityEvent } from '@utils/logger';

// Generic error message for client (security: don't leak internal details)
const AUTH_ERROR_MESSAGE = 'Authentication failed';

const authMiddleware = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header only (access token stored in JS memory)
    const headerAuth = req.header('Authorization') || '';

    const token = headerAuth.startsWith('Bearer ') ? headerAuth.slice(7).trim() : headerAuth.trim();

    if (!token) {
      logSecurityEvent({
        event: 'INVALID_TOKEN',
        reason: 'No token provided',
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
      return next(new HttpException(401, AUTH_ERROR_MESSAGE));
    }

    const secretKey: string = SECRET_KEY;
    let verificationResponse: DataStoredInToken;

    try {
      verificationResponse = verify(token, secretKey) as DataStoredInToken;
    } catch (jwtError) {
      // Detailed internal logging for JWT-specific errors
      const baseLogData = {
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      };

      if (jwtError instanceof TokenExpiredError) {
        logSecurityEvent({
          event: 'INVALID_TOKEN',
          reason: 'Access token expired',
          expiredAt: jwtError.expiredAt?.toISOString(),
          ...baseLogData,
        });
      } else if (jwtError instanceof JsonWebTokenError) {
        logSecurityEvent({
          event: 'INVALID_TOKEN',
          reason: `JWT error: ${jwtError.message}`,
          ...baseLogData,
        });
      } else if (jwtError instanceof NotBeforeError) {
        logSecurityEvent({
          event: 'INVALID_TOKEN',
          reason: 'Token not yet valid',
          ...baseLogData,
        });
      } else {
        logSecurityEvent({
          event: 'INVALID_TOKEN',
          reason: `Unknown JWT error: ${jwtError.message}`,
          ...baseLogData,
        });
      }

      return next(new HttpException(401, AUTH_ERROR_MESSAGE));
    }

    const userId = verificationResponse._id;
    const findUser = await userModel.findById(userId);

    if (!findUser) {
      logSecurityEvent({
        event: 'INVALID_TOKEN',
        reason: 'User not found for valid token',
        userId,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
      });
      return next(new HttpException(401, AUTH_ERROR_MESSAGE));
    }

    req.user = findUser;
    return next();
  } catch (error) {
    logSecurityEvent({
      event: 'INVALID_TOKEN',
      reason: `Unexpected error: ${error.message}`,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      path: req.path,
    });
    return next(new HttpException(401, AUTH_ERROR_MESSAGE));
  }
};

export default authMiddleware;
