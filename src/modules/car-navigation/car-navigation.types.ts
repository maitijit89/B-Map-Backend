import { Coordinate, GeoJsonLineString } from '../../core/types/geo.types';
import { OsrmRoute } from '../../core/types/osrm.types';

export type CarRoutingStrategy =
  | 'fastest'
  | 'shortest'
  | 'avoid_tolls'
  | 'avoid_highways'
  | 'eco_friendly'
  | 'avoid_congestion'
  | 'scenic';

export type TrafficCongestionLevel =
  | 'free_flow' // Green (> 80% speed limit)
  | 'slow' // Yellow (50% - 80% speed limit)
  | 'congested' // Orange/Red (25% - 50% speed limit)
  | 'severe_gridlock'; // Dark Red (< 25% speed limit)

export interface TrafficSegment {
  segmentId: string;
  roadName: string;
  congestionLevel: TrafficCongestionLevel;
  speedLimitKmh: number;
  currentSpeedKmh: number;
  speedMultiplier: number;
  lengthMeters: number;
  delaySeconds: number;
  geometry: Coordinate[];
}

export interface SpeedCameraAlert {
  cameraId: string;
  type: 'fixed_radar' | 'red_light' | 'section_average_speed' | 'mobile_trap';
  location: Coordinate;
  speedLimitKmh: number;
  distanceAheadMeters: number;
  warningMessage: string;
}

export interface RouteAlternativeComparison {
  routeId: string;
  strategy: CarRoutingStrategy;
  route: OsrmRoute;
  summary: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  durationDeltaMinutes: number; // e.g. -5 mins faster than default
  tollFeeEstimated: number; // in currency units
  fuelOrEnergyEstimated: {
    litersOrKwh: number;
    unit: 'liters' | 'kWh';
    costEstimated: number;
  };
  trafficLightsCount: number;
  congestionPercentage: number;
  trafficSegments: TrafficSegment[];
  speedCameras: SpeedCameraAlert[];
}

export interface MultiStopWaypointsPlan {
  optimizedOrder: {
    stopIndex: number;
    name: string;
    coordinates: Coordinate;
    estimatedArrivalEpoch: number;
    distanceFromPreviousMeters: number;
    durationFromPreviousSeconds: number;
  }[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  fullRoute: OsrmRoute;
}
