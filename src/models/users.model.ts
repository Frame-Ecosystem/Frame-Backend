import { model, Schema, Document } from 'mongoose';
import { User } from '@interfaces/users.interface';

const userSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: false,
  },
  role: {
    type: String,
    enum: ['admin', 'user', 'barber'],
    default: 'user',
    required: false,
  },
  location: {
    type: {
      latitude: {
        type: Number,
        required: false,
      },
      longitude: {
        type: Number,
        required: false,
      },
      address: {
        type: String,
        required: false,
      },
      placeId: {
        type: String,
        required: false,
      },
    },
    required: false,
  },
  profileImage: {
    type: String,
    required: false,
  },
  refreshTokens: [
    {
      jti: { type: String, required: true },
      tokenHash: { type: String, required: true },
      userAgent: { type: String, required: false },
      ip: { type: String, required: false },
      deviceName: { type: String, required: false },
      createdAt: { type: Date, required: true },
      expiresAt: { type: Date, required: true },
    },
  ],
});

const userModel = model<User & Document>('User', userSchema);

export default userModel;
