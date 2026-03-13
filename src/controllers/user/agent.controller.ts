import { NextFunction, Request, Response } from 'express';
import AgentService from '@services/user/agent.service';
import { CreateAgentDto, UpdateAgentDto } from '@dtos/user/agent.dto';
import { RequestWithUser } from '@interfaces/auth/auth.interface';

class AgentController {
  public agentService = new AgentService();

  /**
   * Derive loungeId from the authenticated user if they are a lounge owner.
   * Returns undefined for non-lounge users (admins, etc.).
   */
  private getLoungeOwnership(req: RequestWithUser): string | undefined {
    const user = req.user;
    return user?.type === 'lounge' ? String(user._id) : undefined;
  }

  /**
   * Create a new agent
   */
  public createAgent = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const data: CreateAgentDto = {
        agentName: req.body.agentName,
        password: req.body.password,
        loungeId: req.body.loungeId,
        idLoungeService: req.body.idLoungeService,
        isBlocked: req.body.isBlocked === 'true' || req.body.isBlocked === true,
        profileImage: req.body.profileImage,
      };

      if (!data.agentName || !data.password || !data.idLoungeService || !Array.isArray(data.idLoungeService) || data.idLoungeService.length === 0) {
        return res.status(400).json({
          message: 'Agent name, password, and lounge services are required',
        });
      }

      if (user?.type === 'lounge') {
        data.loungeId = user._id;
      }

      if (!data.loungeId) {
        return res.status(400).json({
          message: 'Lounge ID is required',
        });
      }

      const agent = await this.agentService.createAgent(data, req.file);
      res.status(201).json({
        data: agent,
        message: 'Agent created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all agents for a lounge
   */
  public getAgentsByLounge = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.params.loungeId || req.user?._id?.toString();
      const agents = await this.agentService.getAgentsByLounge(loungeId);
      res.status(200).json({
        data: agents,
        count: agents.length,
        message: 'Agents retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get agent by ID
   */
  public getAgentById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const agent = await this.agentService.getAgentById(agentId, this.getLoungeOwnership(req));
      res.status(200).json({
        data: agent,
        message: 'Agent retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update agent
   */
  public updateAgent = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const data: UpdateAgentDto = req.body;
      const agent = await this.agentService.updateAgent(agentId, data, this.getLoungeOwnership(req));
      res.status(200).json({
        data: agent,
        message: 'Agent updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete agent
   */
  public deleteAgent = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      await this.agentService.deleteAgent(agentId, this.getLoungeOwnership(req));
      res.status(200).json({
        message: 'Agent deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all agents (filtered by user type)
   */
  public getAllAgents = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agents = await this.agentService.getAllAgents(req.user);
      res.status(200).json({
        data: agents,
        count: agents.length,
        message: 'Agents retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload profile image for agent
   */
  public uploadProfileImage = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }
      const { agentId } = req.params;
      const agent = await this.agentService.uploadProfileImage(agentId, req.file, this.getLoungeOwnership(req));
      res.status(200).json({
        data: agent,
        message: 'Profile image uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default AgentController;
