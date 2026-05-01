import { IsMongoId, IsNumber, IsOptional, Min } from 'class-validator';

export class AddToCartDto {
  @IsMongoId({ message: 'Invalid product ID' })
  productId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  variantIndex?: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class UpdateCartItemDto {
  @IsNumber()
  @Min(0)
  quantity: number;
}
