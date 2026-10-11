import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';
import { BeaconProtocolType, IndoorBeaconRecord, IndoorFacilityType } from './nearby-devices.types';

export interface IIndoorBeaconDocument extends Document, Omit<IndoorBeaconRecord, 'geographicLocation'> {
  geographicLocation: GeoJsonPoint;
  createdAt: Date;
  updatedAt: Date;
}

const indoorBeaconSchema = new Schema<IIndoorBeaconDocument>(
  {
    beaconId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    facilityId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    facilityName: {
      type: String,
      required: true,
      trim: true,
    },
    facilityType: {
      type: String,
      enum: [
        'underground_parking',
        'shopping_center',
        'airport_terminal',
        'train_transit_hub',
        'commercial_office',
        'metro_station',
      ],
      required: true,
      index: true,
    },
    floorLevel: {
      type: Number,
      required: true,
      index: true,
    },
    floorName: {
      type: String,
      trim: true,
    },
    zone: {
      type: String,
      required: true,
      trim: true,
    },
    indoorX: {
      type: Number,
      required: true,
    },
    indoorY: {
      type: Number,
      required: true,
    },
    indoorZ: {
      type: Number,
      default: 2.5,
    },
    geographicLocation: {
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
    altitudeMeters: {
      type: Number,
    },
    txPowerAt1m: {
      type: Number,
      default: -59,
    },
    pathLossExponent: {
      type: Number,
      default: 2.6,
    },
    coverageRadiusMeters: {
      type: Number,
      default: 25,
    },
    protocol: {
      type: String,
      enum: ['ibeacon', 'eddystone', 'altbeacon', 'generic_ble'],
      default: 'ibeacon',
      index: true,
    },
    uuid: {
      type: String,
      trim: true,
      index: true,
    },
    major: {
      type: Number,
      index: true,
    },
    minor: {
      type: Number,
      index: true,
    },
    namespaceId: {
      type: String,
      trim: true,
    },
    instanceId: {
      type: String,
      trim: true,
    },
    macAddress: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// GeoSpatial index for proximity searches
indoorBeaconSchema.index({ geographicLocation: '2dsphere' });

// Compound index for high-speed iBeacon lookups
indoorBeaconSchema.index({ uuid: 1, major: 1, minor: 1 });

// Compound index for facility + floor queries
indoorBeaconSchema.index({ facilityId: 1, floorLevel: 1 });

export const IndoorBeaconModel =
  mongoose.models.IndoorBeacon ||
  mongoose.model<IIndoorBeaconDocument>('IndoorBeacon', indoorBeaconSchema);
