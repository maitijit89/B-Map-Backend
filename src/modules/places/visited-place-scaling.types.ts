import { Coordinate } from '../../core/types/geo.types';

export type PlaceProminenceTier = 'compact' | 'regular' | 'frequent' | 'landmark_hub';
export type SpotGrowthClassification = 'slow_large_expanded' | 'moderate_dwell' | 'transit_corridor';

/**
 * Record representing a recognized POI/place visited by a user.
 */
export interface VisitedPlaceRecord {
  placeId: string;
  name: string;
  category: string;
  coordinates: Coordinate; // [lon, lat]
  visitCount: number;
  totalDwellMinutes?: number;
  avgSpeedKmH?: number;
  firstVisitedAt?: string;
  lastVisitedAt?: string;
  tags?: string[];
}

/**
 * Record representing an arbitrary coordinate spot / stay-point / breadcrumb cluster.
 */
export interface VisitedSpotRecord {
  spotId: string;
  coordinates: Coordinate; // [lon, lat]
  visitCount: number;
  totalDwellMinutes: number;
  avgSpeedKmH: number; // e.g. 0.8 km/h for cafe, 55 km/h for highway
  firstSeenAt?: string;
  lastSeenAt?: string;
  spotLabel?: string;
}

/**
 * Scaling configuration options.
 */
export interface PlaceScalingOptions {
  minRadiusPx?: number;       // default: 12px
  maxRadiusPx?: number;       // default: 44px
  minRadiusMeters?: number;   // default: 15m
  maxRadiusMeters?: number;   // default: 120m
  visitCap?: number;          // default: 50 visits (saturation point)
  curvatureGamma?: number;    // default: 0.85 (sublinear saturation curve)
}

export interface SpotScalingOptions {
  minRadiusPx?: number;       // default: 10px
  maxRadiusPx?: number;       // default: 48px
  minRadiusMeters?: number;   // default: 15m
  maxRadiusMeters?: number;   // default: 100m
  slownessReferenceSpeed?: number; // default: 6.0 km/h (pedestrian/stationary reference)
  weightCap?: number;         // default: 6.0
  curvatureGamma?: number;    // default: 0.80
}

/**
 * Computed dynamic scale result for a visited place.
 */
export interface PlaceScaleResult {
  placeId: string;
  name: string;
  category: string;
  coordinates: Coordinate;
  visitCount: number;
  scaleFactor: number;             // 1.00x to ~3.66x
  markerRadiusPx: number;          // pixel radius for 2D/raster/screen render
  influenceRadiusMeters: number;   // ground meter radius for vector circles & geofences
  prominenceTier: PlaceProminenceTier;
  importanceWeight: number;        // normalized [0.0, 1.0]
  haloRadiusPx: number;            // outer glow radius
  labelVisibilityZoom: number;     // min zoom level before label displays
  style: {
    fillColor: string;
    strokeColor: string;
    haloColor: string;
    pulseAnimation: boolean;
  };
  geojsonFeature: GeoJSONFeature;
}

/**
 * Computed dynamic scale result for a visited spot ("slow large" algorithm).
 */
export interface SpotScaleResult {
  spotId: string;
  coordinates: Coordinate;
  visitCount: number;
  avgSpeedKmH: number;
  totalDwellMinutes: number;
  slownessFactor: number;          // [0.0, 1.0]: 1.0 = stationary, <0.05 = highway speed
  dwellBoost: number;              // duration multiplier
  combinedWeight: number;          // composite mathematical weight
  spotRadiusPx: number;            // screen pixel radius
  spotRadiusMeters: number;        // ground meter radius
  heatIntensity: number;           // normalized [0.0, 1.0] for heatmaps
  growthClassification: SpotGrowthClassification;
  isSlowLarge: boolean;            // true if spot expanded via slowness + high visits
  geojsonFeature: GeoJSONFeature;
}

export interface GeoJSONFeature {
  type: 'Feature';
  id?: string;
  geometry: {
    type: 'Point';
    coordinates: Coordinate;
  };
  properties: Record<string, any>;
}

export interface PersonalizedMapLayerPayload {
  userId: string;
  generatedAt: string;
  summary: {
    totalPlaces: number;
    totalSpots: number;
    mostVisitedPlace: { placeId: string; name: string; visitCount: number; markerRadiusPx: number } | null;
    largestSlowSpot: { spotId: string; spotRadiusMeters: number; visitCount: number; avgSpeedKmH: number } | null;
    averageSlownessFactor: number;
  };
  placesLayer: {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
  };
  spotsLayer: {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
  };
}

export interface RecordVisitInput {
  userId: string;
  placeId?: string;
  placeName?: string;
  category?: string;
  coordinates: Coordinate; // [lon, lat]
  speedKmH?: number;
  dwellMinutes?: number;
  timestamp?: number;
}

