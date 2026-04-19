import { Router } from 'express';
import LoungeServicesController from '@controllers/lounge/loungeServices.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { CreateLoungeServiceDto, UpdateLoungeServiceDto } from '@dtos/lounge/loungeServices.dto';
import { DayOpeningHoursDto, UpdateLoungeProfileDto } from '@dtos/user/user.dto';
import { optionalUpload } from '@middlewares/imageUpload.middleware';

class LoungeServicesRoute implements Routes {
  public path = '/v1/lounge-services';
  public router = Router();
  public loungeServicesController = new LoungeServicesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get('/', authMiddleware, this.loungeServicesController.getAllLoungeServices);
    this.router.get('/search', authMiddleware, this.loungeServicesController.searchLoungeServices);
    this.router.get('/lounge/:loungeId', authMiddleware, this.loungeServicesController.getLoungeServicesByLoungeId);
    this.router.get('/:serviceId', authMiddleware, this.loungeServicesController.getLoungeServiceById);
    this.router.get('/service-name/:serviceId', authMiddleware, this.loungeServicesController.getServiceNameById);

    this.router.post(
      '/',
      authMiddleware,
      optionalUpload('image'),
      csrfMiddleware,
      validationMiddleware(CreateLoungeServiceDto, 'body'),
      this.loungeServicesController.createLoungeService,
    );

    this.router.post('/bulk', authMiddleware, csrfMiddleware, this.loungeServicesController.bulkCreateLoungeServices);

    this.router.put(
      '/:serviceId',
      authMiddleware,
      optionalUpload('image'),
      csrfMiddleware,
      validationMiddleware(UpdateLoungeServiceDto, 'body'),
      this.loungeServicesController.updateLoungeService,
    );

    this.router.delete('/:serviceId', authMiddleware, csrfMiddleware, this.loungeServicesController.deleteLoungeService);
    this.router.patch('/:serviceId/toggle-status', authMiddleware, csrfMiddleware, this.loungeServicesController.toggleLoungeServiceStatus);

    this.router.patch(
      '/lounge/:loungeId/opening-hours',
      authMiddleware,
      csrfMiddleware,
      validationMiddleware(DayOpeningHoursDto, 'body', true),
      this.loungeServicesController.patchLoungeOpeningHours,
    );

    this.router.put(
      '/lounge/:loungeId/profile',
      authMiddleware,
      validationMiddleware(UpdateLoungeProfileDto, 'body', true),
      this.loungeServicesController.updateLoungeProfile,
    );

    // GET - Get agents for a specific lounge
    this.router.get('/lounge/:loungeId/agents', authMiddleware, this.loungeServicesController.getAgentsPerLounge);
  }
}

export default LoungeServicesRoute;
