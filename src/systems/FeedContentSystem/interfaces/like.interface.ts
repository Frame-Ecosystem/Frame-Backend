/** User types that can like or be liked. */
export type LikelikeUserType = 'client' | 'lounge' | 'agent';

/** Allowed liker→target combinations.
 *  Any user type can like any lounge or agent (not clients, not admins, not self). */
const ALLOWED_LIKE_PAIRS = new Set([
  'client→lounge',
  'client→agent',
  'lounge→lounge',
  'lounge→agent',
  'agent→lounge',
  'agent→agent',
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
