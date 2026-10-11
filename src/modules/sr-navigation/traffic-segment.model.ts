import mongoose, { Document, Schema } from 'mongoose';
import { TrafficCongestionLevel } from '../../types/car-navigation.types';
import { GeoJsonLineString } from '../../core/types/geo.types';

export interface ITrafficSegmentDocument extends Document {
  segmentId: string;
  roadName: string;
  congestionLevel: TrafficCongestionLevel;
  speedLimitKmh: number;
  currentSpeedKmh: number;
  speedMultiplier: number;
  lengthMeters: number;
  delaySeconds: number;
  geometry: GeoJsonLineString;
  createdAt: Date;
  updatedAt: Date;
}

const trafficSegmentSchema = new Schema<ITrafficSegmentDocument>(
  {
    segmentId: { type: String, required: true, unique: true, index: true },
    roadName: { type: String, required: true, index: true },
    congestionLevel: {
      type: String,
      enum: ['free_flow', 'slow', 'congested', 'severe_gridlock'],
      default: 'free_flow',
      index: true,
    },
    speedLimitKmh: { type: Number, default: 50 },
    currentSpeedKmh: { type: Number, default: 50 },
    speedMultiplier: { type: Number, default: 1.0 },
    lengthMeters: { type: Number, default: 500 },
    delaySeconds: { type: Number, default: 0 },
    geometry: {
      type: {
        type: String,
        enum: ['LineString'],
        default: 'LineString',
        required: true,
      },
      coordinates: {
        type: [[Number]],
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

trafficSegmentSchema.index({ geometry: '2dsphere' });

export const TrafficSegmentModel = mongoose.model<ITrafficSegmentDocument>(
  'TrafficSegment',
  trafficSegmentSchema
);
