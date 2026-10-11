import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint, GeoJsonLineString } from '../../core/types/geo.types';

export interface INavigationSession extends Document {
  sessionId: string;
  userId: string;
  profile: 'driving' | 'bike' | 'foot';
  status: 'active' | 'completed' | 'cancelled' | 'paused';
  origin: GeoJsonPoint;
  destination: GeoJsonPoint;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  lastKnownLocation?: GeoJsonPoint;
  lastHeading?: number;
  lastSpeed?: number;
  rerouteCount: number;
  startedAt: Date;
  completedAt?: Date;
  routeGeometry: GeoJsonLineString;
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
      type: [Number], // [lon, lat]
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
      type: [[Number]],
      required: true,
    },
  },
  { _id: false }
);

const navigationSessionSchema = new Schema<INavigationSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    profile: {
      type: String,
      enum: ['driving', 'bike', 'foot'],
      default: 'driving',
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'paused'],
      default: 'active',
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
    totalDistanceMeters: {
      type: Number,
      required: true,
    },
    totalDurationSeconds: {
      type: Number,
      required: true,
    },
    remainingDistanceMeters: {
      type: Number,
      default: 0,
    },
    remainingDurationSeconds: {
      type: Number,
      default: 0,
    },
    lastKnownLocation: pointSubSchema,
    lastHeading: Number,
    lastSpeed: Number,
    rerouteCount: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    routeGeometry: {
      type: lineStringSubSchema,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

navigationSessionSchema.index({ 'lastKnownLocation.coordinates': '2dsphere' });

export const NavigationSession = mongoose.model<INavigationSession>(
  'NavigationSession',
  navigationSessionSchema
);
