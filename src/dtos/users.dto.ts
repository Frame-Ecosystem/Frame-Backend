// ============================================
// EMAIL VERIFICATION DTO
// ============================================
import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  ValidateNested,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
  Min,
  Max,
  IsUrl,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class SendVerificationEmailDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @IsNotEmpty({ message: 'Email is required' })
  public email: string;
}

export class VerifyEmailCodeDto {
  @IsString({ message: 'Verification code is required' })
  @IsNotEmpty({ message: 'Verification code is required' })
  public code: string;
}

import { Type } from 'class-transformer';

// ENUMS

export enum UserType {
  USER = 'user',
  CLIENT = 'client',
  LOUNGE = 'lounge',
}

export enum UserGender {
  MALE = 'male',
  FEMALE = 'female',
  UNISEX = 'unisex',
  KIDS = 'kids',
}

// VALIDATION REGEX PATTERNS

/**
 * Password must contain:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (@$!%*?&)
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Phone number:
 * - International format with optional +
 * - 8-15 digits
 */
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

/**
 * Google Place ID format (for location validation)
 */
const PLACE_ID_REGEX = /^[A-Za-z0-9_-]+$/;

// ERROR MESSAGES

const VALIDATION_MESSAGES = {
  email: {
    invalid: 'Please provide a valid email address',
    required: 'Email is required',
  },
  password: {
    invalid: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)',
    required: 'Password is required',
    minLength: 'Password must be at least 8 characters',
    maxLength: 'Password cannot exceed 128 characters',
  },
  phoneNumber: {
    invalid: 'Please provide a valid phone number (e.g., +21612345678)',
    required: 'Phone number is required',
  },
  gender: {
    invalid: 'Gender must be one of: male, female, unisex, kids',
  },
  type: {
    invalid: 'Type must be one of: user, client, lounge',
  },
  location: {
    latitude: {
      invalid: 'Latitude must be between -90 and 90',
      required: 'Latitude is required for location',
    },
    longitude: {
      invalid: 'Longitude must be between -180 and 180',
      required: 'Longitude is required for location',
    },
    address: {
      required: 'Address is required for location',
      maxLength: 'Address cannot exceed 500 characters',
    },
    placeId: {
      invalid: 'Invalid place ID format',
      required: 'Place ID is required for location',
    },
  },
  profileImage: {
    invalid: 'Profile image must be a valid URL',
  },
  login: {
    email: 'Email is required',
    password: 'Password is required',
  },
};

// LOCATION DTO

export class LocationDto {
  @IsNumber({}, { message: VALIDATION_MESSAGES.location.latitude.invalid })
  @Min(-90, { message: VALIDATION_MESSAGES.location.latitude.invalid })
  @Max(90, { message: VALIDATION_MESSAGES.location.latitude.invalid })
  public latitude: number;

  @IsNumber({}, { message: VALIDATION_MESSAGES.location.longitude.invalid })
  @Min(-180, { message: VALIDATION_MESSAGES.location.longitude.invalid })
  @Max(180, { message: VALIDATION_MESSAGES.location.longitude.invalid })
  public longitude: number;

  @IsString({ message: VALIDATION_MESSAGES.location.address.required })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.location.address.required })
  @MaxLength(500, { message: VALIDATION_MESSAGES.location.address.maxLength })
  public address: string;

  @IsString({ message: VALIDATION_MESSAGES.location.placeId.required })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.location.placeId.required })
  @Matches(PLACE_ID_REGEX, { message: VALIDATION_MESSAGES.location.placeId.invalid })
  public placeId: string;
}

// OPENING HOURS DTO

export class OpeningHoursDto {
  @IsOptional()
  @IsString({ message: 'Opening time must be in HH:MM format' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Opening time must be in HH:MM format' })
  public from?: string;

  @IsOptional()
  @IsString({ message: 'Closing time must be in HH:MM format' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Closing time must be in HH:MM format' })
  public to?: string;
}

export class DayOpeningHoursDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  public monday?: OpeningHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  public tuesday?: OpeningHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  public wednesday?: OpeningHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  public thursday?: OpeningHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  public friday?: OpeningHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  public saturday?: OpeningHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  public sunday?: OpeningHoursDto;
}

// CREATE USER DTO (Signup)

export class CreateUserDto {
  @IsEmail({}, { message: VALIDATION_MESSAGES.email.invalid })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.email.required })
  public email: string;

  @IsString({ message: VALIDATION_MESSAGES.password.required })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.password.required })
  @MinLength(8, { message: VALIDATION_MESSAGES.password.minLength })
  @MaxLength(128, { message: VALIDATION_MESSAGES.password.maxLength })
  @Matches(PASSWORD_REGEX, { message: VALIDATION_MESSAGES.password.invalid })
  public password: string;

  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.phoneNumber.required })
  @Matches(PHONE_REGEX, { message: VALIDATION_MESSAGES.phoneNumber.invalid })
  public phoneNumber?: string;

  @IsOptional()
  @IsEnum(UserGender, { message: VALIDATION_MESSAGES.gender.invalid })
  public gender?: UserGender;

  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters' })
  public firstName?: string;

  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters' })
  public lastName?: string;

  @IsOptional()
  @IsString({ message: 'Lounge title must be a string' })
  @MaxLength(100, { message: 'Lounge title cannot exceed 100 characters' })
  public LoungeTitle?: string;

  // Type is optional - determines user inheritance (client, lounge, or regular user)
  @IsOptional()
  @IsEnum(UserType, { message: VALIDATION_MESSAGES.type.invalid })
  public type?: UserType;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  public location?: LocationDto;

  @IsOptional()
  @IsUrl({}, { message: VALIDATION_MESSAGES.profileImage.invalid })
  public profileImage?: string;

  @IsOptional()
  public isBlocked?: boolean = false;

  @IsOptional()
  public emailVerification?: Array<{ isVerified: boolean; verifCode?: string }> = [{ isVerified: false }];
}

