import { Router } from 'express';
import LoungeExtrasController from '@systems/ExtrasSystem/controllers/loungeExtras.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { loungeMiddleware } from '@middlewares/role.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { AdoptExtraDto, UpdateAdoptedExtraDto } from '@systems/ExtrasSystem/dtos/extras.dto';

class LoungeExtraRoute implements Routes {
  public path = '/v1/lounge-extras';
  public router = Router();
  public loungeExtrasController = new LoungeExtrasController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get('/', authMiddleware, this.loungeExtrasController.getByLounge);
    this.router.get('/available', authMiddleware, this.loungeExtrasController.getAvailable);

    this.router.post(
      '/',
      authMiddleware,
      loungeMiddleware,
      csrfMiddleware,
      validationMiddleware(AdoptExtraDto, 'body'),
      this.loungeExtrasController.adopt,
    );

    this.router.put(
      '/:adoptedId',
      authMiddleware,
      loungeMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateAdoptedExtraDto, 'body'),
      this.loungeExtrasController.update,
    );

    this.router.delete('/:adoptedId', authMiddleware, loungeMiddleware, csrfMiddleware, this.loungeExtrasController.remove);
    this.router.patch('/:adoptedId/toggle', authMiddleware, loungeMiddleware, csrfMiddleware, this.loungeExtrasController.toggle);
  }
}

export default LoungeExtraRoute;
