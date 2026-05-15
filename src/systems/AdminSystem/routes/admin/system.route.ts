import { Router } from 'express';
import SystemServicesController from '@systems/AdminSystem/controllers/systemServices.controller';
import {
  AdminUserIdParamDto,
  CreateAuditLogDto,
  GetUserActivityLogQueryDto,
  ResetUserPasswordDto,
} from '@systems/AdminSystem/dtos/systemServices.dto';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';

export const createAdminSystemRouter = (): Router => {
  const router = Router();
  const systemCtrl = new SystemServicesController();

  router.get('/system/stats', systemCtrl.getAllAdminServices);
  router.get('/system/health', systemCtrl.getSystemHealth);
  router.get('/system/activity-log', validationMiddleware(GetUserActivityLogQueryDto, 'query'), systemCtrl.getUserActivityLog);
  router.get('/system/dashboard', systemCtrl.getDashboardStats);

  router.post(
    '/system/users/:userId/clear-sessions',
    csrfMiddleware,
    validationMiddleware(AdminUserIdParamDto, 'params'),
    systemCtrl.clearUserSessions,
  );

  router.post(
    '/system/users/:userId/reset-password',
    csrfMiddleware,
    validationMiddleware(AdminUserIdParamDto, 'params'),
    validationMiddleware(ResetUserPasswordDto, 'body'),
    systemCtrl.resetUserPassword,
  );

  router.get('/system/users/:userId/export', validationMiddleware(AdminUserIdParamDto, 'params'), systemCtrl.exportUserData);
  router.post('/system/audit-log', csrfMiddleware, validationMiddleware(CreateAuditLogDto, 'body'), systemCtrl.createAuditLog);

  return router;
};
