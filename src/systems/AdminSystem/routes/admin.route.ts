import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';

// Controllers
import UserManagementController from '@systems/UserManager/controllers/userManagement.controller';
import SystemServicesController from '@systems/AdminSystem/controllers/systemServices.controller';
import ContentModerationController from '@systems/FeedContentSystem/controllers/contentModeration.controller';
import CatalogManagementController from '@systems/ServiceCatalogSystem/controllers/catalogManagement.controller';

// DTOs
import { CreateUserDto, UpdateUserDto } from '@systems/UserManager/dtos/user.dto';
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from '@systems/ServiceCatalogSystem/dtos/serviceCategories.dto';
import { UpdateServiceSuggestionStatusDto, AdminApproveServiceSuggestionDto } from '@systems/ServiceCatalogSystem/dtos/serviceSuggestions.dto';
import { ReviewReportDto } from '@systems/FeedContentSystem/dtos/report.dto';

// Middlewares
import authMiddleware from '@middlewares/auth.middleware';
import { adminMiddleware } from '@middlewares/role.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';

class AdminRoute implements Routes {
  public path = '/v1/admin';
  public router = Router();

  private userCtrl = new UserManagementController();
  private systemCtrl = new SystemServicesController();
  private moderationCtrl = new ContentModerationController();
  private catalogCtrl = new CatalogManagementController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // ── Global guard: every admin route requires auth + admin role ──
    this.router.use(authMiddleware, adminMiddleware);

    // ═══════════════════════════════════════════════════════════════
    // USER MANAGEMENT — /v1/admin/users/*
    // ═══════════════════════════════════════════════════════════════
    this.router.get('/users', this.userCtrl.getUsers);
    this.router.get('/users/:id', this.userCtrl.getUserById);
    this.router.post('/users', csrfMiddleware, validationMiddleware(CreateUserDto, 'body'), this.userCtrl.createUser);
    this.router.put('/users/:id', csrfMiddleware, validationMiddleware(UpdateUserDto, 'body', true), this.userCtrl.updateUser);
    this.router.delete('/users/:id', csrfMiddleware, this.userCtrl.deleteUser);
    this.router.patch('/users/:id/block', csrfMiddleware, this.userCtrl.changeUserBlockedState);

    // Session info & lounge names
    this.router.get('/session-info', this.userCtrl.getOnlineUsers);
    this.router.get('/lounges/names', this.userCtrl.getAllLoungeNames);

    // ═══════════════════════════════════════════════════════════════
    // SYSTEM SERVICES — /v1/admin/system/*
    // ═══════════════════════════════════════════════════════════════
    this.router.get('/system/stats', this.systemCtrl.getAllAdminServices);
    this.router.get('/system/health', this.systemCtrl.getSystemHealth);
    this.router.get('/system/activity-log', this.systemCtrl.getUserActivityLog);
    this.router.get('/system/dashboard', this.systemCtrl.getDashboardStats);
    this.router.post('/system/users/:userId/clear-sessions', csrfMiddleware, this.systemCtrl.clearUserSessions);
    this.router.post('/system/users/:userId/reset-password', csrfMiddleware, this.systemCtrl.resetUserPassword);
    this.router.get('/system/users/:userId/export', this.systemCtrl.exportUserData);
    this.router.post('/system/audit-log', csrfMiddleware, this.systemCtrl.createAuditLog);

    // ═══════════════════════════════════════════════════════════════
    // CONTENT MODERATION — /v1/admin/moderation/*
    // ═══════════════════════════════════════════════════════════════

    // Posts
    this.router.put('/moderation/posts/:postId/hide', csrfMiddleware, this.moderationCtrl.hidePost);
    this.router.put('/moderation/posts/:postId/unhide', csrfMiddleware, this.moderationCtrl.unhidePost);
    this.router.delete('/moderation/posts/:postId', csrfMiddleware, this.moderationCtrl.adminDeletePost);

    // Reels
    this.router.put('/moderation/reels/:reelId/hide', csrfMiddleware, this.moderationCtrl.hideReel);
    this.router.put('/moderation/reels/:reelId/unhide', csrfMiddleware, this.moderationCtrl.unhideReel);
    this.router.delete('/moderation/reels/:reelId', csrfMiddleware, this.moderationCtrl.adminDeleteReel);

