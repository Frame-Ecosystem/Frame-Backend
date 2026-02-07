import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  agentName: string;

  @IsString()
  password: string;

  @IsString()
  loungeId: string;

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @IsOptional()
  @IsString()
  profileImage?: string; // Base64 encoded image string
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  agentName?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
