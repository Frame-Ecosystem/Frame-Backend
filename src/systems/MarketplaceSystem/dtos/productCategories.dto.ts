import { IsString, IsOptional, MaxLength, MinLength, IsBoolean, IsInt, Min, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ProductCategoryImageDto {
  @IsOptional() @IsString() @MaxLength(500)
  url?: string;

  @IsOptional() @IsString() @MaxLength(255)
  publicId?: string;
}

export class CreateProductCategoryDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  icon?: string;

  @IsOptional() @ValidateNested() @Type(() => ProductCategoryImageDto)
  image?: ProductCategoryImageDto;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsInt() @Min(0)
  displayOrder?: number;
}

export class UpdateProductCategoryDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  icon?: string;

  @IsOptional() @ValidateNested() @Type(() => ProductCategoryImageDto)
  image?: ProductCategoryImageDto;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsInt() @Min(0)
  displayOrder?: number;
}