    // Comments
    this.router.put('/moderation/comments/:commentId/hide', csrfMiddleware, this.moderationCtrl.hideComment);
    this.router.put('/moderation/comments/:commentId/unhide', csrfMiddleware, this.moderationCtrl.unhideComment);
    this.router.delete('/moderation/comments/:commentId', csrfMiddleware, this.moderationCtrl.adminDeleteComment);

    // Reports
    this.router.get('/moderation/reports', this.moderationCtrl.getReports);
    this.router.put('/moderation/reports/:reportId', csrfMiddleware, validationMiddleware(ReviewReportDto, 'body'), this.moderationCtrl.reviewReport);

    // ═══════════════════════════════════════════════════════════════
    // CATALOG — SERVICES CRUD — /v1/admin/services/*
    // ═══════════════════════════════════════════════════════════════
    this.router.get('/services', this.catalogCtrl.getServicesPaginated);
    this.router.get('/services/search', this.catalogCtrl.searchServices);
    this.router.get('/services/category/:categoryId', this.catalogCtrl.getServicesByCategory);
    this.router.get('/services/:serviceId', this.catalogCtrl.getServiceById);
    this.router.post('/services', csrfMiddleware, this.catalogCtrl.createService);
    this.router.post('/services/bulk', csrfMiddleware, this.catalogCtrl.bulkCreateServices);
    this.router.put('/services/:serviceId', csrfMiddleware, this.catalogCtrl.updateService);
    this.router.delete('/services/:serviceId', csrfMiddleware, this.catalogCtrl.deleteService);

    // ═══════════════════════════════════════════════════════════════
    // CATALOG — SERVICE CATEGORIES CRUD — /v1/admin/service-categories/*
    // ═══════════════════════════════════════════════════════════════
    this.router.get('/service-categories', this.catalogCtrl.getAllServiceCategories);
    this.router.get('/service-categories/search', this.catalogCtrl.searchServiceCategories);
    this.router.get('/service-categories/:categoryId', this.catalogCtrl.getServiceCategoryById);
    this.router.post(
      '/service-categories',
      csrfMiddleware,
      validationMiddleware(CreateServiceCategoryDto, 'body'),
      this.catalogCtrl.createServiceCategory,
    );
    this.router.put(
      '/service-categories/:categoryId',
      csrfMiddleware,
      validationMiddleware(UpdateServiceCategoryDto, 'body'),
      this.catalogCtrl.updateServiceCategory,
    );
    this.router.delete('/service-categories/:categoryId', csrfMiddleware, this.catalogCtrl.deleteServiceCategory);

    // ═══════════════════════════════════════════════════════════════
    // CATALOG — SERVICE SUGGESTIONS (Admin Ops) — /v1/admin/suggestions/*
    // ═══════════════════════════════════════════════════════════════
    this.router.get('/suggestions/stats', this.catalogCtrl.getServiceSuggestionsStats);
    this.router.patch(
      '/suggestions/:suggestionId/status',
      csrfMiddleware,
      validationMiddleware(UpdateServiceSuggestionStatusDto, 'body'),
      this.catalogCtrl.updateServiceSuggestionStatus,
    );
    this.router.patch(
      '/suggestions/:suggestionId/approve',
      csrfMiddleware,
      validationMiddleware(AdminApproveServiceSuggestionDto, 'body'),
      this.catalogCtrl.adminUpdateServiceSuggestionStatus,
    );

    // ═══════════════════════════════════════════════════════════════
    // CATALOG — LOUNGE SERVICES (Admin Ops) — /v1/admin/lounge-services/*
    // ═══════════════════════════════════════════════════════════════
    this.router.get('/lounge-services', this.catalogCtrl.getLoungeServicesPaginated);
    this.router.post('/lounge-services/bulk', csrfMiddleware, this.catalogCtrl.bulkCreateLoungeServices);
    this.router.get('/lounge-services/search', this.catalogCtrl.searchLoungeServices);

    // ═══════════════════════════════════════════════════════════════
    // QUEUE — /v1/admin/queue/*
    // ═══════════════════════════════════════════════════════════════
    this.router.post('/queue/populate', csrfMiddleware, this.catalogCtrl.populateDailyQueues);
  }
}

export default AdminRoute;
