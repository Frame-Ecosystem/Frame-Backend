import { model, Schema, Document } from 'mongoose';
import { Follow } from '@systems/UserManager/interfaces/follow.interface';

const followSchema = new Schema(
  {
    followerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    followingId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    followerType: { type: String, enum: ['client', 'lounge', 'agent'], required: true },
    followingType: { type: String, enum: ['client', 'lounge', 'agent'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One follow relationship per pair — prevents duplicates
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

// Fast lookups: all users a person follows / all followers of a user
followSchema.index({ followerId: 1, createdAt: -1 });
followSchema.index({ followingId: 1, createdAt: -1 });

// Filtered queries by type
followSchema.index({ followerId: 1, followingType: 1, createdAt: -1 });
followSchema.index({ followingId: 1, followerType: 1, createdAt: -1 });

const followModel = model<Follow & Document>('Follow', followSchema);

export default followModel;
