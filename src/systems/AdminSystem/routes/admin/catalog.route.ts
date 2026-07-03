import { Router } from 'express';
import CatalogManagementController from '@systems/ServiceCatalogSystem/controllers/catalogManagement.controller';
import ExtrasManagementController from '@systems/ExtrasSystem/controllers/extrasManagement.controller';
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from '@systems/ServiceCatalogSystem/dtos/serviceCategories.dto';
import { UpdateServiceSuggestionStatusDto, AdminApproveServiceSuggestionDto } from '@systems/ServiceCatalogSystem/dtos/serviceSuggestions.dto';
import { CreateExtraDto, UpdateExtraDto } from '@systems/ExtrasSystem/dtos/extras.dto';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';

export const createAdminCatalogRouter = (): Router => {
  const router = Router();
  const catalogCtrl = new CatalogManagementController();
  const extrasCtrl = new ExtrasManagementController();

  router.get('/services', catalogCtrl.getServicesPaginated);
  router.get('/services/search', catalogCtrl.searchServices);
  router.get('/services/category/:categoryId', catalogCtrl.getServicesByCategory);
  router.get('/services/:serviceId', catalogCtrl.getServiceById);
  router.post('/services', csrfMiddleware, catalogCtrl.createService);
  router.post('/services/bulk', csrfMiddleware, catalogCtrl.bulkCreateServices);
  router.put('/services/:serviceId', csrfMiddleware, catalogCtrl.updateService);
  router.delete('/services/:serviceId', csrfMiddleware, catalogCtrl.deleteService);

  router.get('/service-categories', catalogCtrl.getAllServiceCategories);
  router.get('/service-categories/search', catalogCtrl.searchServiceCategories);
  router.get('/service-categories/:categoryId', catalogCtrl.getServiceCategoryById);
  router.post('/service-categories', csrfMiddleware, validationMiddleware(CreateServiceCategoryDto, 'body'), catalogCtrl.createServiceCategory);
  router.put('/service-categories/:categoryId', csrfMiddleware, validationMiddleware(UpdateServiceCategoryDto, 'body'), catalogCtrl.updateServiceCategory);
  router.delete('/service-categories/:categoryId', csrfMiddleware, catalogCtrl.deleteServiceCategory);

  router.get('/suggestions/stats', catalogCtrl.getServiceSuggestionsStats);
  router.patch(
    '/suggestions/:suggestionId/status',
    csrfMiddleware,
    validationMiddleware(UpdateServiceSuggestionStatusDto, 'body'),
    catalogCtrl.updateServiceSuggestionStatus,
  );
  router.patch(
    '/suggestions/:suggestionId/approve',
    csrfMiddleware,
    validationMiddleware(AdminApproveServiceSuggestionDto, 'body'),
    catalogCtrl.adminUpdateServiceSuggestionStatus,
  );

  router.get('/lounge-services', catalogCtrl.getLoungeServicesPaginated);
  router.post('/lounge-services/bulk', csrfMiddleware, catalogCtrl.bulkCreateLoungeServices);
  router.get('/lounge-services/search', catalogCtrl.searchLoungeServices);

  router.post('/queue/populate', csrfMiddleware, catalogCtrl.populateDailyQueues);

  router.get('/extras', extrasCtrl.getAll);
  router.get('/extras/:extraId', extrasCtrl.getById);
  router.post('/extras', csrfMiddleware, validationMiddleware(CreateExtraDto, 'body'), extrasCtrl.create);
  router.put('/extras/:extraId', csrfMiddleware, validationMiddleware(UpdateExtraDto, 'body', true), extrasCtrl.update);
  router.delete('/extras/:extraId', csrfMiddleware, extrasCtrl.delete);

  return router;
};
