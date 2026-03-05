import { NextFunction, Request, Response } from 'express';
import QueueService from '@services/queue.service';
import { AddToQueueDto, UpdateQueuePersonDto } from '@dtos/queue.dto';

class QueueController {
  public queueService = new QueueService();

  /**
   * Get an agent's queue for today (or a specific date via query param)
   */
  public getQueueByAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const date = req.query.date ? new Date(req.query.date as string) : undefined;

      const queue = await this.queueService.getQueueByAgent(agentId, date);
      res.status(200).json({
        data: queue,
        message: 'Queue retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all queues for a lounge on a specific date (defaults to today)
   */
  public getQueuesByLounge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let loungeId = req.params.loungeId;
      if (!loungeId && req.user) {
        loungeId = (req.user as any)._id;
      }
      const date = req.query.date ? new Date(req.query.date as string) : undefined;

      const queues = await this.queueService.getQueuesByLounge(loungeId, date);
      res.status(200).json({
        data: queues,
        count: queues.length,
        message: 'Lounge queues retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Add a person (booking) to an agent's queue
   */
  public addPersonToQueue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const data: AddToQueueDto = {
        bookingId: req.body.bookingId,
        position: req.body.position,
      };

      const queue = await this.queueService.addPersonToQueue(agentId, data);
      res.status(201).json({
        data: queue,
        message: 'Person added to queue successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a person's status in the queue
   */
  public updatePersonStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId, bookingId } = req.params;
      const data: UpdateQueuePersonDto = {
        status: req.body.status,
      };

      const queue = await this.queueService.updatePersonStatus(agentId, bookingId, data);
      res.status(200).json({
        data: queue,
        message: 'Person status updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Remove a person from an agent's queue
   */
  public removePersonFromQueue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId, bookingId } = req.params;

      const queue = await this.queueService.removePersonFromQueue(agentId, bookingId);
      res.status(200).json({
        data: queue,
        message: 'Person removed from queue successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Trigger daily queue population (admin only)
   */
  public populateDailyQueues = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.queueService.populateDailyQueues();
      res.status(200).json({
        data: result,
        message: `Daily queues populated: ${result.processed} bookings processed`,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default QueueController;