// UPDATE USER DTO (Partial updates)

export class UpdateUserDto {
  // Explicitly block sensitive fields that should never be updated via this DTO
  // These will cause validation to fail if included in the request
  @IsOptional()
  @Matches(/^$/, { message: 'Password cannot be updated through this endpoint. Use change-password endpoint.' })
  public password?: never;

  // Note: User type cannot be changed after creation (Mongoose discriminator limitation)

  @IsOptional()
  @IsEmail({}, { message: VALIDATION_MESSAGES.email.invalid })
  public email?: string;

  @IsOptional()
  @Matches(PHONE_REGEX, { message: VALIDATION_MESSAGES.phoneNumber.invalid })
  public phoneNumber?: string;

  @IsOptional()
  @IsEnum(UserGender, { message: VALIDATION_MESSAGES.gender.invalid })
  public gender?: UserGender;

  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters' })
  public firstName?: string;

  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters' })
  public lastName?: string;

  @IsOptional()
  @IsString({ message: 'Bio must be a string' })
  @MaxLength(500, { message: 'Bio cannot exceed 500 characters' })
  public bio?: string;

  @IsOptional()
  @IsString({ message: 'Lounge title must be a string' })
  @MaxLength(100, { message: 'Lounge title cannot exceed 100 characters' })
  public loungeTitle?: string;

  // Note: User type is set during OAuth signup and cannot be changed

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  public location?: LocationDto;

  @IsOptional()
  @IsUrl({}, { message: VALIDATION_MESSAGES.profileImage.invalid })
  public profileImage?: string;

  @IsOptional()
  public isBlocked?: boolean;

  @IsOptional()
  public emailVerification?: Array<{ isVerified: boolean; verifCode?: string }>;
}

// UPDATE LOCATION DTO

export class UpdateLocationDto {
  @IsNumber({}, { message: VALIDATION_MESSAGES.location.latitude.invalid })
  @Min(-90, { message: VALIDATION_MESSAGES.location.latitude.invalid })
  @Max(90, { message: VALIDATION_MESSAGES.location.latitude.invalid })
  public latitude: number;

  @IsNumber({}, { message: VALIDATION_MESSAGES.location.longitude.invalid })
  @Min(-180, { message: VALIDATION_MESSAGES.location.longitude.invalid })
  @Max(180, { message: VALIDATION_MESSAGES.location.longitude.invalid })
  public longitude: number;

  @IsString({ message: VALIDATION_MESSAGES.location.address.required })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.location.address.required })
  @MaxLength(500, { message: VALIDATION_MESSAGES.location.address.maxLength })
  public address: string;

  @IsString({ message: VALIDATION_MESSAGES.location.placeId.required })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.location.placeId.required })
  @Matches(PLACE_ID_REGEX, { message: VALIDATION_MESSAGES.location.placeId.invalid })
  public placeId: string;
}

// LOGIN USER DTO

export class LoginUserDto {
  @IsEmail({}, { message: VALIDATION_MESSAGES.email.invalid })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.email.required })
  public email: string;

  @IsString({ message: VALIDATION_MESSAGES.login.password })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.login.password })
  public password: string;
}

// CHANGE PASSWORD DTO

export class ChangePasswordDto {
  @IsString({ message: 'Current password is required' })
  @IsNotEmpty({ message: 'Current password is required' })
  public currentPassword: string;

  @IsString({ message: VALIDATION_MESSAGES.password.required })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.password.required })
  @MinLength(8, { message: VALIDATION_MESSAGES.password.minLength })
  @MaxLength(128, { message: VALIDATION_MESSAGES.password.maxLength })
  @Matches(PASSWORD_REGEX, { message: VALIDATION_MESSAGES.password.invalid })
  public newPassword: string;

  @IsString({ message: 'Password confirmation is required' })
  @IsNotEmpty({ message: 'Password confirmation is required' })
  public newPasswordConfirm: string;
}

