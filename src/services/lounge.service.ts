import { NotFoundException, BadRequestException } from '@exceptions/HttpException';
import userModel from '@models/users.model';
import agentModel from '@models/agent.model';
import mongoose from 'mongoose';
import { logger } from '@utils/logger';

const CLIENT_PUBLIC_FIELDS = 'firstName lastName email profileImage coverImage location';

class LoungeService {
  private users = userModel;
  private agents = agentModel;

  public async getClientById(clientId: string): Promise<any> {
    try {
      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        throw new BadRequestException('Invalid client ID format', 'INVALID_CLIENT_ID');
      }

      const client = await this.users.findOne({ _id: clientId, type: 'client' }).select(CLIENT_PUBLIC_FIELDS);

      if (!client) {
        throw new NotFoundException('Client not found', 'CLIENT_NOT_FOUND');
      }

      return client;
    } catch (error) {
      logger.error(`Error fetching client ${clientId}: ${error.message}`);
      throw error;
    }
  }

  public async updateAgentQueueBooking(loungeId: string, agentId: string, acceptQueueBooking: boolean): Promise<any> {
    try {
      if (!mongoose.Types.ObjectId.isValid(agentId)) {
        throw new BadRequestException('Invalid agent ID format', 'INVALID_AGENT_ID');
      }

      const agent = await this.agents.findOne({ _id: agentId, loungeId });
      if (!agent) {
        throw new NotFoundException('Agent not found or does not belong to this lounge', 'AGENT_NOT_FOUND');
      }

      agent.acceptQueueBooking = acceptQueueBooking;
      await agent.save();

      logger.info(`Agent ${agentId} acceptQueueBooking set to ${acceptQueueBooking}`);
      return agent;
    } catch (error) {
      logger.error(`Error updating agent queue booking setting: ${error.message}`);
      throw error;
    }
  }
}

export default LoungeService;
