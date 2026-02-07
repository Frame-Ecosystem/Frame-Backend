import { NextFunction, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import { RequestWithUser } from '@interfaces/auth.interface';
import { isAdmin, isLounge } from '@models/users.model';
import { logSecurityEvent } from '@utils/logger';

/**
 * Admin or Lounge Authorization Middleware
 * Must be used AFTER authMiddleware (requires req.user to be set)
 * Checks if the authenticated user is either an Admin or a Lounge using inheritance/discriminator
 */
const adminOrLoungeMiddleware = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      logSecurityEvent({
        event: 'ADMIN_LOUNGE_ACCESS_DENIED',
        reason: 'No user found in request (authMiddleware not applied?)',
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
      return next(new HttpException(401, 'Authentication required'));
    }

    // Check if user is Admin or Lounge using the helper functions
    if (!isAdmin(user as any) && !isLounge(user as any)) {
      const userType = (user as any).type || 'user';
      logSecurityEvent({
        event: 'ADMIN_LOUNGE_ACCESS_DENIED',
        reason: 'User is neither admin nor lounge',
        userId: String(user._id),
        userType,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
      return next(new HttpException(403, 'Admin or lounge access required'));
    }

    return next();
  } catch (error) {
    logSecurityEvent({
      event: 'ADMIN_LOUNGE_ACCESS_DENIED',
      reason: `Unexpected error: ${error.message}`,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      path: req.path,
    });
    return next(new HttpException(403, 'Admin or lounge access required'));
  }
};

export default adminOrLoungeMiddleware;
