import { NextFunction, Response } from 'express';
import AgentService from '@systems/UserManager/services/agent.service';
import {
  CreateAgentDto,
  UpdateAgentDto,
  UpdateAgentSelfDto,
  ToggleAvailabilityDto,
} from '@systems/UserManager/dtos/agent.dto';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import QueueService from '@systems/BookingSystem/services/queue.service';
import { AddToQueueDto, UpdateQueuePersonDto, ReorderQueuePersonDto } from '@systems/BookingSystem/dtos/queue.dto';
import { QueuePersonStatus } from '@systems/BookingSystem/interfaces/queue.interface';
import { BadRequestException } from '@exceptions/HttpException';

/**
 * AgentController exposes two surfaces:
 *
 *   1. **Admin / Lounge management** \u2014 routes mounted at `/v1/agents/*`
 *      letting an Admin or owning Lounge create / list / update / delete agents.
 *
 *   2. **Agent self-service** \u2014 routes mounted at `/v1/agents/me/*` letting
 *      the authenticated agent manage their own profile, availability and
 *      live queue.
 */
class AgentController {
  public agentService = new AgentService();
  private queueService = new QueueService();

  /** If the caller is a Lounge, return their id so the service can scope by it. */
  private getLoungeOwnership(req: RequestWithUser): string | undefined {
    const user = req.user;
    return user?.type === 'lounge' ? String(user._id) : undefined;
  }

  /** Reject if the authenticated user is not an agent. */
  private getAgentSelfId(req: RequestWithUser): string {
    if (req.user?.type !== 'agent') {
      throw new BadRequestException('Only agents may access this endpoint', 'NOT_AN_AGENT');
    }
    return String(req.user._id);
  }

