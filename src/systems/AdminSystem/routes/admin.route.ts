import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import { createAdminUsersRouter } from '@systems/AdminSystem/routes/admin/users.route';
import { createAdminSystemRouter } from '@systems/AdminSystem/routes/admin/system.route';
import { createAdminModerationRouter } from '@systems/AdminSystem/routes/admin/moderation.route';
import { createAdminCatalogRouter } from '@systems/AdminSystem/routes/admin/catalog.route';

// Middlewares
import authMiddleware from '@middlewares/auth.middleware';
import { adminMiddleware } from '@middlewares/role.middleware';

class AdminRoute implements Routes {
  public path = '/v1/admin';
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // ── Global guard: every admin route requires auth + admin role ──
    this.router.use(authMiddleware, adminMiddleware);

    this.router.use(createAdminUsersRouter());
    this.router.use(createAdminSystemRouter());
    this.router.use(createAdminModerationRouter());
    this.router.use(createAdminCatalogRouter());
  }
}

export default AdminRoute;
