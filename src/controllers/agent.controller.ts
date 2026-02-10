import { NextFunction, Request, Response } from 'express';
import AgentService from '@services/agent.service';
import { CreateAgentDto, UpdateAgentDto } from '@dtos/agent.dto';

class AgentController {
  public agentService = new AgentService();

  /**
   * Create a new agent
   */
  public createAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      const data: CreateAgentDto = {
        agentName: req.body.agentName,
        password: req.body.password,
        loungeId: req.body.loungeId,
        isBlocked: req.body.isBlocked === 'true' || req.body.isBlocked === true,
        profileImage: req.body.profileImage, // Base64 image string
      };

      // Validate required fields
      if (!data.agentName || !data.password) {
        return res.status(400).json({
          message: 'Agent name and password are required',
        });
      }

      // If user is lounge, they can only create agents for themselves
      if (user && user.type === 'lounge') {
        data.loungeId = user._id;
      }

      // Lounge ID is required
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
  public getAgentsByLounge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let loungeId = req.params.loungeId;
      // For lounge routes, use authenticated user's ID
      if (!loungeId && req.user) {
        loungeId = (req.user as any)._id;
      }
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
  public getAgentById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const user = req.user as any;
      // For lounge users, check ownership
      const loungeId = user && user.type === 'lounge' ? String(user._id) : undefined;
      const agent = await this.agentService.getAgentById(agentId, loungeId);
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
  public updateAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const data: UpdateAgentDto = req.body;
      const user = req.user as any;
      // For lounge users, check ownership
      const loungeId = user && user.type === 'lounge' ? String(user._id) : undefined;
      const agent = await this.agentService.updateAgent(agentId, data, loungeId);
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
  public deleteAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const user = req.user as any;
      // For lounge users, check ownership
      const loungeId = user && user.type === 'lounge' ? String(user._id) : undefined;
      await this.agentService.deleteAgent(agentId, loungeId);
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
  public getAllAgents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      const agents = await this.agentService.getAllAgents(user);
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
  public uploadProfileImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }
      const { agentId } = req.params;
      const user = req.user as any;
      // For lounge users, check ownership
      const loungeId = user && user.type === 'lounge' ? String(user._id) : undefined;
      const agent = await this.agentService.uploadProfileImage(agentId, req.file, loungeId);
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
