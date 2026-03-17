import { IsString, IsEnum, IsDateString, IsOptional, IsNumber, IsArray, Min, IsMongoId, MaxLength, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus } from '@interfaces/booking/booking.interface';

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

export class CancelledByDto {
  @IsString()
  idUser: string;

  @IsString()
  cancelledByName: string;

  @IsOptional()
  @IsString({ message: 'Cancellation note must be a string' })
  @MaxLength(500, { message: 'Cancellation note cannot exceed 500 characters' })
  note?: string;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => CancelledByDto)
  cancelledBy?: CancelledByDto;

  @IsOptional()
  @IsString({ message: 'Cancellation note must be a string' })
  @MaxLength(500, { message: 'Cancellation note cannot exceed 500 characters' })
  cancellationNote?: string;
}

/**
 * DTO for lounge-initiated queue bookings.
 * Supports two cases:
 *   1. Visitor (walk-in): provide visitorName
 *   2. Existing client: provide clientPhone or clientEmail to look up in DB
 *
 * At least one of visitorName, clientPhone, or clientEmail is required.
 */
export class CreateLoungeQueueBookingDto {
  @IsMongoId({ message: 'Invalid lounge ID format' })
  loungeId: string;

  @IsMongoId({ message: 'Invalid agent ID format' })
  agentId: string;

  // --- Visitor case ---
  @IsOptional()
  @IsString({ message: 'Visitor name must be a string' })
  @MaxLength(100, { message: 'Visitor name cannot exceed 100 characters' })
  visitorName?: string;

  // --- Client case ---
  @IsOptional()
  @IsString({ message: 'Client phone must be a string' })
  clientPhone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Client email must be a valid email' })
  clientEmail?: string;

  @IsOptional()
  @IsArray({ message: 'Lounge service IDs must be an array' })
  @IsMongoId({ each: true, message: 'Each lounge service ID must be a valid MongoDB ID' })
  loungeServiceIds?: string[];

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;
}
