import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsMongoId, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

class ShippingAddressDto {
  @IsString()
  @MaxLength(100)
  fullName: string;

  @IsString()
  @MaxLength(20)
  phone: string;

  @IsString()
  @MaxLength(300)
  address: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

class OrderItemDto {
  @IsMongoId()
  productId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  variantIndex?: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsMongoId({ message: 'Invalid store ID' })
  storeId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsEnum(PaymentMethod, { message: 'Invalid payment method' })
  paymentMethod: PaymentMethod;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], {
    message: 'Invalid order status transition',
  })
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;
}

export class DisputeOrderDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class ResolveDisputeDto {
  @IsEnum(['refunded', 'delivered', 'cancelled'], { message: 'Resolution must be refunded, delivered, or cancelled' })
  resolution: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;
}
