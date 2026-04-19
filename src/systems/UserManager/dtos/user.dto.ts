// ============================================
// USER & PROFILE DTOs
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
} from 'class-validator';
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
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PHONE_REGEX = /^\d{8}$/;
const PLACE_ID_REGEX = /^[A-Za-z0-9_-]+$/;

// ERROR MESSAGES

export const PASSWORD_VALIDATION_MESSAGE =
  'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)';

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
    invalid: 'Please provide a valid phone number (exactly 8 digits)',
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
  coverImage: {
    invalid: 'Cover image must be a valid URL',
  },
  login: {
    emailOrPhone: 'Email or phone number is required',
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

  @IsOptional()
  @IsString({ message: 'Place name must be a string' })
  @MaxLength(200, { message: 'Place name must not exceed 200 characters' })
  public placeName?: string;
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
  @IsOptional()
  @IsEmail({}, { message: VALIDATION_MESSAGES.email.invalid })
  public email?: string;

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
  public emailVerification?: Array<{ isVerified: boolean; verifCode?: string }> = [{ isVerified: true }];

  @IsOptional()
  @IsString()
  public deviceName?: string;
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
  @IsString({ message: 'Theme must be a string' })
  @MaxLength(50, { message: 'Theme name cannot exceed 50 characters' })
  public theme?: string;

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
  @IsUrl({}, { message: VALIDATION_MESSAGES.coverImage.invalid })
  public coverImage?: string;

  @IsOptional()
  public isBlocked?: boolean;

  @IsOptional()
  public emailVerification?: Array<{ isVerified: boolean; verifCode?: string }>;
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

export class UpdateThemeDto {
  @IsString({ message: 'Theme name must be a string' })
  @IsNotEmpty({ message: 'Theme name is required' })
  @MaxLength(50, { message: 'Theme name cannot exceed 50 characters' })
  public theme: string;
}

export class UpdateLanguageDto {
  @IsString({ message: 'Language must be a string' })
  @IsNotEmpty({ message: 'Language is required' })
  @MaxLength(10, { message: 'Language code cannot exceed 10 characters' })
  public language: string;
}
