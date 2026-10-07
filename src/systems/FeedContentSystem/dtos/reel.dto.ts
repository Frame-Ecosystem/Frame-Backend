import { IsString, IsOptional, IsArray, IsNumber, MaxLength, ArrayMaxSize, Min, Max } from 'class-validator';
import { MAX_REEL_DURATION_SECONDS } from '@systems/FeedContentSystem/contentLimits';

export class CreateReelDto {
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsNumber()
  @Min(1)
  @Max(MAX_REEL_DURATION_SECONDS)
  duration!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  hashtags?: string[];
}

export class UpdateReelDto {
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  hashtags?: string[];
}
