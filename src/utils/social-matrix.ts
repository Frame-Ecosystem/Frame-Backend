/**
 * Shared social interaction primitives used by Like, Rating, and Follow modules.
 *
 * Centralizes:
 *  - User type union (`SocialUserType`)
 *  - Allowed-pair matrices (rating/like share the same matrix)
 *  - Populate select strings for Mongoose queries
 */

// ─── User Types ──────────────────────────────────────────────────────────────

/** All non-admin user types that participate in social interactions. */
export type SocialUserType = 'client' | 'lounge' | 'agent';

// ─── Interaction Matrices ────────────────────────────────────────────────────

/**
 * Allowed actor→target pairs for ratings and likes.
 * Any user type can rate/like any lounge or agent.
 * Clients and admins cannot be targets. Self-actions are rejected at the service level.
 */
const SOCIAL_INTERACTION_PAIRS = new Set([
  'client→lounge',
  'client→agent',
  'lounge→lounge',
  'lounge→agent',
  'agent→lounge',
  'agent→agent',
]);

/**
 * Check whether an actor (rater/liker) can interact with a target.
 * Self-check is NOT included — callers must handle that separately.
 */
export function isAllowedSocialPair(actorType: string, targetType: string): boolean {
  return SOCIAL_INTERACTION_PAIRS.has(`${actorType}→${targetType}`);
}

// ─── Mongoose Populate Select Strings ────────────────────────────────────────

/** Fields populated on a target user in like/rating reads (full profile). */
export const POPULATE_TARGET_FULL =
  'firstName lastName loungeTitle profileImage coverImage averageRating ratingCount likeCount type';

/** Fields populated on an actor (rater/liker) in like/rating reads (basic profile). */
export const POPULATE_ACTOR_BASIC =
  'firstName lastName loungeTitle profileImage type';

/** Fields populated on a user reference in follow reads. */
export const POPULATE_FOLLOW_USER =
  'firstName lastName loungeTitle profileImage bio type';
