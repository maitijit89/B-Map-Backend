import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint, GeoJsonPolygon } from '../../core/types/geo.types';
import {
  IndoorFacilityCategory,
  IndoorFloorPlan,
  IndoorVerticalConnector,
} from './spatial-visualization.types';

export interface IIndoorFacilityDocument extends Document {
  facilityId: string;
  name: string;
  city: string;
  state: string;
  category: IndoorFacilityCategory;
  center: GeoJsonPoint;
  boundary: GeoJsonPolygon;
  defaultFloorLevel: number;
  floorLevels: number[];
  floors: IndoorFloorPlan[];
  totalAreaSqMeters: number;
  isLiveOccupancyTracked: boolean;
  indoorBeaconProtocol: string;
  verticalConnectors: IndoorVerticalConnector[];
  createdAt: Date;
  updatedAt: Date;
}

const indoorFacilitySchema = new Schema<IIndoorFacilityDocument>(
  {
    facilityId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    city: { type: String, required: true, index: true },
    state: { type: String, required: true },
    category: {
      type: String,
      enum: ['commercial_complex', 'international_airport', 'train_hub', 'metro_interchange'],
      required: true,
      index: true,
    },
    center: {
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
    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon',
        required: true,
      },
      coordinates: {
        type: [[[Number]]],
        required: true,
      },
    },
    defaultFloorLevel: { type: Number, default: 0 },
    floorLevels: [{ type: Number }],
    floors: [Schema.Types.Mixed],
    totalAreaSqMeters: { type: Number, default: 50000 },
    isLiveOccupancyTracked: { type: Boolean, default: true },
    indoorBeaconProtocol: { type: String, default: 'ble_ibeacon' },
    verticalConnectors: [Schema.Types.Mixed],
  },
  {
    timestamps: true,
  }
);

indoorFacilitySchema.index({ center: '2dsphere' });
indoorFacilitySchema.index({ category: 1, city: 1 });

export const IndoorFacilityModel =
  mongoose.models.IndoorFacility ||
  mongoose.model<IIndoorFacilityDocument>('IndoorFacility', indoorFacilitySchema);
