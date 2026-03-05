import { IsString, IsOptional, IsBoolean, IsArray, ArrayNotEmpty } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  agentName: string;

  @IsString()
  password: string;

  @IsString()
  loungeId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  idLoungeService: string[]; // List of lounge service IDs

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
