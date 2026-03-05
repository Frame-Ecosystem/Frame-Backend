import { NextFunction, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import { RequestWithUser } from '@interfaces/auth.interface';
import { isAdmin, isLounge, isClient } from '@models/users.model';
import { logSecurityEvent } from '@utils/logger';

/**
 * Admin, Lounge, or Client Authorization Middleware
 * Must be used AFTER authMiddleware (requires req.user to be set)
 * Checks if the authenticated user is an Admin, Lounge, or Client using inheritance/discriminator
 */
const adminOrLoungeOrClientMiddleware = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      logSecurityEvent({
        event: 'ADMIN_LOUNGE_CLIENT_ACCESS_DENIED',
        reason: 'No user found in request (authMiddleware not applied?)',
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
      return next(new HttpException(401, 'Authentication required'));
    }

    // Check if user is Admin, Lounge, or Client using the helper functions
    if (!isAdmin(user as any) && !isLounge(user as any) && !isClient(user as any)) {
      const userType = (user as any).type || 'user';
      logSecurityEvent({
        event: 'ADMIN_LOUNGE_CLIENT_ACCESS_DENIED',
        reason: 'User is not admin, lounge, or client',
        userId: String(user._id),
        userType,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
      return next(new HttpException(403, 'Admin, lounge, or client access required'));
    }

    return next();
  } catch (error) {
    logSecurityEvent({
      event: 'ADMIN_LOUNGE_CLIENT_ACCESS_DENIED',
      reason: `Unexpected error: ${error.message}`,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      path: req.path,
    });
    return next(new HttpException(403, 'Admin, lounge, or client access required'));
  }
};

export default adminOrLoungeOrClientMiddleware;
