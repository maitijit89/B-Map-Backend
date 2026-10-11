import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';
import { TransitMode } from './public-transit.types';

export interface ITransitStationDocument extends Document {
  stationId: string;
  name: string;
  code?: string;
  location: GeoJsonPoint;
  modes: TransitMode[];
  lines: string[];
  platforms: {
    platformNumber: string;
    direction: string;
  }[];
  entrances: {
    entranceId: string;
    name: string;
    coordinates: [number, number];
    accessible: boolean;
  }[];
  zone: string;
  createdAt: Date;
  updatedAt: Date;
}

const transitStationSchema = new Schema<ITransitStationDocument>(
  {
    stationId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    code: String,
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
    modes: [
      {
        type: String,
        enum: ['subway', 'commuter_rail', 'tram', 'bus', 'ferry'],
      },
    ],
    lines: [{ type: String, index: true }],
    platforms: [
      {
        platformNumber: String,
        direction: String,
      },
    ],
    entrances: [
      {
        entranceId: String,
        name: String,
        coordinates: [Number],
        accessible: Boolean,
      },
    ],
    zone: { type: String, default: 'Zone A' },
  },
  {
    timestamps: true,
  }
);

transitStationSchema.index({ location: '2dsphere' });

export const TransitStationModel = mongoose.model<ITransitStationDocument>(
  'TransitStation',
  transitStationSchema
);
