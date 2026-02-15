import { Router } from 'express';
import LoungeServicesController from '@controllers/loungeServices.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { CreateLoungeServiceDto, UpdateLoungeServiceDto } from '@dtos/loungeServices.dto';
import { DayOpeningHoursDto, UpdateLoungeProfileDto } from '@dtos/users.dto';
import upload from '@middlewares/image-upload.middleware';

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

    // GET - Get service name by service ID
    this.router.get('/service-name/:serviceId', authMiddleware, this.loungeServicesController.getServiceNameById);

    // POST - Create a new lounge service (supports both file upload and base64 image)
    this.router.post(
      '/',
      authMiddleware,
      (req, res, next) => {
        // Check if this is a multipart request (file upload) or JSON request (base64)
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
          upload.single('image')(req, res, next);
        } else {
          next();
        }
      },
      csrfMiddleware,
      validationMiddleware(CreateLoungeServiceDto, 'body'),
      this.loungeServicesController.createLoungeService,
    );

    // POST - Bulk create lounge services
    this.router.post('/bulk', authMiddleware, csrfMiddleware, this.loungeServicesController.bulkCreateLoungeServices);

    // PUT - Update lounge service (supports both file upload and base64 image)
    this.router.put(
      '/:serviceId',
      authMiddleware,
      (req, res, next) => {
        // Check if this is a multipart request (file upload) or JSON request (base64)
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
          upload.single('image')(req, res, next);
        } else {
          next();
        }
      },
      csrfMiddleware,
      validationMiddleware(UpdateLoungeServiceDto, 'body'),
      this.loungeServicesController.updateLoungeService,
    );

    // DELETE - Delete lounge service
    this.router.delete('/:serviceId', authMiddleware, csrfMiddleware, this.loungeServicesController.deleteLoungeService);

    // PATCH - Toggle lounge service active status
    this.router.patch('/:serviceId/toggle-status', authMiddleware, csrfMiddleware, this.loungeServicesController.toggleLoungeServiceStatus);

    // PATCH - Update lounge opening hours
    this.router.patch(
      '/lounge/:loungeId/opening-hours',
      authMiddleware,
      csrfMiddleware,
      validationMiddleware(DayOpeningHoursDto, 'body', true),
      this.loungeServicesController.patchLoungeOpeningHours,
    );

    // PUT - Update lounge profile (title and opening hours)
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
