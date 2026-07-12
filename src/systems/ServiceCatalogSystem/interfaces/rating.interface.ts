/** User types that can rate or be rated. */
export type RateableUserType = 'client' | 'lounge' | 'agent';

/** Allowed rater→target combinations.
 *  Any user type can rate any lounge or agent (not clients, not admins, not self). */
const ALLOWED_RATING_PAIRS = new Set([
  'client→lounge',
  'client→agent',
  'lounge→lounge',
  'lounge→agent',
  'agent→lounge',
  'agent→agent',
]);

export function isAllowedRatingPair(raterType: string, targetType: string): boolean {
  return ALLOWED_RATING_PAIRS.has(`${raterType}→${targetType}`);
}

export interface Rating {
  _id?: string;
  raterId: string; // User who rates
  targetId: string; // User being rated
  raterType: RateableUserType;
  targetType: RateableUserType;
  score: number; // 1–5
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Denormalized rating summary stored on the rated user document. */
export interface RatingSummary {
  averageRating: number;
  ratingCount: number;
}
