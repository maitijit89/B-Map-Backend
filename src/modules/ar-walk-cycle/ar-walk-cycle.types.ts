import { Coordinate } from '../../core/types/geo.types';

// ==========================================
// Augmented Reality (AR) Visual Guidance
// ==========================================

export type ARWorldAnchorType =
  | 'floating_chevron'
  | 'ground_arrow'
  | 'distance_ring'
  | 'destination_beacon'
  | 'turn_billboard'
  | 'pedestrian_zebra_highlight';

export interface ARAnchorNode {
  id: string;
  type: ARWorldAnchorType;
  worldCoordinate: Coordinate;
  altitudeMeters: number; // 0m = on ground, 2m = floating eye-level
  stepIndex: number;
  label?: string;
  headingDegrees: number;
}

export interface ARCameraPose {
  latitude: number;
  longitude: number;
  altitude: number;
  yawDegrees: number; // Compass azimuth 0..360
  pitchDegrees: number; // Tilt: -90 looking down, 0 level, +90 up
  rollDegrees: number;
  fovHorizontalDegrees: number;
}

export interface ARScreenProjection {
  anchorId: string;
  type: ARWorldAnchorType;
  screenXPercent: number; // 0..100 (50 = screen center)
  screenYPercent: number; // 0..100
  distanceMeters: number;
  scale: number;
  isVisibleInView: boolean;
  label?: string;
}

export interface ARHUDFrame {
  timestamp: number;
  currentStepInstruction: string;
  distanceToNextTurnMeters: number;
  projectedAnchors: ARScreenProjection[];
  crosswalkSafety?: {
    isCrossingRoad: boolean;
    safetyText: string;
    pedestrianSignal?: 'walk' | 'wait';
  };
}

// ==========================================
// Specialized Walk / Pedestrian Routing
// ==========================================

export interface WalkRouteOptions {
  accessibleMode?: boolean; // Wheelchair & stroller: no stairs, ramp/elevator preference
  shelteredMode?: boolean; // Weather sheltered / covered walkway preference
  quietParkPriority?: boolean; // Priority for parks and car-free footpaths
}

export interface WalkRouteResult {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  isWheelchairAccessible: boolean;
  stairsCount: number;
  shelteredPercentage: number;
  steps: {
    instruction: string;
    distanceMeters: number;
    hasStairs: boolean;
    isCovered: boolean;
    geometry: Coordinate[];
  }[];
  geometry: Coordinate[];
}

// ==========================================
// Specialized Cycle / Micro-Mobility Routing
// ==========================================

export type CycleVehicleType =
  | 'city_bike'
  | 'road_bike'
  | 'ebike'
  | 'cargo_bike';

export interface ElevationProfile {
  totalAscentMeters: number;
  totalDescentMeters: number;
  maxSlopePercent: number;
  elevationSamples: {
    distanceMeters: number;
    elevationMeters: number;
  }[];
  steepSections: {
    fromDistMeters: number;
    toDistMeters: number;
    slopePercent: number;
    warning: string;
  }[];
}

export interface BikeAmenity {
  amenityId: string;
  type: 'repair_stand' | 'air_pump' | 'ebike_charger' | 'secure_lockers' | 'bike_share_dock';
  name: string;
  location: Coordinate;
  availableBikesOrDocks?: {
    bikes: number;
    docks: number;
  };
}

export interface CycleRouteResult {
  vehicleType: CycleVehicleType;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  protectedBikePathPercentage: number;
  elevation: ElevationProfile;
  amenitiesAlongRoute: BikeAmenity[];
  caloriesBurned: number;
  steps: {
    instruction: string;
    distanceMeters: number;
    isProtectedLane: boolean;
    geometry: Coordinate[];
  }[];
  geometry: Coordinate[];
}
