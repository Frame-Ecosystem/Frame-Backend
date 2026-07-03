import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import LoungeExtrasService from '@systems/ExtrasSystem/services/loungeExtras.service';
import { AdoptExtraDto, UpdateAdoptedExtraDto } from '@systems/ExtrasSystem/dtos/extras.dto';
import { assertLounge } from '@utils/validators';

class LoungeExtrasController {
  private loungeExtrasService = new LoungeExtrasService();

  public getByLounge = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.user._id.toString();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const { extras, total } = await this.loungeExtrasService.getByLounge(loungeId, page, limit);
      res.status(200).json({
        data: extras,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        message: 'Adopted extras retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public getAvailable = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.user._id.toString();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const { extras, total } = await this.loungeExtrasService.getAvailable(loungeId, page, limit);
      res.status(200).json({
        data: extras,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        message: 'Available extras retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public adopt = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.user._id.toString();
      const data: AdoptExtraDto = req.body;
      await assertLounge(loungeId);

      const adopted = await this.loungeExtrasService.adopt(loungeId, data);
      res.status(201).json({
        data: adopted,
        message: 'Extra adopted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.user._id.toString();
      const { adoptedId } = req.params;
      const data: UpdateAdoptedExtraDto = req.body;

      const updated = await this.loungeExtrasService.update(adoptedId, loungeId, data);
      res.status(200).json({
        data: updated,
        message: 'Adopted extra updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public remove = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.user._id.toString();
      const { adoptedId } = req.params;

      const deleted = await this.loungeExtrasService.remove(adoptedId, loungeId);
      res.status(200).json({
        data: deleted,
        message: 'Adopted extra removed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public toggle = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.user._id.toString();
      const { adoptedId } = req.params;

      const toggled = await this.loungeExtrasService.toggle(adoptedId, loungeId);
      res.status(200).json({
        data: toggled,
        message: `Adopted extra ${toggled.isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default LoungeExtrasController;
