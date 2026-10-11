import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';
import { MasterPoiProfile } from './data-mining.types';

export interface IMasterPoiDocument extends Document, Omit<MasterPoiProfile, 'masterId' | 'coordinates'> {
  masterId: string;
  location: GeoJsonPoint;
  createdAt: Date;
  updatedAt: Date;
}

const entranceSubSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['main', 'parking', 'delivery', 'pedestrian'],
      default: 'main',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lon, lat]
        required: true,
      },
    },
    description: String,
  },
  { _id: false }
);

const masterPoiSchema = new Schema<IMasterPoiDocument>(
  {
    masterId: { type: String, required: true, unique: true, index: true },
    canonicalName: { type: String, required: true, index: true },
    aliases: [{ type: String, trim: true }],
    category: { type: String, required: true, index: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    address: {
      street: String,
      city: String,
      district: String,
    },
    entrances: [entranceSubSchema],
    vitalityScore: { type: Number, default: 50, index: true },
    visitCount30d: { type: Number, default: 0 },
    peakHours: {
      type: Map,
      of: Number,
    },
    freshnessStatus: {
      type: String,
      enum: ['active', 'seasonal', 'defunct_risk', 'verified_closed'],
      default: 'active',
      index: true,
    },
    mergedSourcesCount: { type: Number, default: 1 },
    lastVerifiedAt: { type: Number, default: Date.now },
  },
  {
    timestamps: true,
  }
);

masterPoiSchema.index({ location: '2dsphere' });
masterPoiSchema.index({ 'entrances.location': '2dsphere' });
masterPoiSchema.index({ canonicalName: 'text', aliases: 'text' });

export const MasterPoiModel = mongoose.model<IMasterPoiDocument>(
  'MasterPoi',
  masterPoiSchema
);
