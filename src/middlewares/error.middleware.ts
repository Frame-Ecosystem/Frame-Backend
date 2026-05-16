import { NextFunction, Request, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';
import { SERVICE_NAME } from '@config/constants';

const normalizeError = (error: any): HttpException => {
  if (error instanceof HttpException) return error;

  if (error?.name === 'MulterError') {
    return new HttpException(400, error.message || 'Invalid upload payload', error.code || 'UPLOAD_ERROR');
  }

  if (error instanceof Error) {
    return new HttpException(500, error.message || 'Something went wrong', 'INTERNAL_ERROR');
  }

  return new HttpException(500, 'Something went wrong', 'INTERNAL_ERROR');
};

const errorMiddleware = (error: HttpException, req: Request, res: Response, next: NextFunction) => {
  try {
    const normalized = normalizeError(error);
    const status: number = normalized.status || 500;
    const message: string = normalized.message || 'Something went wrong';
    const code: string | undefined = normalized.code;
    const codePart = code ? `, Code:: ${code}` : '';

    logger.error(`[${req.method}] ${req.path} >> StatusCode:: ${status}, Message:: ${message}${codePart}`);

    res.status(status).json({
      status,
      message,
      ...(code && { code }),
      service: SERVICE_NAME,
    });
  } catch (err) {
    next(err);
  }
};

export default errorMiddleware;
