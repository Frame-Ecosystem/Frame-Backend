export enum QueuePersonStatus {
  WAITING = 'waiting',
  IN_SERVICE = 'inService',
  COMPLETED = 'completed',
  ABSENT = 'absent',
}

export interface QueuePerson {
  bookingId: string; // Reference to Booking
  clientId: string; // Reference to User (client) — avoids deep population
  position: number; // Order in the queue (1-based)
  status: QueuePersonStatus;
  joinedAt: Date; // When they entered the queue
}

export interface Queue {
  _id?: string;
  agentId: string; // Reference to Agent (one-to-one)
  date: Date; // The day this queue is for
  persons: QueuePerson[];
  createdAt?: Date;
  updatedAt?: Date;
}
