import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonLineString } from '../../core/types/geo.types';
import { VeteranExperienceSegment } from './lane-routing.types';

export interface IVeteranExperienceDocument extends Document, Omit<VeteranExperienceSegment, 'segmentId'> {
  segmentId: string;
  createdAt: Date;
  updatedAt: Date;
}

const hazardSubSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'frequent_bottleneck',
        'awkward_merge',
        'difficult_left_turn',
        'heavy_jaywalking',
        'illegal_parking_blockage',
        'severe_potholes',
        'blind_corner',
        'strict_enforcement_camera',
      ],
      required: true,
    },
    description: String,
    location: {
      type: [Number], // [lon, lat]
      required: true,
    },
    verifiedReportsCount: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const veteranExperienceSchema = new Schema<IVeteranExperienceDocument>(
  {
    segmentId: { type: String, required: true, unique: true, index: true },
    roadName: { type: String, required: true, index: true },
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
    speedEfficiencyRatio: { type: Number, default: 1.0 },
    veteranPreferenceScore: { type: Number, default: 50, index: true },
    noviceDifficultyRating: { type: Number, default: 2 },
    hazards: [hazardSubSchema],
    shortcutAlternativeForSegmentId: { type: String, index: true },
    shortcutTimeSavedSeconds: { type: Number, default: 0 },
    historicalPaceByHour: {
      type: Map,
      of: Number,
    },
  },
  {
    timestamps: true,
  }
);

veteranExperienceSchema.index({ geometry: '2dsphere' });

export const VeteranExperienceModel = mongoose.model<IVeteranExperienceDocument>(
  'VeteranExperience',
  veteranExperienceSchema
);
