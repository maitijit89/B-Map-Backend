import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';
import {
  PanoramaDepthMap,
  PanoramaHotspotLink,
  PanoramaResolution,
  SemanticARStreetOverlay,
} from './spatial-visualization.types';

export interface IStreetViewPanoramaDocument extends Document {
  panoId: string;
  cityId: string;
  cityName: string;
  location: GeoJsonPoint;
  altitudeMeters: number;
  cameraHeightMeters: number;
  headingDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
  fovDegrees: number;
  resolution: PanoramaResolution;
  equirectangularImageUrl: string;
  cubemapFacesUrl?: {
    front: string;
    back: string;
    left: string;
    right: string;
    top: string;
    bottom: string;
  };
  tilePyramidBaseUrl?: string;
  depthMap?: PanoramaDepthMap;
  hotspots: PanoramaHotspotLink[];
  arOverlays: SemanticARStreetOverlay[];
  captureTimestamp: number;
  historicalEpoch: string;
  roadClass: string;
  privacyAnonymized: {
    facesBlurred: number;
    licensePlatesBlurred: number;
    complianceVerified: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const streetViewPanoramaSchema = new Schema<IStreetViewPanoramaDocument>(
  {
    panoId: { type: String, required: true, unique: true, index: true },
    cityId: { type: String, required: true, index: true },
    cityName: { type: String, required: true },
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
    altitudeMeters: { type: Number, default: 0 },
    cameraHeightMeters: { type: Number, default: 2.4 },
    headingDegrees: { type: Number, default: 0 },
    pitchDegrees: { type: Number, default: 0 },
    rollDegrees: { type: Number, default: 0 },
    fovDegrees: { type: Number, default: 90 },
    resolution: {
      type: String,
      enum: ['8K_UHD', '4K_HD', '2K_SD'],
      default: '8K_UHD',
    },
    equirectangularImageUrl: { type: String, required: true },
    cubemapFacesUrl: {
      front: String,
      back: String,
      left: String,
      right: String,
      top: String,
      bottom: String,
    },
    tilePyramidBaseUrl: String,
    depthMap: {
      format: String,
      width: Number,
      height: Number,
      minDistanceMeters: Number,
      maxDistanceMeters: Number,
      depthBufferCompressed: String,
      groundPlaneEstimated: {
        normal: [Number],
        heightMeters: Number,
      },
    },
    hotspots: [
      {
        targetPanoId: String,
        targetCoordinate: [Number],
        yawDegrees: Number,
        pitchDegrees: Number,
        distanceMeters: Number,
        roadName: String,
        actionType: String,
      },
    ],
    arOverlays: [
      {
        overlayId: String,
        category: String,
        title: String,
        subtitle: String,
        worldCoordinate: [Number],
        panoYaw: Number,
        panoPitch: Number,
        distanceMeters: Number,
        iconName: String,
        metadata: Schema.Types.Mixed,
      },
    ],
    captureTimestamp: { type: Number, required: true, index: true },
    historicalEpoch: { type: String, default: '2026-Q1' },
    roadClass: { type: String, default: 'inner_urban' },
    privacyAnonymized: {
      facesBlurred: { type: Number, default: 0 },
      licensePlatesBlurred: { type: Number, default: 0 },
      complianceVerified: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for ultra-fast spatial radius lookup
streetViewPanoramaSchema.index({ location: '2dsphere' });
streetViewPanoramaSchema.index({ cityId: 1, captureTimestamp: -1 });

export const StreetViewPanoramaModel =
  mongoose.models.StreetViewPanorama ||
  mongoose.model<IStreetViewPanoramaDocument>('StreetViewPanorama', streetViewPanoramaSchema);
