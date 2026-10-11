import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonLineString } from '../../core/types/geo.types';
import { LaneDetail, LaneSegment } from './lane-routing.types';

export interface ILaneSegmentDocument extends Document, Omit<LaneSegment, 'segmentId'> {
  segmentId: string;
  createdAt: Date;
  updatedAt: Date;
}

const laneDetailSchema = new Schema<LaneDetail>(
  {
    laneIndex: { type: Number, required: true },
    turnDirection: {
      type: String,
      enum: ['straight', 'left', 'right', 'slight_left', 'slight_right', 'u_turn', 'left_straight', 'right_straight'],
      required: true,
    },
    laneType: {
      type: String,
      enum: ['normal', 'bus_only', 'hov_carpool', 'reversible', 'emergency', 'toll_etc', 'exit_ramp'],
      default: 'normal',
    },
    widthMeters: { type: Number, default: 3.75 },
    speedLimitKmh: { type: Number, default: 50 },
    restrictions: [
      {
        startHour: Number,
        endHour: Number,
        daysOfWeek: [Number],
        allowedVehicleTypes: [String],
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const laneSegmentSchema = new Schema<ILaneSegmentDocument>(
  {
    segmentId: { type: String, required: true, unique: true, index: true },
    roadName: { type: String, required: true, index: true },
    roadClass: {
      type: String,
      enum: ['motorway', 'trunk', 'primary', 'secondary', 'residential'],
      default: 'primary',
      index: true,
    },
    totalLanes: { type: Number, required: true },
    lanes: [laneDetailSchema],
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
    lengthMeters: { type: Number, required: true },
    nextLaneTransitions: {
      type: Map,
      of: [Number],
    },
  },
  {
    timestamps: true,
  }
);

laneSegmentSchema.index({ geometry: '2dsphere' });

export const LaneSegmentModel = mongoose.model<ILaneSegmentDocument>(
  'LaneSegment',
  laneSegmentSchema
);
