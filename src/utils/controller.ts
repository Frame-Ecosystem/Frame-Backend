import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import { logger } from '@utils/logger';

type AsyncControllerFn = (req: RequestWithUser, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wraps an async controller handler so thrown errors are forwarded to the Express error handler.
 * Eliminates repetitive try/catch + logger.error + next(error) in every controller method.
 *
 * @param actionName  Label for log messages (e.g. "toggleLike", "createPost")
 *
 * @example
 *   public toggleLike = asyncHandler(async (req, res) => {
 *     const result = await this.likeService.toggleLike(userId, targetId);
 *     res.json({ success: true, data: result });
 *   }, 'toggleLike');
 */
export function asyncHandler(fn: AsyncControllerFn, actionName?: string) {
  const label = actionName || fn.name || 'handler';
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error in ${label}: ${message}`);
      next(error);
    });
  };
}
