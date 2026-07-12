export interface Follow {
  _id?: string;
  followerId: string; // User who follows
  followingId: string; // User being followed
  followerType: 'client' | 'lounge' | 'agent'; // Type of the follower
  followingType: 'client' | 'lounge' | 'agent'; // Type of the user being followed
  createdAt?: Date;
}
