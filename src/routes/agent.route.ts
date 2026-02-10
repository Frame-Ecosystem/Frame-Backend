import { Router } from 'express';
import AgentController from '@controllers/agent.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import adminOrLoungeMiddleware from '@middlewares/adminOrLounge.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import upload from '@middlewares/image-upload.middleware';

class AgentRoute implements Routes {
  public path = '/v1/agents';
  public router = Router();
  public agentController = new AgentController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // GET - Get all agents (filtered by user type: admin sees all, lounge sees their own)
    this.router.get('/', authMiddleware, adminOrLoungeMiddleware, this.agentController.getAllAgents);

    // GET - Get agent by ID
    this.router.get('/:agentId', authMiddleware, adminOrLoungeMiddleware, this.agentController.getAgentById);

    // POST - Create a new agent (supports both file upload and base64 image)
    this.router.post(
      '/',
      authMiddleware,
      adminOrLoungeMiddleware,
      (req, res, next) => {
        // Check if this is a multipart request (file upload) or JSON request (base64)
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
          upload.single('image')(req, res, next);
        } else {
          next();
        }
      },
      csrfMiddleware,
      this.agentController.createAgent,
    );

    // PUT - Update agent
    this.router.put('/:agentId', authMiddleware, adminOrLoungeMiddleware, csrfMiddleware, this.agentController.updateAgent);

    // DELETE - Delete agent
    this.router.delete('/:agentId', authMiddleware, adminOrLoungeMiddleware, csrfMiddleware, this.agentController.deleteAgent);

    // PUT - Upload profile image for agent
    this.router.put('/:agentId/image', authMiddleware, adminOrLoungeMiddleware, upload.single('image'), this.agentController.uploadProfileImage);
  }
}

export default AgentRoute;
