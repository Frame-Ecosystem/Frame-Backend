import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { loungeMiddleware, agentMiddleware } from '@middlewares/role.middleware';
import LoungeController from '@systems/ServiceCatalogSystem/controllers/lounge.controller';

class LoungeRoute implements Routes {
  public path = '/v1/lounge';
  public router = Router();
  public loungeController = new LoungeController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get('/clients/:clientId', authMiddleware, loungeMiddleware, this.loungeController.getClientById);
    this.router.patch('/agents/:agentId/queue-booking', authMiddleware, loungeMiddleware, this.loungeController.updateAgentQueueBooking);
    this.router.patch('/me/queue-booking', authMiddleware, agentMiddleware, this.loungeController.updateMyQueueBooking);
  }
}

export default LoungeRoute;
