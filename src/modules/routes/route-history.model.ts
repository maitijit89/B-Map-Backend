import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint, GeoJsonLineString } from '../../core/types/geo.types';
import { OsrmStep } from '../../core/types/osrm.types';

export interface IRouteHistory extends Document {
  userId?: string;
  name?: string;
  profile: 'driving' | 'bike' | 'foot';
  origin: GeoJsonPoint;
  destination: GeoJsonPoint;
  waypoints?: GeoJsonPoint[];
  distanceMeters: number;
  durationSeconds: number;
  geometry: GeoJsonLineString;
  steps?: OsrmStep[];
  queryHash?: string;
  hitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const pointSubSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  { _id: false }
);

const lineStringSubSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['LineString'],
      default: 'LineString',
      required: true,
    },
    coordinates: {
      type: [[Number]], // Array of [lon, lat]
      required: true,
    },
  },
  { _id: false }
);

const routeHistorySchema = new Schema<IRouteHistory>(
  {
    userId: {
      type: String,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    profile: {
      type: String,
      enum: ['driving', 'bike', 'foot'],
      default: 'driving',
      index: true,
    },
    origin: {
      type: pointSubSchema,
      required: true,
    },
    destination: {
      type: pointSubSchema,
      required: true,
    },
    waypoints: [pointSubSchema],
    distanceMeters: {
      type: Number,
      required: true,
    },
    durationSeconds: {
      type: Number,
      required: true,
    },
    geometry: {
      type: lineStringSubSchema,
      required: true,
    },
    steps: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    queryHash: {
      type: String,
      index: true,
    },
    hitCount: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for route geometry
routeHistorySchema.index({ geometry: '2dsphere' });
routeHistorySchema.index({ 'origin.coordinates': '2dsphere' });
routeHistorySchema.index({ 'destination.coordinates': '2dsphere' });

export const RouteHistory = mongoose.model<IRouteHistory>('RouteHistory', routeHistorySchema);
