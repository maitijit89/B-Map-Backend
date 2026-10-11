import { Coordinate } from '../../core/types/geo.types';
import { LaneLevelGuidance, VeteranRoutingStyle } from '../../types/lane-routing.types';
import { OsrmRoute } from '../../core/types/osrm.types';
import { FusedPositionState, RawSensorPacket } from '../../types/positioning.types';

export type DynamicRecommendationType =
  | 'faster_route' // Faster alternative route found (avoids traffic/accident)
  | 'destination_parking' // Approaching destination: recommended parking facility
  | 'along_route_energy' // Low fuel/battery: optimal EV charger or gas station
  | 'rest_break' // Extended driving fatigue alert: upcoming rest stop
  | 'lane_optimization' // Proactive lane shift ahead of bottleneck or fork
  | 'safety_hazard_alert'; // Extreme weather, black ice, or accident ahead

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface DynamicRecommendation {
  recommendationId: string;
  type: DynamicRecommendationType;
  priority: RecommendationPriority;
  title: string;
  message: string;
  timestamp: number;
  expiresAt: number;
  autoAcceptTimeoutSeconds?: number; // e.g. 15 seconds countdown
  data: {
    timeSavedSeconds?: number;
    detourDistanceMeters?: number;
    detourDurationSeconds?: number;
    alternativeRoute?: OsrmRoute;
    recommendedPoi?: {
      id: string;
      name: string;
      category: string;
      coordinates: Coordinate;
      distanceMeters: number;
      availableBays?: number;
      pricePerHour?: string;
    };
    targetLaneIndex?: number;
  };
}

export interface UnifiedSessionContext {
  sessionId: string;
  deviceId: string;
  userId?: string;
  origin: Coordinate;
  destination: Coordinate;
  activeRoute: OsrmRoute;
  routingStyle: VeteranRoutingStyle;
  startedAt: number;
  lastUpdated: number;
  drivingDurationSeconds: number;
  batteryOrFuelPercentage?: number;
  activeRecommendations: Map<string, DynamicRecommendation>;
  dismissedRecommendationIds: Set<string>;
}

export interface UnifiedTelemetryTick {
  sessionId: string;
  sensorPacket: RawSensorPacket;
  batteryOrFuelPercentage?: number;
  timestamp?: number;
}

export interface UnifiedNavigationState {
  sessionId: string;
  deviceId: string;
  timestamp: number;
  fusedPosition: FusedPositionState;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  laneGuidance?: LaneLevelGuidance;
  activeRecommendations: DynamicRecommendation[];
  isRerouted: boolean;
  systemMetrics: {
    latencyMs: number;
    gnssQualityScore: number;
    positionPrecision: string;
    engineStatus: 'optimal' | 'degraded' | 'dead_reckoning';
  };
}
