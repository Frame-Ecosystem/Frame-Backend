import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import LoungeService from '@systems/ServiceCatalogSystem/services/lounge.service';
import { logger } from '@utils/logger';

class LoungeController {
  private loungeService = new LoungeService();

  public getClientById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const client = await this.loungeService.getClientById(clientId);

      res.status(200).json({
        success: true,
        data: client,
        message: 'Client retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error in getClientById: ${error.message}`);
      next(error);
    }
  };

  public updateMyQueueBooking = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const agentId = req.user._id.toString();
      const loungeId = req.user.parentLounge?.toString();
      const { acceptQueueBooking } = req.body;

      if (typeof acceptQueueBooking !== 'boolean') {
        return res.status(400).json({ success: false, message: 'acceptQueueBooking must be a boolean' });
      }

      if (!loungeId) {
        return res.status(400).json({ success: false, message: 'Agent is not associated with a lounge' });
      }

      const agent = await this.loungeService.updateAgentQueueBooking(loungeId, agentId, acceptQueueBooking);

      res.status(200).json({
        success: true,
        data: { agentId: agent._id, acceptQueueBooking: agent.acceptQueueBooking },
        message: `Queue booking ${acceptQueueBooking ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      logger.error(`Error in updateMyQueueBooking: ${error.message}`);
      next(error);
    }
  };

  public getMostBookedLounges = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const mostBookedLounges = await this.loungeService.getMostBookedLounges();

      res.status(200).json({
        success: true,
        data: mostBookedLounges,
        count: mostBookedLounges.length,
        message: 'Lounges retrieved successfully, ordered by completed bookings',
      });
    } catch (error) {
      logger.error(`Error in getMostBookedLounges: ${error.message}`);
      next(error);
    }
  };

  public updateAgentQueueBooking = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const loungeId = req.user._id.toString();
      const { agentId } = req.params;
      const { acceptQueueBooking } = req.body;

      if (typeof acceptQueueBooking !== 'boolean') {
        return res.status(400).json({ success: false, message: 'acceptQueueBooking must be a boolean' });
      }

      const agent = await this.loungeService.updateAgentQueueBooking(loungeId, agentId, acceptQueueBooking);

      res.status(200).json({
        success: true,
        data: { agentId: agent._id, acceptQueueBooking: agent.acceptQueueBooking },
        message: `Queue booking ${acceptQueueBooking ? 'enabled' : 'disabled'} for agent`,
      });
    } catch (error) {
      logger.error(`Error in updateAgentQueueBooking: ${error.message}`);
      next(error);
    }
  };
}

export default LoungeController;
