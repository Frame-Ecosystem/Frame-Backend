import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SearchType } from '@systems/FeedContentSystem/interfaces/search.interface';

export class SearchDto {
  @IsString()
  public q: string;

  @IsOptional()
  @IsEnum(SearchType)
  public type?: SearchType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  public limit?: number;
}
