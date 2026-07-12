/** User types that can like or be liked. */
export type LikelikeUserType = 'client' | 'lounge' | 'agent';

/** Allowed liker→target combinations. */
const ALLOWED_LIKE_PAIRS = new Set([
  'client→lounge',
  'client→agent',
  'lounge→agent',
]);

export function isAllowedLikePair(likerType: string, targetType: string): boolean {
  return ALLOWED_LIKE_PAIRS.has(`${likerType}→${targetType}`);
}

export interface Like {
  _id?: string;
  likerId: string;
  targetId: string;
  likerType: LikelikeUserType;
  targetType: LikelikeUserType;
  createdAt?: Date;
}
