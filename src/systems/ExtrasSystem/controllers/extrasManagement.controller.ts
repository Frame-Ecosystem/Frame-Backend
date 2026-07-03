import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import ExtrasService from '@systems/ExtrasSystem/services/extras.service';
import { CreateExtraDto, UpdateExtraDto } from '@systems/ExtrasSystem/dtos/extras.dto';

class ExtrasManagementController {
  private extrasService = new ExtrasService();

  public getAll = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filter: { category?: string; free?: boolean } = {};

      if (req.query.category) filter.category = req.query.category as string;
      if (req.query.free !== undefined) filter.free = req.query.free === 'true';

      const { extras, total } = await this.extrasService.getAll(page, limit, filter);
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

  public getById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { extraId } = req.params;
      const extra = await this.extrasService.getById(extraId);
      res.status(200).json({
        data: extra,
        message: 'Extra retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public create = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const data: CreateExtraDto = req.body;
      const extra = await this.extrasService.create(data, req.user._id.toString());
      res.status(201).json({
        data: extra,
        message: 'Extra created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { extraId } = req.params;
      const data: UpdateExtraDto = req.body;
      const extra = await this.extrasService.update(extraId, data);
      res.status(200).json({
        data: extra,
        message: 'Extra updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { extraId } = req.params;
      const extra = await this.extrasService.delete(extraId);
      res.status(200).json({
        data: extra,
        message: 'Extra deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default ExtrasManagementController;
