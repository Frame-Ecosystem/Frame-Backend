import { Router } from 'express';
import AgentController from '@systems/UserManager/controllers/agent.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import {
  adminOrLoungeMiddleware,
  adminOrLoungeOrClientMiddleware,
  agentMiddleware,
} from '@middlewares/role.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import upload, { optionalUpload } from '@middlewares/imageUpload.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import {
  UpdateAgentDto,
  UpdateAgentSelfDto,
  ToggleAvailabilityDto,
} from '@systems/UserManager/dtos/agent.dto';
import { ReorderQueuePersonDto } from '@systems/BookingSystem/dtos/queue.dto';

/**
 * /v1/agents
 *
 * Two surfaces are exposed under this base path:
 *   - Management routes (admin / lounge): create / read / update / delete agents
 *   - Self-service routes (`/me/*`, agent only): the authenticated agent
 *     manages their own profile, availability and live queue.
 *
 * IMPORTANT: the `/me/*` routes MUST be registered BEFORE `/:agentId` so
 * Express does not treat the literal "me" as an `agentId` parameter.
 */
class AgentRoute implements Routes {
  public path = '/v1/agents';
  public router = Router();
  public agentController = new AgentController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // \u2500\u2500\u2500 Self-service (must come first to avoid `:agentId` capturing "me") \u2500\u2500\u2500

    this.router.get('/me', authMiddleware, agentMiddleware, this.agentController.getMe);

    this.router.patch(
      '/me',
      authMiddleware,
      agentMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateAgentSelfDto, 'body', true),
      this.agentController.updateMe,
    );

    this.router.patch(
      '/me/availability',
      authMiddleware,
      agentMiddleware,
      csrfMiddleware,
      validationMiddleware(ToggleAvailabilityDto, 'body'),
      this.agentController.toggleAvailability,
    );

    this.router.put(
      '/me/image',
      authMiddleware,
      agentMiddleware,
      upload.single('image'),
      this.agentController.uploadOwnImage,
    );

    this.router.get('/me/queue', authMiddleware, agentMiddleware, this.agentController.getMyQueue);
    this.router.get('/me/queue/stats', authMiddleware, agentMiddleware, this.agentController.getMyQueueStats);

    this.router.post(
      '/me/queue/persons',
      authMiddleware,
      agentMiddleware,
      csrfMiddleware,
      this.agentController.addToMyQueue,
    );

    this.router.post(
      '/me/queue/next',
      authMiddleware,
      agentMiddleware,
      csrfMiddleware,
      this.agentController.callNextInQueue,
    );

    this.router.patch(
      '/me/queue/persons/:bookingId',
      authMiddleware,
      agentMiddleware,
      csrfMiddleware,
      this.agentController.updateMyQueuePersonStatus,
    );

    this.router.put(
      '/me/queue/persons/:bookingId/reorder',
      authMiddleware,
      agentMiddleware,
      csrfMiddleware,
      validationMiddleware(ReorderQueuePersonDto, 'body'),
      this.agentController.reorderMyQueuePerson,
    );

    this.router.delete(
      '/me/queue/persons/:bookingId',
      authMiddleware,
      agentMiddleware,
      csrfMiddleware,
      this.agentController.removeMyQueuePerson,
    );

    // \u2500\u2500\u2500 Admin / Lounge management \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    this.router.get('/', authMiddleware, adminOrLoungeOrClientMiddleware, this.agentController.getAllAgents);
    this.router.get('/:agentId', authMiddleware, adminOrLoungeOrClientMiddleware, this.agentController.getAgentById);

    this.router.post(
      '/',
      authMiddleware,
      adminOrLoungeMiddleware,
      optionalUpload('image'),
      csrfMiddleware,
      // NOTE: no validationMiddleware here \u2014 multipart form-data delivers `services`
      // as a JSON string; the controller normalises it before delegating to the
      // service, which performs full validation (existence, lounge ownership, etc.).
      this.agentController.createAgent,
    );

    this.router.put(
      '/:agentId',
      authMiddleware,
      adminOrLoungeMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateAgentDto, 'body', true),
      this.agentController.updateAgent,
    );
    this.router.delete('/:agentId', authMiddleware, adminOrLoungeMiddleware, csrfMiddleware, this.agentController.deleteAgent);
    this.router.put('/:agentId/image', authMiddleware, adminOrLoungeMiddleware, upload.single('image'), this.agentController.uploadProfileImage);
  }
}

export default AgentRoute;
