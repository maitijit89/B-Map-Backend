import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint, GeoJsonPolygon } from '../../core/types/geo.types';
import { ParkingFloorLevel } from './parking-navigation.types';

export interface IParkingFacilityDocument extends Document {
  facilityId: string;
  name: string;
  address: string;
  location: GeoJsonPoint;
  boundaryPolygon?: GeoJsonPolygon;
  entranceGates: {
    gateId: string;
    name: string;
    barrierCoordinates: [number, number]; // [lon, lat]
  }[];
  exitGates: {
    gateId: string;
    name: string;
    barrierCoordinates: [number, number];
  }[];
  floors: ParkingFloorLevel[];
  hourlyRate: number;
  totalSpaces: number;
  availableSpaces: number;
  createdAt: Date;
  updatedAt: Date;
}

const parkingFacilitySchema = new Schema<IParkingFacilityDocument>(
  {
    facilityId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    address: { type: String, required: true },
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
    boundaryPolygon: {
      type: {
        type: String,
        enum: ['Polygon'],
      },
      coordinates: {
        type: [[[Number]]],
      },
    },
    entranceGates: [
      {
        gateId: { type: String, required: true },
        name: { type: String, required: true },
        barrierCoordinates: { type: [Number], required: true },
      },
    ],
    exitGates: [
      {
        gateId: { type: String, required: true },
        name: { type: String, required: true },
        barrierCoordinates: { type: [Number], required: true },
      },
    ],
    floors: {
      type: Schema.Types.Mixed,
      default: [],
    },
    hourlyRate: { type: Number, default: 3.5 },
    totalSpaces: { type: Number, default: 200 },
    availableSpaces: { type: Number, default: 120 },
  },
  {
    timestamps: true,
  }
);

parkingFacilitySchema.index({ location: '2dsphere' });

export const ParkingFacilityModel = mongoose.model<IParkingFacilityDocument>(
  'ParkingFacility',
  parkingFacilitySchema
);
