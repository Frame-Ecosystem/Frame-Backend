import { IsString, IsOptional, IsNumber, MaxLength, MinLength, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  categoryId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  baseDuration?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  baseDuration?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
