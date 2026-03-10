import { IsString, IsEnum, IsDateString, IsOptional, IsNumber, IsArray, Min, IsMongoId, MaxLength } from 'class-validator';
import { BookingStatus } from '@interfaces/booking.interface';

export class CreateBookingDto {
  @IsMongoId({ message: 'Invalid client ID format' })
  clientId: string;

  @IsMongoId({ message: 'Invalid lounge ID format' })
  loungeId: string;

  @IsOptional()
  @IsArray({ message: 'Agent IDs must be an array' })
  @IsMongoId({ each: true, message: 'Each agent ID must be a valid MongoDB ID' })
  agentIds?: string[];

  @IsOptional()
  @IsArray({ message: 'Lounge service IDs must be an array' })
  @IsMongoId({ each: true, message: 'Each lounge service ID must be a valid MongoDB ID' })
  loungeServiceIds?: string[];

  @IsDateString({}, { message: 'Booking date must be a valid ISO 8601 date string' })
  bookingDate: string;

  @IsOptional()
  @IsEnum(BookingStatus, { message: 'Invalid booking status' })
  status?: BookingStatus;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Total price must be a valid number' })
  @Min(0, { message: 'Total price cannot be negative' })
  totalPrice?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Total duration must be a valid number' })
  @Min(0, { message: 'Total duration cannot be negative' })
  totalDuration?: number;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;
}

export class CreateQueueBookingDto {
  @IsMongoId({ message: 'Invalid client ID format' })
  clientId: string;

  @IsMongoId({ message: 'Invalid lounge ID format' })
  loungeId: string;

  @IsMongoId({ message: 'Invalid agent ID format' })
  agentId: string;

  @IsOptional()
  @IsArray({ message: 'Lounge service IDs must be an array' })
  @IsMongoId({ each: true, message: 'Each lounge service ID must be a valid MongoDB ID' })
  loungeServiceIds?: string[];

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;
}

export class UpdateBookingDto {
  @IsOptional()
  @IsEnum(BookingStatus, { message: 'Invalid booking status' })
  status?: BookingStatus;

  @IsOptional()
  @IsDateString({}, { message: 'Booking date must be a valid ISO 8601 date string' })
  bookingDate?: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Total price must be a valid number' })
  @Min(0, { message: 'Total price cannot be negative' })
  totalPrice?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Total duration must be a valid number' })
  @Min(0, { message: 'Total duration cannot be negative' })
  totalDuration?: number;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;
}
