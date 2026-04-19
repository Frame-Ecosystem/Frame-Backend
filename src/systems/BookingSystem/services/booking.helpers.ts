import loungeServiceModel from '@systems/ServiceCatalogSystem/models/loungeService.model';
import agentModel from '@systems/UserManager/models/agent.model';
import { BadRequestException } from '@exceptions/HttpException';

/**
 * Validate that all lounge service IDs exist and belong to the specified lounge.
 */
export async function validateLoungeServices(serviceIds: string[], loungeId: string): Promise<void> {
  const services = await loungeServiceModel.find({ _id: { $in: serviceIds } });
  if (services.length !== serviceIds.length) {
    throw new BadRequestException('One or more lounge services not found', 'INVALID_SERVICES');
  }
  const invalidServices = services.filter(s => s.loungeId.toString() !== loungeId);
  if (invalidServices.length > 0) {
    throw new BadRequestException('All lounge services must belong to the specified lounge', 'SERVICE_LOUNGE_MISMATCH');
  }
}

/**
 * Validate that all agent IDs exist and belong to the specified lounge.
 */
export async function validateAgents(agentIds: string[], loungeId: string): Promise<void> {
  const uniqueAgentIds = [...new Set(agentIds)];
  const found = await agentModel.find({ _id: { $in: uniqueAgentIds } });
  if (found.length !== uniqueAgentIds.length) {
    throw new BadRequestException('One or more agents not found', 'INVALID_AGENTS');
  }
  const invalidAgents = found.filter(a => a.loungeId?.toString() !== loungeId);
  if (invalidAgents.length > 0) {
    throw new BadRequestException('All agents must belong to the specified lounge', 'AGENT_LOUNGE_MISMATCH');
  }
}

/**
 * Calculate total price and duration from an array of lounge service IDs.
 */
export async function calculateServiceTotals(serviceIds: string[]): Promise<{ price: number; duration: number }> {
  const services = await loungeServiceModel.find({ _id: { $in: serviceIds } });
  const price = services.reduce((sum, s) => sum + (s.price || 0), 0);
  const duration = services.reduce((sum, s) => sum + (s.duration || 0), 0);
  return { price, duration };
}
