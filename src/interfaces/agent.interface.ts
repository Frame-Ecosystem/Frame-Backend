export interface Agent {
  _id?: string;
  agentName: string;
  password: string;
  loungeId: string; // Reference to Lounge (User with type 'lounge')
  profileImage?: { url?: string; publicId?: string };
  isBlocked?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
