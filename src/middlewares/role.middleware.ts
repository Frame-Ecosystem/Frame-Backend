import { NextFunction, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import { RequestWithUser } from '@interfaces/auth.interface';
import { isAdmin, isLounge, isClient } from '@models/users.model';
import { logSecurityEvent, SecurityEventType } from '@utils/logger';

type RoleChecker = (user: any) => boolean;

interface RoleConfig {
  checkers: RoleChecker[];
  eventName: SecurityEventType;
  accessLabel: string;
}

const ROLE_MAP: Record<string, RoleChecker> = {
  admin: isAdmin,
  lounge: isLounge,
  client: isClient,
};

/** Map of role-combo key to its typed security event name */
const EVENT_MAP: Record<string, SecurityEventType> = {
  ADMIN: 'ADMIN_ACCESS_DENIED',
  LOUNGE: 'LOUNGE_ACCESS_DENIED',
  CLIENT: 'CLIENT_ACCESS_DENIED',
  ADMIN_LOUNGE: 'ADMIN_LOUNGE_ACCESS_DENIED',
  ADMIN_LOUNGE_CLIENT: 'ADMIN_LOUNGE_CLIENT_ACCESS_DENIED',
  CLIENT_ADMIN: 'CLIENT_ADMIN_ACCESS_DENIED',
};

/**
 * Factory function to create role-based authorization middleware.
 * Must be used AFTER authMiddleware (requires req.user to be set).
 *
 * @param allowedRoles - Array of allowed role names: 'admin', 'lounge', 'client'
 * @returns Express middleware that checks if the user has one of the allowed roles
 *
 * @example
 * requireRoles('admin')
 * requireRoles('admin', 'lounge')
 * requireRoles('admin', 'lounge', 'client')
 */
export function requireRoles(...allowedRoles: string[]) {
  const config = buildRoleConfig(allowedRoles);

  return async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        logSecurityEvent({
          event: config.eventName,
          reason: 'No user found in request (authMiddleware not applied?)',
          ip: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          path: req.path,
          method: req.method,
        });
        return next(new HttpException(401, 'Authentication required'));
      }

      const hasRole = config.checkers.some(check => check(user as any));
      if (!hasRole) {
        const userType = (user as any).type || 'user';
        logSecurityEvent({
          event: config.eventName,
          reason: `User does not have required role(s): ${config.accessLabel}`,
          userId: String(user._id),
          userType,
          ip: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          path: req.path,
          method: req.method,
        });
        return next(new HttpException(403, `${config.accessLabel} access required`));
      }

      return next();
    } catch (error) {
      logSecurityEvent({
        event: config.eventName,
        reason: `Unexpected error: ${error.message}`,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        path: req.path,
      });
      return next(new HttpException(403, `${config.accessLabel} access required`));
    }
  };
}

function buildRoleConfig(roles: string[]): RoleConfig {
  const checkers = roles.map(role => {
    const checker = ROLE_MAP[role];
    if (!checker) throw new Error(`Unknown role: ${role}`);
    return checker;
  });

  const eventKey = roles.map(r => r.toUpperCase()).join('_');
  const eventName = EVENT_MAP[eventKey];
  if (!eventName) throw new Error(`No security event mapped for role combination: ${eventKey}`);

  const accessLabel = roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' or ');

  return { checkers, eventName, accessLabel };
}

// Pre-built middleware instances for common role combinations
const adminMiddleware = requireRoles('admin');
const loungeMiddleware = requireRoles('lounge');
const clientMiddleware = requireRoles('client');
const adminOrLoungeMiddleware = requireRoles('admin', 'lounge');
const adminOrLoungeOrClientMiddleware = requireRoles('admin', 'lounge', 'client');
const clientOrAdminMiddleware = requireRoles('client', 'admin');

export { adminMiddleware, loungeMiddleware, clientMiddleware, adminOrLoungeMiddleware, adminOrLoungeOrClientMiddleware, clientOrAdminMiddleware };
