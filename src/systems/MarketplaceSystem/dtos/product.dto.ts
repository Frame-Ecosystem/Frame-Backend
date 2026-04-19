import {
  IsString, IsOptional, IsEnum, IsNumber, IsArray, IsBoolean, MaxLength, MinLength,
  Min, Max, ValidateNested, ArrayMaxSize, IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCategory, ProductCondition } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

class ProductVariantDto {
  @IsOptional() @IsString() @MaxLength(50)
  sku?: string;

  @IsString() @MinLength(1) @MaxLength(100)
  name: string;

  @IsNumber() @Min(0)
  price: number;

  @IsOptional() @IsNumber() @Min(0)
  compareAtPrice?: number;

  @IsNumber() @Min(0)
  stock: number;

  @IsOptional()
  attributes?: Record<string, string>;
}

class ProductDimensionsDto {
  @IsOptional() @IsNumber() @Min(0) length?: number;
  @IsOptional() @IsNumber() @Min(0) width?: number;
  @IsOptional() @IsNumber() @Min(0) height?: number;
}

export class CreateProductDto {
  @IsMongoId({ message: 'Invalid store ID' })
  storeId: string;

  @IsString() @MinLength(2) @MaxLength(200)
  name: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsEnum(ProductCategory, { message: 'Invalid product category' })
  category: ProductCategory;

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20)
  tags?: string[];

  @IsNumber() @Min(0)
  price: number;

  @IsOptional() @IsNumber() @Min(0)
  compareAtPrice?: number;

  @IsOptional() @IsString() @MaxLength(10)
  currency?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductVariantDto) @ArrayMaxSize(50)
  variants?: ProductVariantDto[];

  @IsOptional() @IsNumber() @Min(0)
  stock?: number;

  @IsOptional() @IsString() @MaxLength(50)
  sku?: string;

  @IsOptional() @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @IsOptional() @IsBoolean()
  isDigital?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  weight?: number;

  @IsOptional() @ValidateNested() @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsEnum(ProductCategory, { message: 'Invalid product category' })
  category?: ProductCategory;

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20)
  tags?: string[];

  @IsOptional() @IsNumber() @Min(0)
  price?: number;

  @IsOptional() @IsNumber() @Min(0)
  compareAtPrice?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductVariantDto) @ArrayMaxSize(50)
  variants?: ProductVariantDto[];

  @IsOptional() @IsNumber() @Min(0)
  stock?: number;

  @IsOptional() @IsString() @MaxLength(50)
  sku?: string;

  @IsOptional() @IsEnum(['draft', 'active', 'archived'], { message: 'Status must be draft, active, or archived' })
  status?: string;

  @IsOptional() @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @IsOptional() @IsBoolean()
  isDigital?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  weight?: number;

  @IsOptional() @ValidateNested() @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;
}

export class AdminUpdateProductStatusDto {
  @IsEnum(['active', 'hidden'], { message: 'Status must be active or hidden' })
  status: string;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}
