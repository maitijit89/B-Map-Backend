import mongoose, { Document, Schema } from 'mongoose';
import { AppClientPlatform } from './app-version.types';

export interface IAppVersionDocument extends Document {
  platform: AppClientPlatform;
  currentVersion: string;
  minimumSupportedVersion: string;
  latestBuildNumber: number;
  minBuildNumber: number;
  title: string;
  releaseNotes: string[];
  downloadUrl: string;
  forceUpdate: boolean;
  isMaintenance: boolean;
  maintenanceMessage?: string;
  patchBundleUrl?: string;
  patchHash?: string;
  patchSize?: number;
  rolloutPercentage: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const appVersionSchema = new Schema<IAppVersionDocument>(
  {
    platform: {
      type: String,
      required: true,
      unique: true,
      enum: ['web', 'android', 'ios', 'desktop'],
      index: true,
    },
    currentVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    minimumSupportedVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    latestBuildNumber: {
      type: Number,
      required: true,
      default: 100,
    },
    minBuildNumber: {
      type: Number,
      required: true,
      default: 100,
    },
    title: {
      type: String,
      default: 'B-Map Sovereign GIS Platform Release',
    },
    releaseNotes: {
      type: [String],
      default: [
        'Version 1.0.0 Official Release',
        'Real-time traffic and dynamic ETA calculation engine',
        'ISRO NavIC dual-frequency ionospheric cancellation',
        'DigiPIN 4m x 4m hierarchical sovereign addressing',
        'Zero-trust telematics signing and anti-spoofing guard',
      ],
    },
    downloadUrl: {
      type: String,
      default: 'https://bmap.io/download',
    },
    forceUpdate: {
      type: Boolean,
      default: false,
    },
    isMaintenance: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: '',
    },
    patchBundleUrl: {
      type: String,
      default: '',
    },
    patchHash: {
      type: String,
      default: '',
    },
    patchSize: {
      type: Number,
      default: 0,
    },
    rolloutPercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const AppVersionModel =
  mongoose.models.AppVersion ||
  mongoose.model<IAppVersionDocument>('AppVersion', appVersionSchema);
