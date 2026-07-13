import { IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpsertRatingDto {
  @IsMongoId({ message: 'Invalid target ID format' })
  targetId: string;

  @IsInt({ message: 'Score must be an integer' })
  @Min(1, { message: 'Score must be at least 1' })
  @Max(5, { message: 'Score cannot exceed 5' })
  score: number;

  @IsOptional()
  @IsString({ message: 'Comment must be a string' })
  @MaxLength(1000, { message: 'Comment cannot exceed 1000 characters' })
  comment?: string;
}
