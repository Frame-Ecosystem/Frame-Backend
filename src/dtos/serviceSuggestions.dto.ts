import { IsString, IsEnum, IsOptional, MaxLength, MinLength, IsNumber, Min, Max } from 'class-validator';
import { ServiceSuggestionStatus } from '@interfaces/serviceSuggestion.interface';

export class CreateServiceSuggestionDto {
  @IsString()
  @MinLength(2, { message: 'Service suggestion name must be at least 2 characters' })
  @MaxLength(200, { message: 'Service suggestion name cannot exceed 200 characters' })
  name: string;

  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters' })
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Estimated price must be non-negative' })
  estimatedPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(15, { message: 'Estimated duration must be at least 15 minutes' })
  @Max(480, { message: 'Estimated duration cannot exceed 480 minutes' })
  estimatedDuration?: number;

  @IsOptional()
  @IsEnum(['men', 'women', 'unisex', 'kids'], { message: 'Target gender must be one of: men, women, unisex, kids' })
  targetGender?: 'men' | 'women' | 'unisex' | 'kids';
}

export class UpdateServiceSuggestionDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Service suggestion name must be at least 2 characters' })
  @MaxLength(200, { message: 'Service suggestion name cannot exceed 200 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Estimated price must be non-negative' })
  estimatedPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(15, { message: 'Estimated duration must be at least 15 minutes' })
  @Max(480, { message: 'Estimated duration cannot exceed 480 minutes' })
  estimatedDuration?: number;

  @IsOptional()
  @IsEnum(['men', 'women', 'unisex', 'kids'], { message: 'Target gender must be one of: men, women, unisex, kids' })
  targetGender?: 'men' | 'women' | 'unisex' | 'kids';

  @IsOptional()
  @IsEnum(ServiceSuggestionStatus, { message: 'Status must be one of: pending, approved, rejected, implemented' })
  status?: ServiceSuggestionStatus;
}

export class UpdateServiceSuggestionStatusDto {
  @IsEnum(ServiceSuggestionStatus, { message: 'Status must be one of: pending, approved, rejected, implemented' })
  status: ServiceSuggestionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Admin note cannot exceed 500 characters' })
  adminNote?: string;
}
