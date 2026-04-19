import { model, Schema, Document } from 'mongoose';
import { User, Client as IClient, Lounge as ILounge, Admin as IAdmin } from '@interfaces/user/user.interface';

// Base User Schema - shared by all user types
const userSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: function (this: any) {
        // Email is required if no phone number is provided
        return !this.phoneNumber;
      },
      unique: true,
      sparse: true, // Allows null values with unique constraint
    },
    type: {
      type: String,
      enum: ['user', 'client', 'lounge', 'admin'],
      default: 'user',
      required: true,
    },
    password: {
      type: String,
      // Require password only for non-OAuth users
      required: function (this: any) {
        const hasGoogleOAuth = !!(this.oauth && this.oauth.google && this.oauth.google.id);
        return !hasGoogleOAuth;
      },
    },
    phoneNumber: {
      type: String,
      required: function (this: any) {
        // Phone number is required if no email is provided
        return !this.email;
      },
      unique: true,
      sparse: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'unisex', 'kids'],
      default: 'unisex',
      required: false,
    },
    firstName: {
      type: String,
      required: false,
    },
    lastName: {
      type: String,
      required: false,
    },
    bio: {
      type: String,
      required: false,
    },
    theme: {
      type: String,
      default: 'silver-light',
      required: false,
    },
    language: {
      type: String,
      default: 'en',
      required: false,
    },
    loungeTitle: {
      type: String,
      required: false,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    followersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    openingHours: {
      monday: {
        from: { type: String, required: false },
        to: { type: String, required: false },
      },
      tuesday: {
        from: { type: String, required: false },
        to: { type: String, required: false },
      },
      wednesday: {
        from: { type: String, required: false },
        to: { type: String, required: false },
      },
      thursday: {
        from: { type: String, required: false },
        to: { type: String, required: false },
      },
      friday: {
        from: { type: String, required: false },
        to: { type: String, required: false },
      },
      saturday: {
        from: { type: String, required: false },
        to: { type: String, required: false },
      },
      sunday: {
        from: { type: String, required: false },
        to: { type: String, required: false },
      },
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
        placeName: {
          type: String,
          required: false,
        },
      },
      required: false,
    },
    profileImage: {
      url: { type: String, required: false },
      publicId: { type: String, required: false },
    },
    coverImage: {
      url: { type: String, required: false },
      publicId: { type: String, required: false },
    },
    emailVerification: {
      type: [
        {
          isVerified: { type: Boolean, default: true, required: true },
          verifCode: { type: String, required: false },
          verifCodeExpiresAt: { type: Date, required: false },
        },
      ],
      default: [{ isVerified: true }],
      required: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      required: false,
    },
    sessionTrack: {
      isOnline: {
        type: Boolean,
        default: false,
      },
      lastSeen: {
        type: Date,
        required: false,
      },
      devices: {
        type: [
          {
            name: { type: String, required: true },
            ipAddress: { type: String, required: false },
          },
        ],
        default: [],
      },
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
    fcmTokens: {
      type: [
        {
          token: { type: String, required: true },
          deviceId: { type: String, required: true },
          platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    oauth: {
      google: {
        id: { type: String, required: false },
        email: { type: String, required: false },
        name: { type: String, required: false },
        picture: { type: String, required: false },
        verified: { type: Boolean, default: false },
      },
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  },
);

// Add index on refreshTokens.jti for efficient token lookup during refresh/revocation
userSchema.index({ 'refreshTokens.jti': 1 });

// Add index on refreshTokens.expiresAt for efficient cleanup of expired tokens
userSchema.index({ 'refreshTokens.expiresAt': 1 });

// Base User Model
const userModel = model<User & Document>('User', userSchema);

export default userModel;

// Helper function to check if a user is an Admin
export function isAdmin(user: User & Document): user is IAdmin & Document {
  return (user as any).type === 'admin';
}

// Helper function to check if a user is a Client
export function isClient(user: User & Document): user is IClient & Document {
  return (user as any).type === 'client';
}

// Helper function to check if a user is a Lounge
export function isLounge(user: User & Document): user is ILounge & Document {
  return (user as any).type === 'lounge';
}
