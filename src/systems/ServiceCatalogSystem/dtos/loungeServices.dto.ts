import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, IsArray, Min, MaxLength } from 'class-validator';
import { ServiceLoungeGender, LoungeServiceStatus } from '@systems/ServiceCatalogSystem/interfaces/loungeService.interface';

export class CreateLoungeServiceDto {
  @IsString()
  loungeId: string;

  @IsString()
  serviceId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  agentIds?: string[];

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
  @IsArray()
  @IsString({ each: true })
  agentIds?: string[];

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
