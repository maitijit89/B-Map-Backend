import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationLog extends Document {
  recipientUserId: string;
  tripId?: string;
  title: string;
  body: string;
  eventType: string;
  channel: 'apns' | 'fcm' | 'websocket_hybrid';
  tokensTargetedCount: number;
  data?: Record<string, any>;
  dispatchedAt: Date;
  createdAt: Date;
}

const notificationLogSchema = new Schema<INotificationLog>(
  {
    recipientUserId: {
      type: String,
      required: true,
      index: true,
    },
    tripId: {
      type: String,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['apns', 'fcm', 'websocket_hybrid'],
      default: 'fcm',
    },
    tokensTargetedCount: {
      type: Number,
      default: 1,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    dispatchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

notificationLogSchema.index({ tripId: 1, eventType: 1 });

export const NotificationLog = mongoose.model<INotificationLog>(
  'NotificationLog',
  notificationLogSchema
);
