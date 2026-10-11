import { Coordinate, GeoJsonLineString } from '../../core/types/geo.types';

export interface TrajectoryPoint {
  longitude: number;
  latitude: number;
  altitude?: number;
  speedMps: number;
  headingDegrees?: number;
  timestamp: number;
}

export interface StayPoint {
  stayPointId: string;
  coordinates: Coordinate; // [lon, lat] centroid
  startTime: number;
  endTime: number;
  durationSeconds: number;
  averageSpeedMps: number;
  rawPointCount: number;
  clusterId?: string;
}

export interface StayPointCluster {
  clusterId: string;
  centroid: Coordinate;
  stayPointCount: number;
  totalDwellHours: number;
  estimatedCategory: string; // 'restaurant' | 'fuel' | 'shopping' | 'residence' | 'workplace'
  confidence: number;
  peakHourOfDay: number;
}

export interface RawCandidatePoi {
  sourceId?: string;
  sourceName: string; // 'user_checkin' | 'web_crawl' | 'trajectory_mining' | 'telematics'
  name: string;
  category: string;
  address?: string;
  coordinates: Coordinate;
  phone?: string;
  confidenceScore: number;
}

export interface MasterPoiProfile {
  masterId: string;
  canonicalName: string;
  aliases: string[];
  category: string;
  coordinates: Coordinate;
  address?: {
    street?: string;
    city?: string;
    district?: string;
  };
  entrances: {
    type: 'main' | 'parking' | 'delivery' | 'pedestrian';
    coordinates: Coordinate;
    description?: string;
  }[];
  vitalityScore: number; // 0..100 (business footfall vitality)
  visitCount30d: number;
  peakHours: Record<number, number>; // Hour 0..23 -> relative visit volume
  freshnessStatus: 'active' | 'seasonal' | 'defunct_risk' | 'verified_closed';
  mergedSourcesCount: number;
  lastVerifiedAt: number;
}

export type RoadChangeType =
  | 'new_road_discovered'
  | 'road_closure_detected'
  | 'turn_restriction_changed'
  | 'speed_limit_deviation';

export interface RoadChangeDetection {
  changeId: string;
  type: RoadChangeType;
  roadName?: string;
  geometry: GeoJsonLineString;
  confidenceScore: number; // 0..100
  supportingTrajectoriesCount: number;
  firstObservedAt: number;
  lastObservedAt: number;
  status: 'pending_review' | 'auto_approved' | 'rejected';
  metadata?: Record<string, any>;
}
