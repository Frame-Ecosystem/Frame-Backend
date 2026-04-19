import { Router } from 'express';
import AgentController from '@systems/UserManager/controllers/agent.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { adminOrLoungeMiddleware, adminOrLoungeOrClientMiddleware } from '@middlewares/role.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import upload, { optionalUpload } from '@middlewares/imageUpload.middleware';

class AgentRoute implements Routes {
  public path = '/v1/agents';
  public router = Router();
  public agentController = new AgentController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get('/', authMiddleware, adminOrLoungeOrClientMiddleware, this.agentController.getAllAgents);
    this.router.get('/:agentId', authMiddleware, adminOrLoungeOrClientMiddleware, this.agentController.getAgentById);

    this.router.post('/', authMiddleware, adminOrLoungeMiddleware, optionalUpload('image'), csrfMiddleware, this.agentController.createAgent);

    this.router.put('/:agentId', authMiddleware, adminOrLoungeMiddleware, csrfMiddleware, this.agentController.updateAgent);
    this.router.delete('/:agentId', authMiddleware, adminOrLoungeMiddleware, csrfMiddleware, this.agentController.deleteAgent);
    this.router.put('/:agentId/image', authMiddleware, adminOrLoungeMiddleware, upload.single('image'), this.agentController.uploadProfileImage);
  }
}

export default AgentRoute;
