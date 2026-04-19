import { model, Schema, Document } from 'mongoose';

export interface VerificationTokenDocument extends Document {
  _id: string;
  email: string;
  phoneNumber?: string;
  password?: string; // Optional for password_reset tokens
  type: string;
  tokenType: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const verificationTokenSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: function (this: any) {
        return this.tokenType !== 'password_reset';
      },
    },
    type: {
      type: String,
      required: true,
      enum: ['user', 'client', 'lounge', 'admin'],
      default: 'user',
    },
    tokenType: {
      type: String,
      required: true,
      enum: ['email_verification', 'password_reset'],
      default: 'email_verification',
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index - automatically delete expired tokens
    },
  },
  {
    timestamps: true,
  },
);

const verificationTokenModel = model<VerificationTokenDocument>('VerificationToken', verificationTokenSchema);

export default verificationTokenModel;
