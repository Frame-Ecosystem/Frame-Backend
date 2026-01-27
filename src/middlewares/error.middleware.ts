import { NextFunction, Request, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';

const errorMiddleware = (error: HttpException, req: Request, res: Response, next: NextFunction) => {
  try {
    const status: number = error.status || 500;
    const message: string = error.message || 'Something went wrong';
    const code: string | undefined = error.code;

    logger.error(`[${req.method}] ${req.path} >> StatusCode:: ${status}, Message:: ${message}${code ? `, Code:: ${code}` : ''}`);
    res.status(status).json({
      message,
      ...(code && { code }), // Include error code if available
    });
  } catch (error) {
    next(error);
  }
};

export default errorMiddleware;
