import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsNotEmpty, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PASSWORD_REGEX, PASSWORD_VALIDATION_MESSAGE } from '@systems/UserManager/dtos/user.dto';

export class AdminUserIdParamDto {
  @IsMongoId({ message: 'userId must be a valid MongoDB ObjectId' })
  public userId: string;
}

export class GetUserActivityLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(1000, { message: 'limit must not exceed 1000' })
  public limit?: number;
}

export class ResetUserPasswordDto {
  @IsString({ message: 'newPassword is required' })
  @IsNotEmpty({ message: 'newPassword is required' })
  @MinLength(8, { message: 'newPassword must be at least 8 characters' })
  @MaxLength(128, { message: 'newPassword must not exceed 128 characters' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_VALIDATION_MESSAGE })
  public newPassword: string;
}

export class CreateAuditLogDto {
  @IsString({ message: 'action is required' })
  @IsNotEmpty({ message: 'action is required' })
  @MaxLength(120, { message: 'action must not exceed 120 characters' })
  public action: string;

  @IsOptional()
  @IsObject({ message: 'details must be an object when provided' })
  public details?: Record<string, unknown>;
}
