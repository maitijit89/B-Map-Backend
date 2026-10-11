import mongoose, { Document, Schema } from 'mongoose';
import { DevicePlatform, PushTokenType } from './notification.types';

export interface IDeviceToken extends Document {
  userId: string;
  token: string;
  platform: DevicePlatform;
  tokenType: PushTokenType;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  isActive: boolean;
  permissions?: {
    postNotifications: boolean;
    authorizationStatus?: string;
  };
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: {
      type: String,
      required: [true, 'userId is required'],
      index: true,
      trim: true,
    },
    token: {
      type: String,
      required: [true, 'Device push token is required'],
      unique: true,
      index: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      required: [true, 'Platform is required (android, ios, web)'],
      index: true,
    },
    tokenType: {
      type: String,
      enum: ['fcm', 'apns'],
      default: 'fcm',
    },
    deviceId: {
      type: String,
      trim: true,
    },
    deviceName: {
      type: String,
      trim: true,
    },
    appVersion: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    permissions: {
      postNotifications: {
        type: Boolean,
        default: true,
      },
      authorizationStatus: {
        type: String,
        default: 'authorized',
      },
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast queries of active tokens for a specific user
deviceTokenSchema.index({ userId: 1, isActive: 1 });

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', deviceTokenSchema);
