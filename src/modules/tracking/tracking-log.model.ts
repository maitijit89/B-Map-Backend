import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';

export interface ITrackingLog extends Document {
  userId: string;
  role: 'driver' | 'rider' | 'navigator';
  location: GeoJsonPoint;
  heading?: number;
  speed?: number;
  accuracy?: number;
  recordedAt: Date;
  metadata?: Record<string, any>;
}

const trackingLogSchema = new Schema<ITrackingLog>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['driver', 'rider', 'navigator'],
      default: 'driver',
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [lon, lat]
        required: true,
      },
    },
    heading: Number,
    speed: Number,
    accuracy: Number,
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for location
trackingLogSchema.index({ location: '2dsphere' });
trackingLogSchema.index({ userId: 1, recordedAt: -1 });

export const TrackingLog = mongoose.model<ITrackingLog>('TrackingLog', trackingLogSchema);
