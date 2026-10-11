import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonLineString } from '../../core/types/geo.types';
import { RoadChangeDetection, RoadChangeType } from './data-mining.types';

export interface IRoadChangeDocument extends Document, Omit<RoadChangeDetection, 'changeId'> {
  changeId: string;
  createdAt: Date;
  updatedAt: Date;
}

const roadChangeSchema = new Schema<IRoadChangeDocument>(
  {
    changeId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ['new_road_discovered', 'road_closure_detected', 'turn_restriction_changed', 'speed_limit_deviation'],
      required: true,
      index: true,
    },
    roadName: String,
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
    confidenceScore: { type: Number, required: true, min: 0, max: 100 },
    supportingTrajectoriesCount: { type: Number, default: 1 },
    firstObservedAt: { type: Number, default: Date.now },
    lastObservedAt: { type: Number, default: Date.now },
    status: {
      type: String,
      enum: ['pending_review', 'auto_approved', 'rejected'],
      default: 'pending_review',
      index: true,
    },
    metadata: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

roadChangeSchema.index({ geometry: '2dsphere' });

export const RoadChangeModel = mongoose.model<IRoadChangeDocument>(
  'RoadChange',
  roadChangeSchema
);
