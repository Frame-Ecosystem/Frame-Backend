import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import ExtrasService from '@systems/ExtrasSystem/services/extras.service';

class PublicExtrasController {
  private extrasService = new ExtrasService();

  public getAll = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filter: { category?: string; free?: boolean } = {};

      if (req.query.category) filter.category = req.query.category as string;
      if (req.query.free !== undefined) filter.free = req.query.free === 'true';

      const { extras, total } = await this.extrasService.getAll(page, limit, { ...filter });
      res.status(200).json({
        data: extras,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        message: 'Extras retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default PublicExtrasController;
