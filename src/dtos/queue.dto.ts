import { IsMongoId, IsEnum, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';
import { QueuePersonStatus } from '@interfaces/queue.interface';

// Used when manually adding a person to an agent's queue
export class AddToQueueDto {
  @IsMongoId({ message: 'Invalid booking ID format' })
  bookingId: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Position must be a valid number' })
  @Min(1, { message: 'Position must be at least 1' })
  position?: number; // If omitted, appended at the end
}

// Used when updating a person's status within the queue
export class UpdateQueuePersonDto {
  @IsEnum(QueuePersonStatus, { message: 'Invalid queue person status' })
  status: QueuePersonStatus;
}

// Used when querying queues by date
export class GetQueueByDateDto {
  @IsOptional()
  @IsDateString({}, { message: 'Date must be a valid ISO 8601 date string' })
  date?: string; // Defaults to today if omitted
}
