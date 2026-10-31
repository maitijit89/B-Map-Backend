import mongoose, { Document, Schema } from 'mongoose';
import { Coordinate } from '../../core/types/geo.types';

export interface IUserVisitedPlaceDocument extends Document {
  userId: string;
  placeId: string;
  name: string;
  category: string;
  location: {
    type: 'Point';
    coordinates: Coordinate;
  };
  visitCount: number;
  totalDwellMinutes: number;
  avgSpeedKmH: number;
  tags?: string[];
  firstVisitedAt: Date;
  lastVisitedAt: Date;
}

export interface IUserVisitedSpotDocument extends Document {
  userId: string;
  spotId: string;
  location: {
    type: 'Point';
    coordinates: Coordinate;
  };
  visitCount: number;
  totalDwellMinutes: number;
  avgSpeedKmH: number;
  spotLabel?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

const userVisitedPlaceSchema = new Schema<IUserVisitedPlaceDocument>(
  {
    userId: { type: String, required: true, index: true },
    placeId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true, default: 'general_poi' },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    visitCount: { type: Number, required: true, default: 1 },
    totalDwellMinutes: { type: Number, default: 0 },
    avgSpeedKmH: { type: Number, default: 0 },
    tags: [{ type: String }],
    firstVisitedAt: { type: Date, default: Date.now },
    lastVisitedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

userVisitedPlaceSchema.index({ userId: 1, placeId: 1 }, { unique: true });
userVisitedPlaceSchema.index({ location: '2dsphere' });
userVisitedPlaceSchema.index({ userId: 1, visitCount: -1 });

const userVisitedSpotSchema = new Schema<IUserVisitedSpotDocument>(
  {
    userId: { type: String, required: true, index: true },
    spotId: { type: String, required: true, index: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    visitCount: { type: Number, required: true, default: 1 },
    totalDwellMinutes: { type: Number, default: 0 },
    avgSpeedKmH: { type: Number, default: 0 },
    spotLabel: { type: String },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

userVisitedSpotSchema.index({ userId: 1, spotId: 1 }, { unique: true });
userVisitedSpotSchema.index({ location: '2dsphere' });
userVisitedSpotSchema.index({ userId: 1, visitCount: -1 });

export const UserVisitedPlaceModel =
  mongoose.models.UserVisitedPlace ||
  mongoose.model<IUserVisitedPlaceDocument>('UserVisitedPlace', userVisitedPlaceSchema);

export const UserVisitedSpotModel =
  mongoose.models.UserVisitedSpot ||
  mongoose.model<IUserVisitedSpotDocument>('UserVisitedSpot', userVisitedSpotSchema);

