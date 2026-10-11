import { Coordinate, GeoJsonLineString, OffRouteDetectionResult } from '../../core/types/geo.types';
import { OsrmRoute, OsrmStep } from '../../core/types/osrm.types';

export { OffRouteDetectionResult };

export type NavigationSessionStatus = 'active' | 'completed' | 'cancelled' | 'paused';

export interface NavigationSessionData {
  sessionId: string;
  userId: string;
  routeId?: string;
  origin: Coordinate;
  destination: Coordinate;
  waypoints?: Coordinate[];
  profile: 'driving' | 'bike' | 'foot';
  status: NavigationSessionStatus;
  currentRoute: OsrmRoute;
  currentStepIndex: number;
  currentLocation?: Coordinate;
  heading?: number;
  speed?: number;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  distanceToNextStepMeters: number;
  nextStep?: OsrmStep;
  rerouteCount: number;
  lastRerouteTimestamp?: number;
  startedAt: Date;
  updatedAt: Date;
}

export interface NavigationProgressUpdate {
  sessionId: string;
  currentLocation: Coordinate; // [lon, lat]
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp?: number;
}

export interface NavigationProgressResponse {
  sessionId: string;
  status: NavigationSessionStatus;
  currentLocation: Coordinate;
  currentStepIndex: number;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  distanceToNextStepMeters: number;
  currentStep?: OsrmStep;
  nextStep?: OsrmStep;
  isOffRoute: boolean;
  distanceFromRouteMeters: number;
  rerouted?: boolean;
  updatedRoute?: OsrmRoute;
}
