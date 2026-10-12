import { LatLng } from '../../core/utils/response';

export type HazardType =
  | 'SPEED_BREAKER_UNMARKED'
  | 'MONSOON_WATERLOGGING'
  | 'POTHOLE_CLUSTER'
  | 'CATTLE_ON_HIGHWAY'
  | 'NARROW_GULLY_BOTTLENECK'
  | 'OPEN_DRAINAGE_CONSTRUCTION'
  | 'POTHOLE'
  | 'SPEED_BREAKER'
  | 'ACCIDENT';

export interface RoadHazard {
  id: string;
  type: HazardType;
  severity: 'LOW' | 'MODERATE' | 'CRITICAL';
  location: LatLng;
  description: string;
  voice_prompt: string;
  reported_at: string;
  confirmations_count: number;
}

export interface HazardQueryRequest {
  currentLocation?: LatLng;
  latitude?: number;
  longitude?: number;
  lookaheadMeters?: number;
  headingDegrees?: number;
}
