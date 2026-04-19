import { IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { ReportStatus } from '@interfaces/content/content.interface';

export class CreateReportDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class ReviewReportDto {
  @IsEnum(ReportStatus)
  status!: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
