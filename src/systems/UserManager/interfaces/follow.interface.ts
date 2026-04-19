export interface Follow {
  _id?: string;
  followerId: string; // User who follows
  followingId: string; // User being followed
  followerType: 'client' | 'lounge'; // Type of the follower
  followingType: 'client' | 'lounge'; // Type of the user being followed
  createdAt?: Date;
}
