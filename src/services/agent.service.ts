import { Agent } from '@/interfaces/agent.interface';
import { CreateAgentDto, UpdateAgentDto } from '@/dtos/agent.dto';
import agentModel from '@/models/agent.model';
import userModel from '@/models/users.model';
import { BadRequestException, NotFoundException, ConflictException } from '@/exceptions/HttpException';
import { isEmpty } from '@/utils/util';
import { logger } from '@utils/logger';
import CloudinaryService from '@/services/cloudinary.service';
class AgentService {
  public agents = agentModel;
  public users = userModel;

  /**
   * Create a new agent
   */
  public async createAgent(data: CreateAgentDto, file?: Express.Multer.File): Promise<Agent> {
    try {
      if (isEmpty(data) || !data.agentName || !data.password || !data.loungeId) {
        logger.warn('AgentService.createAgent: invalid data provided');
        throw new BadRequestException('Agent name, password, and lounge ID are required', 'MISSING_REQUIRED_FIELDS');
      }

      // Check if lounge exists and is of type 'lounge'
      const lounge = await this.users.findOne({ _id: data.loungeId, type: 'lounge' });
      if (!lounge) {
        logger.error(`AgentService.createAgent: lounge not found or not a lounge: ${data.loungeId}`);
        throw new NotFoundException('Lounge not found', 'LOUNGE_NOT_FOUND');
      }

      // Check if agent name already exists
      const existingAgent = await this.agents.findOne({ agentName: data.agentName });
      if (existingAgent) {
        logger.error(`AgentService.createAgent: agent name already exists: ${data.agentName}`);
        throw new ConflictException('An agent with this name already exists', 'AGENT_NAME_EXISTS');
      }

      const agent = await this.agents.create(data);

      // Handle image upload (either from file or base64)
      let imageUploaded = false;
      if (file || data.profileImage) {
        try {
          let imageBuffer: Buffer;
          const fileName = agent._id;

          if (data.profileImage) {
            // Handle base64 image
            const base64Data = data.profileImage.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else if (file) {
            // Handle file upload
            imageBuffer = file.buffer;
          }

          if (imageBuffer) {
            const { url, publicId } = await CloudinaryService.uploadProfileImage(imageBuffer, fileName);

            // Update agent with image
            await this.agents.findByIdAndUpdate(agent._id, {
              profileImage: {
                url,
                publicId,
              },
            });

            imageUploaded = true;
          }
        } catch (imageError) {
          logger.warn(`AgentService.createAgent: agent created but image upload failed: ${imageError.message}`);
          // Agent is created successfully, just log the image upload failure
        }
      }

      // Fetch updated agent
      const finalAgent = await this.agents.findById(agent._id).populate('loungeId', 'loungeTitle email');
      logger.info(`AgentService.createAgent: agent created ${imageUploaded ? 'with' : 'without'} image successfully: ${agent._id}`);
      return finalAgent;
    } catch (error) {
      logger.error('AgentService.createAgent: error creating agent', error);
      throw error;
    }
  }

  /**
   * Get all agents for a lounge
   */
  public async getAgentsByLounge(loungeId: string): Promise<Agent[]> {
    try {
      if (isEmpty(loungeId)) {
        throw new BadRequestException('Lounge ID is required', 'MISSING_LOUNGE_ID');
      }

      const agents = await this.agents.find({ loungeId }).populate('loungeId', 'loungeTitle email');
      return agents;
    } catch (error) {
      logger.error('AgentService.getAgentsByLounge: error getting agents', error);
      throw error;
    }
  }

  /**
   * Get agent by ID (with lounge ownership check)
   */
  public async getAgentById(agentId: string, loungeId?: string): Promise<Agent> {
    try {
      if (isEmpty(agentId)) {
        throw new BadRequestException('Agent ID is required', 'MISSING_AGENT_ID');
      }

      const agent = await this.agents.findById(agentId).populate('loungeId', 'loungeTitle email');
      if (!agent) {
        throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
      }

      // If loungeId is provided, check ownership
      if (loungeId && agent.loungeId.toString() !== loungeId) {
        throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
      }

      return agent;
    } catch (error) {
      logger.error('AgentService.getAgentById: error getting agent', error);
      throw error;
    }
  }

  /**
   * Update agent
   */
  public async updateAgent(agentId: string, data: UpdateAgentDto, loungeId?: string): Promise<Agent> {
    try {
      if (isEmpty(agentId)) {
        throw new BadRequestException('Agent ID is required', 'MISSING_AGENT_ID');
      }

      if (isEmpty(data)) {
        throw new BadRequestException('Update data is required', 'MISSING_UPDATE_DATA');
      }

      // Check if agent exists
      const existingAgent = await this.agents.findById(agentId);
      if (!existingAgent) {
        throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
      }

      // If loungeId is provided, check ownership
      if (loungeId && existingAgent.loungeId.toString() !== loungeId) {
        throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
      }

      // Check if agent name is being updated and if it already exists
      if (data.agentName && data.agentName !== existingAgent.agentName) {
        const nameExists = await this.agents.findOne({ agentName: data.agentName });
        if (nameExists) {
          throw new ConflictException('An agent with this name already exists', 'AGENT_NAME_EXISTS');
        }
      }

      const updatedAgent = await this.agents.findByIdAndUpdate(agentId, data, { new: true }).populate('loungeId', 'loungeTitle email');
      logger.info(`AgentService.updateAgent: agent updated successfully: ${agentId}`);
      return updatedAgent;
    } catch (error) {
      logger.error('AgentService.updateAgent: error updating agent', error);
      throw error;
    }
  }

  /**
   * Delete agent
   */
  public async deleteAgent(agentId: string, loungeId?: string): Promise<void> {
    try {
      if (isEmpty(agentId)) {
        throw new BadRequestException('Agent ID is required', 'MISSING_AGENT_ID');
      }

      const agent = await this.agents.findById(agentId);
      if (!agent) {
        throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
      }

      // If loungeId is provided, check ownership
      if (loungeId && agent.loungeId.toString() !== loungeId) {
        throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
      }

      await this.agents.findByIdAndDelete(agentId);
      logger.info(`AgentService.deleteAgent: agent deleted successfully: ${agentId}`);
    } catch (error) {
      logger.error('AgentService.deleteAgent: error deleting agent', error);
      throw error;
    }
  }

  /**
   * Get all agents (filtered by user type)
   */
  public async getAllAgents(user?: any): Promise<Agent[]> {
    try {
      let query = {};

      // If user is a lounge, only return their agents
      if (user && user.type === 'lounge') {
        query = { loungeId: user._id };
      }
      // If user is admin, return all agents

      const agents = await this.agents.find(query).populate('loungeId', 'loungeTitle email');
      return agents;
    } catch (error) {
      logger.error('AgentService.getAllAgents: error getting all agents', error);
      throw error;
    }
  }

  /**
   * Upload profile image for agent
   */
  public async uploadProfileImage(agentId: string, file: Express.Multer.File, loungeId?: string): Promise<Agent> {
    try {
      if (isEmpty(agentId) || !file) {
        logger.warn('AgentService.uploadProfileImage: empty agentId or file provided');
        throw new BadRequestException('Agent ID and image file are required', 'MISSING_REQUIRED_FIELDS');
      }

      // Check if agent exists
      const agent = await this.agents.findById(agentId);
      if (!agent) {
        logger.error(`AgentService.uploadProfileImage: agent not found: ${agentId}`);
        throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
      }

      // If loungeId is provided, check ownership
      if (loungeId && agent.loungeId.toString() !== loungeId) {
        logger.error(`AgentService.uploadProfileImage: agent does not belong to lounge: ${agentId}`);
        throw new NotFoundException('Agent not found', 'AGENT_NOT_FOUND');
      }

      // Delete existing image if it exists
      if (agent.profileImage?.publicId) {
        try {
          await CloudinaryService.deleteProfileImage(agent.profileImage.publicId);
        } catch (deleteError) {
          logger.warn(`AgentService.uploadProfileImage: failed to delete old image: ${deleteError.message}`);
          // Continue with upload even if delete fails
        }
      }

      // Upload new image
      const { url, publicId } = await CloudinaryService.uploadProfileImage(file.buffer, agentId);

      // Update agent with new image
      const updatedAgent = await this.agents
        .findByIdAndUpdate(
          agentId,
          {
            profileImage: {
              url,
              publicId,
            },
          },
          { new: true },
        )
        .populate('loungeId', 'loungeTitle email');

      logger.info(`AgentService.uploadProfileImage: profile image uploaded successfully for agent: ${agentId}`);
      return updatedAgent;
    } catch (error) {
      logger.error(`AgentService.uploadProfileImage error: ${error.message}`, { agentId, stack: error.stack });
      throw error;
    }
  }
}

export default AgentService;
