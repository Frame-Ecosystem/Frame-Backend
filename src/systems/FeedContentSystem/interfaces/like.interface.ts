import { SocialUserType, isAllowedSocialPair } from '@utils/social-matrix';

/** @deprecated Use `SocialUserType` from `@utils/social-matrix`. */
export type LikelikeUserType = SocialUserType;

/** Proper alias — prefer this over the deprecated `LikelikeUserType`. */
export type LikeUserType = SocialUserType;

/** @deprecated Use `isAllowedSocialPair` from `@utils/social-matrix` directly. */
export const isAllowedLikePair = isAllowedSocialPair;

export interface Like {
  _id?: string;
  likerId: string;
  targetId: string;
  likerType: SocialUserType;
  targetType: SocialUserType;
  createdAt?: Date;
}
