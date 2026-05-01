import { IsString, IsOptional, IsBoolean, IsArray, ArrayNotEmpty, IsEmail, MinLength, Matches, IsMongoId } from 'class-validator';

/**
 * Agent password strength rules: 8\u201364 chars, at least one uppercase, one lowercase,
 * one digit, and one special character. Mirrors the public CreateUserDto regex so
 * that agents (which are User documents with type='agent') can authenticate via
 * the standard /v1/auth/login flow.
 */
const AGENT_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,64}$/;

/**
 * Payload accepted by `POST /v1/agents` (admin or lounge only).
 *
 * Agents are created exclusively by Lounge owners (auto-bound to that lounge)
 * or Admins (must specify `parentLounge`). They log in like any other user with
 * `email` + `password` against `/v1/auth/login`.
 */
export class CreateAgentDto {
  /** Login email \u2014 required so the agent can authenticate. */
  @IsEmail()
  email: string;

  /** Login password \u2014 hashed with bcrypt before storage. */
  @IsString()
  @MinLength(8)
  @Matches(AGENT_PASSWORD_REGEX, {
    message: 'Password must be 8\u201364 chars with at least one uppercase, lowercase, digit and special character',
  })
  password: string;

  /** Optional display name shown in the queue UI (e.g. "Agent Sarah"). */
  @IsOptional()
  @IsString()
  agentName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  /**
   * Parent lounge id. Required when an Admin creates the agent; ignored for
   * Lounge users (controller auto-binds it to the authenticated lounge).
   */
  @IsOptional()
  @IsMongoId()
  parentLounge?: string;

  /** Lounge services this agent is qualified to perform. Must belong to `parentLounge`. */
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  services: string[];

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptQueueBooking?: boolean;

  /** Optional base64-encoded profile image. */
  @IsOptional()
  @IsString()
  profileImage?: string;
}

/** Payload accepted by `PUT /v1/agents/:agentId` (admin or owning lounge only). */
export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  agentName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(AGENT_PASSWORD_REGEX, {
    message: 'Password must be 8\u201364 chars with at least one uppercase, lowercase, digit and special character',
  })
  password?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  services?: string[];

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptQueueBooking?: boolean;
}

/** Payload accepted by `PATCH /v1/agents/me` (agent self-service). */
export class UpdateAgentSelfDto {
  @IsOptional()
  @IsString()
  agentName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}

/** Payload accepted by `PATCH /v1/agents/me/availability` (agent self-service). */
export class ToggleAvailabilityDto {
  @IsBoolean()
  acceptQueueBooking: boolean;
}
