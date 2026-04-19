// ============================================
// AUTHENTICATION DTOs
// ============================================
import { IsEmail, IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { PASSWORD_REGEX, PASSWORD_VALIDATION_MESSAGE } from '@systems/UserManager/dtos/user.dto';

// SEND VERIFICATION EMAIL DTO

export class SendVerificationEmailDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @IsNotEmpty({ message: 'Email is required' })
  public email: string;
}

// VERIFY EMAIL CODE DTO

export class VerifyEmailCodeDto {
  @IsString({ message: 'Verification code is required' })
  @IsNotEmpty({ message: 'Verification code is required' })
  public code: string;
}

// FORGOT PASSWORD DTO

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @IsNotEmpty({ message: 'Email is required' })
  public email: string;
}

// RESET PASSWORD DTO

export class ResetPasswordDto {
  @IsString({ message: 'Reset token is required' })
  @IsNotEmpty({ message: 'Reset token is required' })
  public token: string;

  @IsString({ message: 'New password is required' })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password cannot exceed 128 characters' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_VALIDATION_MESSAGE })
  public newPassword: string;
}

// LOGIN USER DTO

export class LoginUserDto {
  @IsString({ message: 'Email or phone number is required' })
  @IsNotEmpty({ message: 'Email or phone number is required' })
  public emailOrPhone: string;

  @IsString({ message: 'Password is required' })
  @IsNotEmpty({ message: 'Password is required' })
  public password: string;

  @IsOptional()
  @IsString()
  public deviceName?: string;
}

// SESSION ID DTO (for revoking sessions)

export class SessionIdDto {
  @IsString({ message: 'Session ID is required' })
  @IsNotEmpty({ message: 'Session ID is required' })
  public sessionId: string;
}
