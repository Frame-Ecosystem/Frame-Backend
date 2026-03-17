import { IsString, IsOptional, IsArray, MaxLength, ArrayMaxSize } from 'class-validator';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  text?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  hashtags?: string[];
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  text?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  hashtags?: string[];
}
