import { Router } from 'express';
import LoungeServicesController from '@controllers/loungeServices.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { CreateLoungeServiceDto, UpdateLoungeServiceDto } from '@dtos/loungeServices.dto';

class LoungeServicesRoute implements Routes {
  public path = '/v1/lounge-services';
  public router = Router();
  public loungeServicesController = new LoungeServicesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // GET - Get all lounge services with pagination
    this.router.get('/', authMiddleware, this.loungeServicesController.getAllLoungeServices);

    // GET - Search lounge services
    this.router.get('/search', authMiddleware, this.loungeServicesController.searchLoungeServices);

    // GET - Get lounge services by lounge ID
    this.router.get('/lounge/:loungeId', authMiddleware, this.loungeServicesController.getLoungeServicesByLoungeId);

    // GET - Get lounge service by ID
    this.router.get('/:serviceId', authMiddleware, this.loungeServicesController.getLoungeServiceById);

    // POST - Create a new lounge service
    this.router.post(
      '/',
      authMiddleware,
      csrfMiddleware,
      validationMiddleware(CreateLoungeServiceDto, 'body'),
      this.loungeServicesController.createLoungeService,
    );

    // POST - Bulk create lounge services
    this.router.post('/bulk', authMiddleware, csrfMiddleware, this.loungeServicesController.bulkCreateLoungeServices);

    // PUT - Update lounge service
    this.router.put(
      '/:serviceId',
      authMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateLoungeServiceDto, 'body'),
      this.loungeServicesController.updateLoungeService,
    );

    // DELETE - Delete lounge service
    this.router.delete('/:serviceId', authMiddleware, csrfMiddleware, this.loungeServicesController.deleteLoungeService);

    // PATCH - Toggle lounge service active status
    this.router.patch('/:serviceId/toggle-status', authMiddleware, csrfMiddleware, this.loungeServicesController.toggleLoungeServiceStatus);
  }
}

export default LoungeServicesRoute;
