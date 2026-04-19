import mongoose from 'mongoose';
import { Request } from 'express';
import { BadRequestException } from '@exceptions/HttpException';
import userModel from '@systems/UserManager/models/user.model';

/**
 * Validate a string is a valid MongoDB ObjectId.
 * @throws BadRequestException with code `INVALID_{LABEL}_ID`
 */
export function assertObjectId(id: string, label: string): void {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestException(`Invalid ${label} ID format`, `INVALID_${label.toUpperCase()}_ID`);
  }
}

/**
 * Validate that an ObjectId references a user document of type "lounge".
 * @throws BadRequestException if invalid or not a lounge
 */
export async function assertLounge(loungeId: string): Promise<void> {
  assertObjectId(loungeId, 'lounge');
  const lounge = await userModel.findById(loungeId).select('type').lean();
  if (!lounge || lounge.type !== 'lounge') {
    throw new BadRequestException('Lounge not found or is not a valid lounge', 'INVALID_LOUNGE');
  }
}

/**
 * Extract pagination parameters from an Express request.
 * Clamps page ≥ 1 and 1 ≤ limit ≤ maxLimit.
 */
export function parsePagination(req: Request, maxLimit = 50): { page: number; limit: number } {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit as string) || 20));
  return { page, limit };
}
