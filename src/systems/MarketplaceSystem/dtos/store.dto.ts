import { IsString, IsOptional, IsEnum, IsEmail, IsNumber, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StoreCategory } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

class StoreLocationDto {
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
}

class StorePoliciesDto {
  @IsOptional() @IsString() @MaxLength(2000) returnPolicy?: string;
  @IsOptional() @IsString() @MaxLength(2000) shippingPolicy?: string;
}

export class CreateStoreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(StoreCategory, { message: 'Invalid store category' })
  category: StoreCategory;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreLocationDto)
  location?: StoreLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StorePoliciesDto)
  policies?: StorePoliciesDto;
}

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(StoreCategory, { message: 'Invalid store category' })
  category?: StoreCategory;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreLocationDto)
  location?: StoreLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StorePoliciesDto)
  policies?: StorePoliciesDto;
}

export class AdminUpdateStoreStatusDto {
  @IsEnum(['active', 'suspended', 'closed'], { message: 'Status must be active, suspended, or closed' })
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
