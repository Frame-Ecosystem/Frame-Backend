import { NextFunction, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import { RequestWithUser } from '@interfaces/auth.interface';
import { isClient } from '@models/users.model';
import { logSecurityEvent } from '@utils/logger';

/**
 * Client Authorization Middleware
 * Must be used AFTER authMiddleware (requires req.user to be set)
 * Checks if the authenticated user is a Client using inheritance/discriminator
 */
const clientMiddleware = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      logSecurityEvent({
        event: 'CLIENT_ACCESS_DENIED',
        reason: 'No user found in request (authMiddleware not applied?)',
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
      return next(new HttpException(401, 'Authentication required'));
    }

    // Check if user is Client using the isClient helper function
    if (!isClient(user as any)) {
      const userType = (user as any).type || 'user';
      logSecurityEvent({
        event: 'CLIENT_ACCESS_DENIED',
        reason: 'User is not a client',
        userId: String(user._id),
        userType,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
      return next(new HttpException(403, 'Client access required'));
    }

    return next();
  } catch (error) {
    logSecurityEvent({
      event: 'CLIENT_ACCESS_DENIED',
      reason: `Unexpected error: ${error.message}`,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      path: req.path,
    });
    return next(new HttpException(403, 'Client access required'));
  }
};

export default clientMiddleware;
