import { SocialUserType, isAllowedSocialPair } from '@utils/social-matrix';

/** @deprecated Use `SocialUserType` from `@utils/social-matrix`. */
export type RateableUserType = SocialUserType;

/** Proper alias — prefer this over the deprecated `RateableUserType`. */
export type RatingUserType = SocialUserType;

/** @deprecated Use `isAllowedSocialPair` from `@utils/social-matrix` directly. */
export const isAllowedRatingPair = isAllowedSocialPair;

export interface Rating {
  _id?: string;
  raterId: string;
  targetId: string;
  raterType: SocialUserType;
  targetType: SocialUserType;
  score: number;
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Denormalized rating summary stored on the rated user document. */
export interface RatingSummary {
  averageRating: number;
  ratingCount: number;
}
