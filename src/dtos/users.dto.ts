import { IsEmail, IsString, IsEnum, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class LocationDto {
  @IsNumber()
  public latitude: number;

  @IsNumber()
  public longitude: number;

  @IsString()
  public address: string;

  @IsString()
  public placeId: string;
}

export class CreateUserDto {
  @IsEmail()
  public email: string;

  @IsString()
  public password: string;

  @IsString()
  public username: string;

  @IsString()
  public phoneNumber: string;

  @IsOptional()
  @IsEnum(UserGender)
  public gender?: UserGender;

  @IsOptional()
  @IsEnum(UserRole)
  public role?: UserRole;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  public location?: LocationDto;
}

export class LoginUserDto {
  @IsString()
  public emailOrUsername: string;

  @IsString()
  public password: string;
}