  // \u2500\u2500\u2500 Admin / Lounge surface \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  public createAgent = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const data: CreateAgentDto = {
        email: req.body.email,
        password: req.body.password,
        agentName: req.body.agentName,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phoneNumber: req.body.phoneNumber,
        parentLounge: req.body.parentLounge,
        services: Array.isArray(req.body.services)
          ? req.body.services
          : typeof req.body.services === 'string'
            ? JSON.parse(req.body.services)
            : [],
        isBlocked: req.body.isBlocked === 'true' || req.body.isBlocked === true,
        acceptQueueBooking: req.body.acceptQueueBooking === 'true' || req.body.acceptQueueBooking === true,
        profileImage: req.body.profileImage,
      };

      // Lounges always create agents under themselves
      if (req.user?.type === 'lounge') {
        data.parentLounge = String(req.user._id);
      }

      const agent = await this.agentService.createAgent(data, req.file);
      res.status(201).json({ data: agent, message: 'Agent created successfully' });
    } catch (error) {
      next(error);
    }
  };

  public getAgentsByLounge = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.params.loungeId || req.user?._id?.toString();
      const agents = await this.agentService.getAgentsByLounge(loungeId);
      res.status(200).json({ data: agents, count: agents.length, message: 'Agents retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public getAgentById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agent = await this.agentService.getAgentById(req.params.agentId, this.getLoungeOwnership(req));
      res.status(200).json({ data: agent, message: 'Agent retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateAgent = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agent = await this.agentService.updateAgent(req.params.agentId, req.body as UpdateAgentDto, this.getLoungeOwnership(req));
      res.status(200).json({ data: agent, message: 'Agent updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  public deleteAgent = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      await this.agentService.deleteAgent(req.params.agentId, this.getLoungeOwnership(req));
      res.status(200).json({ message: 'Agent deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  public getAllAgents = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agents = await this.agentService.getAllAgents(req.user);
      res.status(200).json({ data: agents, count: agents.length, message: 'Agents retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public uploadProfileImage = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No image file provided' });
      const agent = await this.agentService.uploadProfileImage(req.params.agentId, req.file, this.getLoungeOwnership(req));
      res.status(200).json({ data: agent, message: 'Profile image uploaded successfully' });
    } catch (error) {
      next(error);
    }
  };

  // \u2500\u2500\u2500 Agent self-service surface (`/v1/agents/me/*`) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  /** GET /v1/agents/me \u2014 own profile */
  public getMe = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agent = await this.agentService.getOwnProfile(this.getAgentSelfId(req));
      res.status(200).json({ data: agent, message: 'Profile retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /v1/agents/me \u2014 update own profile */
  public updateMe = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agent = await this.agentService.updateOwnProfile(this.getAgentSelfId(req), req.body as UpdateAgentSelfDto);
      res.status(200).json({ data: agent, message: 'Profile updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /v1/agents/me/availability \u2014 toggle acceptQueueBooking */
  public toggleAvailability = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { acceptQueueBooking } = req.body as ToggleAvailabilityDto;
      const agent = await this.agentService.setOwnAvailability(this.getAgentSelfId(req), acceptQueueBooking);
      res.status(200).json({
        data: { agentId: agent._id, acceptQueueBooking: agent.acceptQueueBooking },
        message: `Availability ${acceptQueueBooking ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      next(error);
    }
  };

  /** PUT /v1/agents/me/image \u2014 update own profile image */
  public uploadOwnImage = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No image file provided' });
      const agent = await this.agentService.uploadOwnProfileImage(this.getAgentSelfId(req), req.file);
      res.status(200).json({ data: agent, message: 'Profile image updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** GET /v1/agents/me/queue?date=YYYY-MM-DD \u2014 own queue (defaults to today) */
  public getMyQueue = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agentId = this.getAgentSelfId(req);
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      const queue = await this.queueService.getQueueByAgent(agentId, date);
      res.status(200).json({ data: queue, message: 'Queue retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /v1/agents/me/queue/persons/:bookingId \u2014 update a person's status */
  public updateMyQueuePersonStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agentId = this.getAgentSelfId(req);
      const data: UpdateQueuePersonDto = { status: req.body.status };
      const queue = await this.queueService.updatePersonStatus(agentId, req.params.bookingId, data);
      res.status(200).json({ data: queue, message: 'Person status updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** PUT /v1/agents/me/queue/persons/:bookingId/reorder */
  public reorderMyQueuePerson = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agentId = this.getAgentSelfId(req);
      const data: ReorderQueuePersonDto = { newPosition: req.body.newPosition };
      const queue = await this.queueService.reorderPerson(agentId, req.params.bookingId, data);
      res.status(200).json({ data: queue, message: 'Queue person reordered successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /v1/agents/me/queue/persons/:bookingId */
  public removeMyQueuePerson = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agentId = this.getAgentSelfId(req);
      const markAbsent = req.query.markAbsent === 'true';
      const queue = await this.queueService.removePersonFromQueue(agentId, req.params.bookingId, markAbsent);
      res.status(200).json({ data: queue, message: markAbsent ? 'Person removed and marked absent' : 'Person removed' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /v1/agents/me/queue/next
   * Mark the currently in-service person (if any) as completed, then promote
   * the next waiting person to in-service. This is the agent's "start next
   * customer" button.
   */
  public callNextInQueue = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agentId = this.getAgentSelfId(req);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const queue = await this.queueService.getQueueByAgent(agentId, today);

      if (!queue) throw new BadRequestException('No queue exists for today', 'QUEUE_NOT_FOUND');

      // Complete the current in-service person (if any)
      const inService = queue.persons.find((p: any) => p.status === QueuePersonStatus.IN_SERVICE);
      if (inService) {
        await this.queueService.updatePersonStatus(agentId, inService.bookingId.toString(), { status: QueuePersonStatus.COMPLETED });
      }

      // Promote the next waiting person (lowest position) to in-service
      const nextWaiting = queue.persons
        .filter((p: any) => p.status === QueuePersonStatus.WAITING)
        .sort((a: any, b: any) => a.position - b.position)[0];

      if (!nextWaiting) {
        const updated = await this.queueService.getQueueByAgent(agentId, today);
        return res.status(200).json({ data: updated, message: 'No more waiting persons' });
      }

      const updated = await this.queueService.updatePersonStatus(
        agentId,
        nextWaiting.bookingId.toString(),
        { status: QueuePersonStatus.IN_SERVICE },
      );
      res.status(200).json({ data: updated, message: 'Next person is now in service' });
    } catch (error) {
      next(error);
    }
  };

  /** POST /v1/agents/me/queue/persons \u2014 manually add a booking to own queue */
  public addToMyQueue = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agentId = this.getAgentSelfId(req);
      const data: AddToQueueDto = { bookingId: req.body.bookingId, position: req.body.position };
      const queue = await this.queueService.addPersonToQueue(agentId, data);
      res.status(201).json({ data: queue, message: 'Person added to queue successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** GET /v1/agents/me/queue/stats \u2014 today's queue stats */
  public getMyQueueStats = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agentId = this.getAgentSelfId(req);
      const queue = await this.queueService.getQueueByAgent(agentId);
      const persons = queue?.persons ?? [];
      const stats = {
        total: persons.length,
        waiting: persons.filter((p: any) => p.status === QueuePersonStatus.WAITING).length,
        inService: persons.filter((p: any) => p.status === QueuePersonStatus.IN_SERVICE).length,
        completed: persons.filter((p: any) => p.status === QueuePersonStatus.COMPLETED).length,
        absent: persons.filter((p: any) => p.status === QueuePersonStatus.ABSENT).length,
      };
      res.status(200).json({ data: stats, message: 'Queue stats retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export default AgentController;
