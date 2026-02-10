import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, Min, MaxLength } from 'class-validator';
import { ServiceLoungeGender, LoungeServiceStatus } from '@interfaces/loungeService.interface';

export class CreateLoungeServiceDto {
  @IsString()
  loungeId: string;

  @IsString()
  serviceId: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(1)
  duration: number;

  @IsEnum(ServiceLoungeGender)
  gender: ServiceLoungeGender;

  @IsOptional()
  @IsEnum(LoungeServiceStatus)
  status?: LoungeServiceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLoungeServiceDto {
  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsEnum(ServiceLoungeGender)
  gender?: ServiceLoungeGender;

  @IsOptional()
  @IsEnum(LoungeServiceStatus)
  status?: LoungeServiceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
