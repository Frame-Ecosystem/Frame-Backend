import { IsString, IsBoolean, IsOptional, IsNumber, Min, MaxLength, MinLength, IsMongoId } from 'class-validator';

export class CreateExtraDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsBoolean()
  free: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  image?: string;
}

export class UpdateExtraDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  free?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  image?: string;
}

export class AdoptExtraDto {
  @IsMongoId()
  extraId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateAdoptedExtraDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
