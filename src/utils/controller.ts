import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import { logger } from '@utils/logger';

/**
 * Wraps an async controller handler so thrown errors are forwarded to the Express error handler.
 * Eliminates repetitive try/catch + logger.error + next(error) in every controller method.
 *
 * @example
 *   public toggleLike = asyncHandler(async (req, res) => {
 *     const result = await this.likeService.toggleLike(userId, targetId);
 *     res.json({ success: true, data: result });
 *   });
 */
export function asyncHandler(
  fn: (req: RequestWithUser, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((error: any) => {
      const action = fn.name || 'controller';
      logger.error(`Error in ${action}: ${error.message}`);
      next(error);
    });
  };
}
