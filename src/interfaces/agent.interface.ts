export interface Agent {
  agentName: string;
  password: string;
  loungeId: string; // Reference to Lounge (User with type 'lounge')
  idLoungeService: string[]; // List of lounge service IDs that this agent can perform
  profileImage?: { url?: string; publicId?: string };
  isBlocked?: boolean;
  acceptQueueBooking?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
