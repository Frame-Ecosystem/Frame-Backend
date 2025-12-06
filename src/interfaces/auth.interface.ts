import { Request } from 'express';
import { User } from '@interfaces/users.interface';

export interface DataStoredInToken {
  _id: string;
  role?: string;
}

export interface RefreshTokenPayload {
  _id: string;
  jti: string; // Unique token ID for rotation/reuse detection
}

export interface TokenData {
  token: string;
  expiresIn: number;
}

export interface RequestWithUser extends Request {
  user: User;
}
