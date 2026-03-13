export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_QUEUE = 'inQueue',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ABSENT = 'absent',
}

export interface CancelledBy {
  idUser: string;
  cancelledByName: string;
}

export interface Booking {
  _id?: string;
  clientId?: string; // Reference to User (client type) — optional for visitor bookings
  visitorName?: string; // Name for walk-in visitors without an account
  loungeId: string; // Reference to User (lounge type)
  agentIds?: string[]; // List of agent IDs (Reference to User - agent type)
  loungeServiceIds?: string[]; // List of lounge service IDs being booked
  status: BookingStatus;
  cancelledBy?: CancelledBy;
  bookingDate: Date;
  totalPrice?: number;
  totalDuration?: number; // Total duration in minutes for all services
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
