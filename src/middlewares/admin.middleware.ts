import { NextFunction, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import { RequestWithUser } from '@interfaces/auth.interface';
import { UserRole } from '@dtos/users.dto';
import { logSecurityEvent } from '@utils/logger';

/**
 * Admin Authorization Middleware
 * Must be used AFTER authMiddleware (requires req.user to be set)
 * Checks if the authenticated user has admin role
 */
const adminMiddleware = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      logSecurityEvent({
        event: 'ADMIN_ACCESS_DENIED',
        reason: 'No user found in request (authMiddleware not applied?)',
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
      return next(new HttpException(401, 'Authentication required'));
    }

    if (user.role !== UserRole.ADMIN) {
      logSecurityEvent({
        event: 'ADMIN_ACCESS_DENIED',
        reason: 'User does not have admin role',
        userId: String(user._id),
        userRole: user.role,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
      return next(new HttpException(403, 'Admin access required'));
    }

    return next();
  } catch (error) {
    logSecurityEvent({
      event: 'ADMIN_ACCESS_DENIED',
      reason: `Unexpected error: ${error.message}`,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      path: req.path,
    });
    return next(new HttpException(403, 'Admin access required'));
  }
};

export default adminMiddleware;
