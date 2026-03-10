import { IsOptional, IsMongoId, IsNumber, Min, Max } from 'class-validator';

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
