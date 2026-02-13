export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_QUEUE = 'inQueue',
  CANCELLED = 'cancelled',
}

export interface Booking {
  _id?: string;
  clientId: string; // Reference to User (client type)
  loungeId: string; // Reference to User (lounge type)
  agentId?: string; // Reference to User (agent type)
  loungeServiceIds?: string[]; // List of lounge service IDs being booked
  status: BookingStatus;
  bookingDate: Date;
  totalPrice?: number;
  totalDuration?: number; // Total duration in minutes for all services
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
