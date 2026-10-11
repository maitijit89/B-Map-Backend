import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';
import { RiderHazardType } from './rider-mode.types';

export interface IRiderHazardDocument extends Document {
  hazardId: string;
  type: RiderHazardType;
  location: GeoJsonPoint;
  severity: 'low' | 'medium' | 'high' | 'critical';
  warningMessage: string;
  verifiedReportsCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const riderHazardSchema = new Schema<IRiderHazardDocument>(
  {
    hazardId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: [
        'tram_tracks',
        'metal_bridge_joint',
        'slippery_manhole',
        'loose_gravel_apex',
        'severe_pothole',
        'steep_stairs_no_access',
        'high_crosswind_zone',
        'black_ice_risk',
      ],
      required: true,
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
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    warningMessage: { type: String, required: true },
    verifiedReportsCount: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

riderHazardSchema.index({ location: '2dsphere' });

export const RiderHazardModel = mongoose.model<IRiderHazardDocument>(
  'RiderHazard',
  riderHazardSchema
);
