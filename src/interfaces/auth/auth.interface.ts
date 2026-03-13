import { Request } from 'express';
import { Document } from 'mongoose';
import { User } from '@interfaces/user/users.interface';

export interface DataStoredInToken {
  _id: string;
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
  user: User & Document;
}
