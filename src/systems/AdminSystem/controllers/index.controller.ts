import { NextFunction, Request, Response } from 'express';
import { SERVICE_NAME, SERVICE_BRAND, SERVICE_DESCRIPTION, SERVICE_VERSION } from '@config/constants';

class IndexController {
  public index = (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({
        service: SERVICE_NAME,
        brand: SERVICE_BRAND,
        description: SERVICE_DESCRIPTION,
        version: SERVICE_VERSION,
        status: 'operational',
        documentation: '/api-docs',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default IndexController;
