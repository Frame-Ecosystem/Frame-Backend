import { IsString, IsEnum, IsOptional, IsInt, Min, MaxLength, MinLength } from 'class-validator';
import { ServiceStatus } from '@interfaces/service.interface';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  categoryId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  baseDuration?: number;

  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  baseDuration?: number;

  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;
}
