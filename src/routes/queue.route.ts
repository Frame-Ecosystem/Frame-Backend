import { Router } from 'express';
import QueueController from '@controllers/queue.controller';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import { adminOrLoungeMiddleware, adminOrLoungeOrClientMiddleware, adminMiddleware } from '@middlewares/role.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { ReorderQueuePersonDto } from '@dtos/queue.dto';

class QueueRoute implements Routes {
  public path = '/v1/queues';
  public router = Router();
  public queueController = new QueueController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // GET - Get an agent's queue for today (or ?date=YYYY-MM-DD)
    this.router.get('/agent/:agentId', authMiddleware, adminOrLoungeOrClientMiddleware, this.queueController.getQueueByAgent);

    // GET - Get all queues for a lounge (or ?date=YYYY-MM-DD)
    this.router.get('/lounge/:loungeId', authMiddleware, adminOrLoungeOrClientMiddleware, this.queueController.getQueuesByLounge);

    // GET - Get all queues for the authenticated lounge
    this.router.get('/lounge', authMiddleware, adminOrLoungeOrClientMiddleware, this.queueController.getQueuesByLounge);

    // POST - Add a person (booking) to an agent's queue
    this.router.post('/agent/:agentId/persons', authMiddleware, adminOrLoungeMiddleware, csrfMiddleware, this.queueController.addPersonToQueue);

    // PUT - Update a person's status in the queue
    this.router.put(
      '/agent/:agentId/persons/:bookingId',
      authMiddleware,
      adminOrLoungeMiddleware,
      csrfMiddleware,
      this.queueController.updatePersonStatus,
    );

    // PUT - Reorder a person's position in the queue (real-time)
    this.router.put(
      '/agent/:agentId/persons/:bookingId/reorder',
      authMiddleware,
      adminOrLoungeMiddleware,
      csrfMiddleware,
      validationMiddleware(ReorderQueuePersonDto, 'body'),
      this.queueController.reorderPerson,
    );

    // DELETE - Remove a person from an agent's queue
    this.router.delete(
      '/agent/:agentId/persons/:bookingId',
      authMiddleware,
      adminOrLoungeMiddleware,
      csrfMiddleware,
      this.queueController.removePersonFromQueue,
    );

    // POST - Trigger daily queue population (admin only)
    this.router.post('/populate', authMiddleware, adminMiddleware, csrfMiddleware, this.queueController.populateDailyQueues);
  }
}

export default QueueRoute;
