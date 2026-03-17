import { IsString, IsOptional, MaxLength, IsMongoId } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MaxLength(1000)
  text: string;

  @IsOptional()
  @IsMongoId()
  parentCommentId?: string;
}
