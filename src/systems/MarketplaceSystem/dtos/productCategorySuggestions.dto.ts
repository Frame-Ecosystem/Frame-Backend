import { IsString, IsEnum, IsOptional, MaxLength, MinLength, IsArray, ArrayMaxSize, IsInt, Min } from 'class-validator';
import { ProductCategorySuggestionStatus } from '@systems/MarketplaceSystem/interfaces/productCategory.interface';

export class CreateProductCategorySuggestionDto {
  @IsString()
  @MinLength(2, { message: 'Category name must be at least 2 characters' })
  @MaxLength(100, { message: 'Category name cannot exceed 100 characters' })
  name: string;

  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters' })
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description: string;

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(10)
  exampleProducts?: string[];

  @IsOptional() @IsString() @MaxLength(100)
  iconHint?: string;
}

export class UpdateProductCategorySuggestionDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MinLength(10) @MaxLength(1000)
  description?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(10)
  exampleProducts?: string[];

  @IsOptional() @IsString() @MaxLength(100)
  iconHint?: string;
}

/**
 * Sent by an admin to update a suggestion status.
 * If `status === IMPLEMENTED`, the suggestion is auto-converted into a
 * real ProductCategory using the optional overrides below (or the
 * suggestion's own values as defaults).
 */
export class UpdateProductCategorySuggestionStatusDto {
  @IsEnum(ProductCategorySuggestionStatus, {
    message: 'Status must be one of: pending, approved, rejected, implemented',
  })
  status: ProductCategorySuggestionStatus;

  @IsOptional() @IsString() @MaxLength(500)
  adminNote?: string;

  // Overrides used only when implementing
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  icon?: string;

  @IsOptional() @IsInt() @Min(0)
  displayOrder?: number;
}

/**
 * Convenience DTO: explicit "approve and implement now".
 * Status defaults to IMPLEMENTED when omitted.
 */
export class AdminApproveProductCategorySuggestionDto {
  @IsOptional()
  @IsEnum(ProductCategorySuggestionStatus)
  status?: ProductCategorySuggestionStatus;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  icon?: string;

  @IsOptional() @IsInt() @Min(0)
  displayOrder?: number;

  @IsOptional() @IsString() @MaxLength(500)
  adminNote?: string;
}
