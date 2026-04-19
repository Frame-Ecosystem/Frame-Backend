import { IsOptional, IsMongoId, IsNumber, Min, Max, IsString, IsIn, IsNotEmpty } from 'class-validator';

export class GetNotificationsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  public page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  public limit?: number;
}

export class MarkNotificationsReadDto {
  @IsOptional()
  @IsMongoId({ each: true, message: 'Each notification ID must be a valid MongoDB ObjectId' })
  public notificationIds?: string[];
}

export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'FCM token is required' })
  public token: string;

  @IsString()
  @IsNotEmpty({ message: 'Device ID is required' })
  public deviceId: string;

  @IsString()
  @IsIn(['ios', 'android', 'web'], { message: 'Platform must be ios, android, or web' })
  public platform: 'ios' | 'android' | 'web';
}

export class UnregisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Device ID is required' })
  public deviceId: string;
}
