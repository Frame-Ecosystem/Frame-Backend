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

// ============================================
// ENUMS
// ============================================

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  BARBER = 'barber',
}

export enum UserGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

// ============================================
// VALIDATION REGEX PATTERNS
// ============================================

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
 * Username rules:
 * - 3-30 characters
 * - Only alphanumeric, underscores, and hyphens
 * - Must start with a letter
 */
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]{2,29}$/;

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

// ============================================
// ERROR MESSAGES
// ============================================

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
  username: {
    invalid: 'Username must be 3-30 characters, start with a letter, and contain only letters, numbers, underscores, or hyphens',
    required: 'Username is required',
    minLength: 'Username must be at least 3 characters',
    maxLength: 'Username cannot exceed 30 characters',
  },
  phoneNumber: {
    invalid: 'Please provide a valid phone number (e.g., +21612345678)',
    required: 'Phone number is required',
  },
  gender: {
    invalid: 'Gender must be one of: male, female, other',
  },
  role: {
    invalid: 'Role must be one of: admin, user, barber',
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
    emailOrUsername: 'Email or username is required',
    password: 'Password is required',
  },
};

// ============================================
// LOCATION DTO
// ============================================

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

// ============================================
// CREATE USER DTO (Signup)
// ============================================

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

  @IsString({ message: VALIDATION_MESSAGES.username.required })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.username.required })
  @MinLength(3, { message: VALIDATION_MESSAGES.username.minLength })
  @MaxLength(30, { message: VALIDATION_MESSAGES.username.maxLength })
  @Matches(USERNAME_REGEX, { message: VALIDATION_MESSAGES.username.invalid })
  public username: string;

  @IsString({ message: VALIDATION_MESSAGES.phoneNumber.required })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.phoneNumber.required })
  @Matches(PHONE_REGEX, { message: VALIDATION_MESSAGES.phoneNumber.invalid })
  public phoneNumber: string;

  @IsOptional()
  @IsEnum(UserGender, { message: VALIDATION_MESSAGES.gender.invalid })
  public gender?: UserGender;

  // Role is optional for admin-created users
  @IsOptional()
  @IsEnum(UserRole, { message: VALIDATION_MESSAGES.role.invalid })
  public role?: UserRole;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  public location?: LocationDto;

  @IsOptional()
  @IsUrl({}, { message: VALIDATION_MESSAGES.profileImage.invalid })
  public profileImage?: string;
}

// ============================================
// UPDATE USER DTO (Partial updates)
// ============================================

export class UpdateUserDto {
  // Explicitly block sensitive fields that should never be updated via this DTO
  // These will cause validation to fail if included in the request
  @IsOptional()
  @Matches(/^$/, { message: 'Password cannot be updated through this endpoint. Use change-password endpoint.' })
  public password?: never;

  @IsOptional()
  @Matches(/^$/, { message: 'Role cannot be updated through this endpoint.' })
  public role?: never;

  @IsOptional()
  @IsEmail({}, { message: VALIDATION_MESSAGES.email.invalid })
  public email?: string;

  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.username.required })
  @MinLength(3, { message: VALIDATION_MESSAGES.username.minLength })
  @MaxLength(30, { message: VALIDATION_MESSAGES.username.maxLength })
  @Matches(USERNAME_REGEX, { message: VALIDATION_MESSAGES.username.invalid })
  public username?: string;

  @IsOptional()
  @Matches(PHONE_REGEX, { message: VALIDATION_MESSAGES.phoneNumber.invalid })
  public phoneNumber?: string;

  @IsOptional()
  @IsEnum(UserGender, { message: VALIDATION_MESSAGES.gender.invalid })
  public gender?: UserGender;

  // Note: role is intentionally excluded - users cannot change their own role
  // Role changes must be done by admin through a separate admin-only endpoint

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  public location?: LocationDto;

  @IsOptional()
  @IsUrl({}, { message: VALIDATION_MESSAGES.profileImage.invalid })
  public profileImage?: string;
}

// ============================================
// UPDATE LOCATION DTO
// ============================================

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

// ============================================
// LOGIN USER DTO
// ============================================

export class LoginUserDto {
  @IsString({ message: VALIDATION_MESSAGES.login.emailOrUsername })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.login.emailOrUsername })
  public emailOrUsername: string;

  @IsString({ message: VALIDATION_MESSAGES.login.password })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.login.password })
  public password: string;
}

// ============================================
// CHANGE PASSWORD DTO
// ============================================

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

// ============================================
// SESSION ID DTO (for revoking sessions)
// ============================================

export class SessionIdDto {
  @IsString({ message: 'Session ID is required' })
  @IsNotEmpty({ message: 'Session ID is required' })
  public sessionId: string;
}

// ============================================
// DELETE ACCOUNT DTO (for self-deletion)
// ============================================

export class DeleteAccountDto {
  @IsString({ message: 'Password is required to delete account' })
  @IsNotEmpty({ message: 'Password is required to delete account' })
  public password: string;
}
