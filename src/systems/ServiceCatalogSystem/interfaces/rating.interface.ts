import { SocialUserType } from '@utils/social-matrix';

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
