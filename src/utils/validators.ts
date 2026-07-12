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
 * Validate that an ObjectId references a user document with a rateable type (lounge or agent).
 * @throws BadRequestException if invalid or not a rateable type
 */
export async function assertRateableTarget(targetId: string): Promise<string> {
  assertObjectId(targetId, 'target');
  const user = await userModel.findById(targetId).select('type isBlocked').lean();
  if (!user || user.isBlocked) {
    throw new BadRequestException('User not found', 'USER_NOT_FOUND');
  }
  if (user.type !== 'lounge' && user.type !== 'agent') {
    throw new BadRequestException('Target user is not rateable', 'INVALID_RATEABLE_TARGET');
  }
  return user.type;
}

/**
 * Validate that an ObjectId references a user document with a likeable type (lounge or agent).
 * @throws BadRequestException if invalid or not a likeable type
 */
export async function assertLikeableTarget(targetId: string): Promise<string> {
  assertObjectId(targetId, 'target');
  const user = await userModel.findById(targetId).select('type isBlocked').lean();
  if (!user || user.isBlocked) {
    throw new BadRequestException('User not found', 'USER_NOT_FOUND');
  }
  if (user.type !== 'lounge' && user.type !== 'agent') {
    throw new BadRequestException('Target user is not likeable', 'INVALID_LIKEABLE_TARGET');
  }
  return user.type;
}

/**
 * Validate that an ObjectId references an existing user of any type.
 * @throws BadRequestException if invalid or not found
 */
export async function assertExistingUser(userId: string): Promise<string> {
  assertObjectId(userId, 'user');
  const user = await userModel.findById(userId).select('type isBlocked').lean();
  if (!user || user.isBlocked) {
    throw new BadRequestException('User not found', 'USER_NOT_FOUND');
  }
  return user.type;
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
