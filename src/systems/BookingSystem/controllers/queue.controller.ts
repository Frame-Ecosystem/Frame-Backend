import { NextFunction, Request, Response } from 'express';
import QueueService from '@systems/BookingSystem/services/queue.service';
import { AddToQueueDto, UpdateQueuePersonDto, ReorderQueuePersonDto } from '@systems/BookingSystem/dtos/queue.dto';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';

class QueueController {
  private queueService = new QueueService();

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
  public getQueuesByLounge = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      let loungeId = req.params.loungeId;
      if (!loungeId && req.user) {
        loungeId = req.user._id.toString();
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
  public addPersonToQueue = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      await this.queueService.assertQueueMutationAccess(req.user._id.toString(), req.user.type, agentId);
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
  public updatePersonStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { agentId, bookingId } = req.params;
      await this.queueService.assertQueueMutationAccess(req.user._id.toString(), req.user.type, agentId);
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
  public removePersonFromQueue = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { agentId, bookingId } = req.params;
      await this.queueService.assertQueueMutationAccess(req.user._id.toString(), req.user.type, agentId);
      const markAbsent = req.query.markAbsent === 'true';

      const queue = await this.queueService.removePersonFromQueue(agentId, bookingId, markAbsent);
      res.status(200).json({
        data: queue,
        message: markAbsent ? 'Person removed and marked absent' : 'Person removed from queue successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reorder a person's position in the queue
   */
  public reorderPerson = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { agentId, bookingId } = req.params;
      await this.queueService.assertQueueMutationAccess(req.user._id.toString(), req.user.type, agentId);
      const data: ReorderQueuePersonDto = {
        newPosition: req.body.newPosition,
      };

      const queue = await this.queueService.reorderPerson(agentId, bookingId, data);
      res.status(200).json({
        data: queue,
        message: 'Queue person reordered successfully',
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
