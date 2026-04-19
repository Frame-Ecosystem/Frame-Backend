import { IsMongoId, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsMongoId({ message: 'Invalid product ID' })
  productId: string;

  @IsMongoId({ message: 'Invalid order ID' })
  orderId: string;

  @IsNumber() @Min(1) @Max(5)
  rating: number;

  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  comment?: string;
}

export class UpdateReviewDto {
  @IsOptional() @IsNumber() @Min(1) @Max(5)
  rating?: number;

  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  comment?: string;
}
