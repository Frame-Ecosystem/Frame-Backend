import { SocialUserType } from '@utils/social-matrix';

export interface Like {
  _id?: string;
  likerId: string;
  targetId: string;
  likerType: SocialUserType;
  targetType: SocialUserType;
  createdAt?: Date;
}
