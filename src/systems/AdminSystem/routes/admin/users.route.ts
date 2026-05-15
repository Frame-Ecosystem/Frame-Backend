import { Router } from 'express';
import UserManagementController from '@systems/UserManager/controllers/userManagement.controller';
import { CreateUserDto, UpdateUserDto } from '@systems/UserManager/dtos/user.dto';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';

export const createAdminUsersRouter = (): Router => {
  const router = Router();
  const userCtrl = new UserManagementController();

  router
    .route('/users')
    .get(userCtrl.getUsers)
    .post(csrfMiddleware, validationMiddleware(CreateUserDto, 'body'), userCtrl.createUser);

  router
    .route('/users/:id')
    .get(userCtrl.getUserById)
    .put(csrfMiddleware, validationMiddleware(UpdateUserDto, 'body', true), userCtrl.updateUser)
    .delete(csrfMiddleware, userCtrl.deleteUser);

  router.patch('/users/:id/block', csrfMiddleware, userCtrl.changeUserBlockedState);
  router.get('/session-info', userCtrl.getOnlineUsers);
  router.get('/lounges/names', userCtrl.getAllLoungeNames);

  return router;
};