// SESSION ID DTO (for revoking sessions)

export class SessionIdDto {
  @IsString({ message: 'Session ID is required' })
  @IsNotEmpty({ message: 'Session ID is required' })
  public sessionId: string;
}

// DELETE ACCOUNT DTO (for self-deletion)

export class DeleteAccountDto {
  @IsString({ message: 'Password is required to delete account' })
  @IsNotEmpty({ message: 'Password is required to delete account' })
  public password: string;
}

// (Operating hours DTO removed)

// UPDATE LOUNGE PROFILE DTO

export class UpdateLoungeProfileDto {
  @IsOptional()
  @IsString({ message: 'Lounge title must be a string' })
  @MaxLength(100, { message: 'Lounge title cannot exceed 100 characters' })
  public loungeTitle?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayOpeningHoursDto)
  public openingHours?: DayOpeningHoursDto;
}

// UPDATE CLIENT PROFILE DTO

export class UpdateClientProfileDto {
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters' })
  public firstName?: string;

  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters' })
  public lastName?: string;
}

// SERVICE DTOs

export enum ServiceStatusDto {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum ServiceSuggestionStatusDto {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IMPLEMENTED = 'implemented',
}

export class CreateServiceCategoryDto {
  @IsString({ message: 'Category name is required' })
  @IsNotEmpty({ message: 'Category name cannot be empty' })
  @MaxLength(100, { message: 'Category name cannot exceed 100 characters' })
  public name: string;
}

export class UpdateServiceCategoryDto {
  @IsOptional()
  @IsString({ message: 'Category name must be a string' })
  @MaxLength(100, { message: 'Category name cannot exceed 100 characters' })
  public name?: string;
}

export class CreateServiceDto {
  @IsString({ message: 'Service name is required' })
  @IsNotEmpty({ message: 'Service name cannot be empty' })
  @MaxLength(100, { message: 'Service name cannot exceed 100 characters' })
  public name: string;

  @IsString({ message: 'Service slug is required' })
  @IsNotEmpty({ message: 'Service slug cannot be empty' })
  @MaxLength(100, { message: 'Service slug cannot exceed 100 characters' })
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
  public slug: string;

  @IsString({ message: 'Category ID is required' })
  @IsNotEmpty({ message: 'Category ID cannot be empty' })
  public categoryId: string;

  @IsOptional()
  @IsNumber({}, { message: 'Base duration must be a number' })
  @Min(1, { message: 'Base duration must be at least 1 minute' })
  public baseDuration?: number;

  @IsOptional()
  @IsEnum(ServiceStatusDto, { message: 'Status must be one of: active, inactive' })
  public status?: ServiceStatusDto = ServiceStatusDto.ACTIVE;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString({ message: 'Service name must be a string' })
  @MaxLength(100, { message: 'Service name cannot exceed 100 characters' })
  public name?: string;

  @IsOptional()
  @IsString({ message: 'Service slug must be a string' })
  @MaxLength(100, { message: 'Service slug cannot exceed 100 characters' })
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
  public slug?: string;

  @IsOptional()
  @IsString({ message: 'Category ID must be a string' })
  public categoryId?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Base duration must be a number' })
  @Min(1, { message: 'Base duration must be at least 1 minute' })
  public baseDuration?: number;

  @IsOptional()
  @IsEnum(ServiceStatusDto, { message: 'Status must be one of: active, inactive' })
  public status?: ServiceStatusDto;
}

export class CreateServiceSuggestionDto {
  @IsString({ message: 'Service name is required' })
  @IsNotEmpty({ message: 'Service name cannot be empty' })
  @MaxLength(200, { message: 'Service name cannot exceed 200 characters' })
  public name: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  public description?: string;
}

export class UpdateServiceSuggestionDto {
  @IsOptional()
  @IsString({ message: 'Service name must be a string' })
  @MaxLength(200, { message: 'Service name cannot exceed 200 characters' })
  public name?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  public description?: string;

  @IsOptional()
  @IsEnum(ServiceSuggestionStatusDto, { message: 'Status must be one of: pending, approved, rejected, implemented' })
  public status?: ServiceSuggestionStatusDto;
}

// LOUNGE SERVICE DTOs

export class CreateLoungeServiceDto {
  @IsString({ message: 'Service ID is required' })
  @IsNotEmpty({ message: 'Service ID cannot be empty' })
  public serviceId: string;

  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price cannot be negative' })
  public price: number;

  @IsNumber({}, { message: 'Duration must be a number' })
  @Min(1, { message: 'Duration must be at least 1 minute' })
  public duration: number;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  public description?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  public isActive?: boolean = true;
}

export class UpdateLoungeServiceDto {
  @IsOptional()
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price cannot be negative' })
  public price?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Duration must be a number' })
  @Min(1, { message: 'Duration must be at least 1 minute' })
  public duration?: number;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  public description?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  public isActive?: boolean;
}
