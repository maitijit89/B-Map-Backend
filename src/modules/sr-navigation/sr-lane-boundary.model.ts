import mongoose, { Document, Schema } from 'mongoose';
import { SRLaneBoundary, SRRoadSurfaceMarking, SRJunctionCard } from './sr-navigation.types';

export interface ISRRoadModelDocument extends Document {
  segmentId: string;
  roadName: string;
  boundaries: SRLaneBoundary[];
  markings: SRRoadSurfaceMarking[];
  junctionCard?: SRJunctionCard;
  createdAt: Date;
  updatedAt: Date;
}

const srBoundarySchema = new Schema(
  {
    boundaryIndex: { type: Number, required: true },
    boundaryType: {
      type: String,
      enum: [
        'solid_white',
        'dashed_white',
        'double_solid_white',
        'solid_yellow',
        'dashed_yellow',
        'double_solid_yellow',
        'curb',
        'guardrail',
      ],
      required: true,
    },
    color: { type: String, enum: ['white', 'yellow'], default: 'white' },
    coordinates: { type: [[Number]], required: true },
  },
  { _id: false }
);

const srMarkingSchema = new Schema(
  {
    markingType: {
      type: String,
      enum: [
        'straight_arrow',
        'left_turn_arrow',
        'right_turn_arrow',
        'u_turn_arrow',
        'merge_arrow',
        'crosswalk',
        'stop_line',
        'speed_limit_number',
        'bicycle_sharrow',
        'deceleration_fishbone',
      ],
      required: true,
    },
    laneIndex: { type: Number, required: true },
    location: { type: [Number], required: true },
    label: String,
  },
  { _id: false }
);

const srRoadModelSchema = new Schema<ISRRoadModelDocument>(
  {
    segmentId: { type: String, required: true, unique: true, index: true },
    roadName: { type: String, required: true, index: true },
    boundaries: [srBoundarySchema],
    markings: [srMarkingSchema],
    junctionCard: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

export const SRRoadModel = mongoose.model<ISRRoadModelDocument>(
  'SRRoadModel',
  srRoadModelSchema
);
