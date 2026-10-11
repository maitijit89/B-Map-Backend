import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';

export interface IBeaconAnchor extends Document {
  uuid: string;
  major: number;
  minor: number;
  facilityName: string;
  facilityType: 'underground_parking' | 'tunnel' | 'indoor_mall' | 'terminal';
  floorLevel: number;
  txPowerAt1m: number;
  location: GeoJsonPoint;
  altitude?: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const beaconAnchorSchema = new Schema<IBeaconAnchor>(
  {
    uuid: {
      type: String,
      required: true,
      index: true,
    },
    major: {
      type: Number,
      required: true,
      index: true,
    },
    minor: {
      type: Number,
      required: true,
      index: true,
    },
    facilityName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    facilityType: {
      type: String,
      enum: ['underground_parking', 'tunnel', 'indoor_mall', 'terminal'],
      default: 'underground_parking',
      index: true,
    },
    floorLevel: {
      type: Number,
      default: -1,
    },
    txPowerAt1m: {
      type: Number,
      default: -59,
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
    altitude: Number,
    description: String,
  },
  {
    timestamps: true,
  }
);

beaconAnchorSchema.index({ location: '2dsphere' });
beaconAnchorSchema.index({ uuid: 1, major: 1, minor: 1 }, { unique: true });

export const BeaconAnchorModel = mongoose.model<IBeaconAnchor>(
  'BeaconAnchor',
  beaconAnchorSchema
);
