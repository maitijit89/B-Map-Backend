import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPolygon } from '../../core/types/geo.types';
import {
  BuildingFacadeMaterial,
  BuildingLodLevel,
  RoofShape,
} from './spatial-visualization.types';

export interface IBuilding3DDocument extends Document {
  buildingId: string;
  name?: string;
  footprint: GeoJsonPolygon;
  heightMeters: number;
  minHeightMeters: number;
  levels: number;
  facadeMaterial: BuildingFacadeMaterial;
  facadeColor: string;
  roofShape: RoofShape;
  roofColor: string;
  lod: BuildingLodLevel;
  isLandmark: boolean;
  landmarkModelUri?: string;
  lightingProfile?: {
    nightGlow: boolean;
    windowEmissiveColor?: string;
    rooftopBeacon?: boolean;
  };
  bbox: [number, number, number, number];
  createdAt: Date;
  updatedAt: Date;
}

const building3DSchema = new Schema<IBuilding3DDocument>(
  {
    buildingId: { type: String, required: true, unique: true, index: true },
    name: { type: String, trim: true },
    footprint: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon',
        required: true,
      },
      coordinates: {
        type: [[[Number]]], // array of linear rings [[lon, lat], ...]
        required: true,
      },
    },
    heightMeters: { type: Number, required: true, default: 15 },
    minHeightMeters: { type: Number, default: 0 },
    levels: { type: Number, default: 4 },
    facadeMaterial: {
      type: String,
      enum: ['glass_curtain', 'concrete', 'brick', 'steel_panel', 'stone', 'timber'],
      default: 'concrete',
    },
    facadeColor: { type: String, default: '#D1D5DB' },
    roofShape: {
      type: String,
      enum: ['flat', 'gabled', 'hipped', 'domed', 'pyramidal', 'mansard'],
      default: 'flat',
    },
    roofColor: { type: String, default: '#4B5563' },
    lod: {
      type: String,
      enum: ['LOD0', 'LOD1', 'LOD2', 'LOD3'],
      default: 'LOD1',
    },
    isLandmark: { type: Boolean, default: false, index: true },
    landmarkModelUri: String,
    lightingProfile: {
      nightGlow: { type: Boolean, default: true },
      windowEmissiveColor: { type: String, default: '#FEF08A' },
      rooftopBeacon: { type: Boolean, default: false },
    },
    bbox: {
      type: [Number],
      default: [0, 0, 0, 0],
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for spatial queries
building3DSchema.index({ footprint: '2dsphere' });

export const Building3DModel = mongoose.model<IBuilding3DDocument>(
  'Building3D',
  building3DSchema
);
