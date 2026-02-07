import { model, Schema, Document } from 'mongoose';
import { Agent } from '@interfaces/agent.interface';

export interface AgentDocument extends Agent, Document {}

const agentSchema: Schema = new Schema(
  {
    agentName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    loungeId: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Reference to User model where type is 'lounge'
      required: true,
    },
    profileImage: {
      url: { type: String, required: false },
      publicId: { type: String, required: false },
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Create indexes for better performance
agentSchema.index({ agentName: 1 });
agentSchema.index({ loungeId: 1 });

const agentModel = model<AgentDocument>('Agent', agentSchema);

export default agentModel;
