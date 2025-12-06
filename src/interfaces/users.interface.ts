export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  placeId: string;
}

export interface RefreshTokenSession {
  jti: string;
  tokenHash: string;
  userAgent?: string;
  ip?: string;
  deviceName?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface User {
  _id: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'barber';
  username: string;
  phoneNumber: string;
  gender: 'male' | 'female' | 'other';
  location?: Location;
  profileImage?: string;
  refreshTokens?: RefreshTokenSession[]; // Multi-device session support
}
