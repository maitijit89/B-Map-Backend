import mongoose, { Document, Schema } from 'mongoose';
import { AICopilotMessage, AICopilotVehicleContext } from './ai-llm.types';

export interface IAICopilotSessionDocument extends Document {
  conversationId: string;
  userId?: string;
  vehicleContext?: AICopilotVehicleContext;
  messages: AICopilotMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const aiCopilotSessionSchema = new Schema<IAICopilotSessionDocument>(
  {
    conversationId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    vehicleContext: { type: Schema.Types.Mixed },
    messages: [
      {
        role: { type: String, enum: ['user', 'assistant', 'system', 'tool'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Number, default: Date.now },
        toolCall: Schema.Types.Mixed,
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const AICopilotSessionModel = mongoose.model<IAICopilotSessionDocument>(
  'AICopilotSession',
  aiCopilotSessionSchema
);
