import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';
import { BayStatus, BayType } from './parking-navigation.types';

export interface IParkingBayDocument extends Document {
  bayId: string;
  facilityId: string;
  floorLevel: number;
  floorName: string;
  zone: string;
  spaceNumber: string;
  location: GeoJsonPoint;
  dimensions: {
    lengthMeters: number;
    widthMeters: number;
  };
  bayType: BayType;
  status: BayStatus;
  sensorType: 'ultrasonic' | 'geomagnetic' | 'camera_ai' | 'manual';
  evCharger?: {
    powerKw: number;
    plugType: 'CCS2' | 'Type2' | 'NACS' | 'GB/T';
    isAvailable: boolean;
  };
  distanceToNearestElevatorMeters: number;
  nearestAisleNodeId: string;
  currentOccupantVehiclePlate?: string;
  reservedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const parkingBaySchema = new Schema<IParkingBayDocument>(
  {
    bayId: { type: String, required: true, unique: true, index: true },
    facilityId: { type: String, required: true, index: true },
    floorLevel: { type: Number, required: true, index: true },
    floorName: { type: String, required: true },
    zone: { type: String, required: true, index: true },
    spaceNumber: { type: String, required: true },
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
    dimensions: {
      lengthMeters: { type: Number, default: 5.0 },
      widthMeters: { type: Number, default: 2.5 },
    },
    bayType: {
      type: String,
      enum: ['standard', 'compact', 'accessible_disabled', 'ev_charging', 'vip', 'motorcycle'],
      default: 'standard',
      index: true,
    },
    status: {
      type: String,
      enum: ['vacant', 'occupied', 'reserved', 'maintenance'],
      default: 'vacant',
      index: true,
    },
    sensorType: {
      type: String,
      enum: ['ultrasonic', 'geomagnetic', 'camera_ai', 'manual'],
      default: 'ultrasonic',
    },
    evCharger: {
      powerKw: Number,
      plugType: {
        type: String,
        enum: ['CCS2', 'Type2', 'NACS', 'GB/T'],
      },
      isAvailable: Boolean,
    },
    distanceToNearestElevatorMeters: { type: Number, default: 25 },
    nearestAisleNodeId: { type: String, required: true },
    currentOccupantVehiclePlate: String,
    reservedUntil: Date,
  },
  {
    timestamps: true,
  }
);

parkingBaySchema.index({ location: '2dsphere' });
parkingBaySchema.index({ facilityId: 1, floorLevel: 1, status: 1 });

export const ParkingBayModel = mongoose.model<IParkingBayDocument>(
  'ParkingBay',
  parkingBaySchema
);
