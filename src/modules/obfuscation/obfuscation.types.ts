import { LatLng } from '../../core/utils/response';

export type CoordinateDatum = 'WGS84' | 'GCJ02' | 'BD09';

export interface TransformRequest {
  location?: LatLng;
  latitude?: number;
  longitude?: number;
  source_datum?: CoordinateDatum;
  sourceDatum?: CoordinateDatum;
  target_datum?: CoordinateDatum;
  targetDatum?: CoordinateDatum;
}

export interface TransformResponse {
  original_location: LatLng;
  target_location: LatLng;
  source_datum: CoordinateDatum;
  target_datum: CoordinateDatum;
}

export interface FuzzRequest {
  location?: LatLng;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  radiusMeters?: number;
  epsilon?: number;
}

export interface FuzzResponse {
  original_location: LatLng;
  fuzzed_location: LatLng;
  noise_radius_meters: number;
  privacy_mechanism: string;
}

export interface DefenseZone {
  id: string;
  name: string;
  category: 'AIR_BASE' | 'NAVAL_BASE' | 'DRDO_TEST_RANGE' | 'MILITARY_CANTONMENT' | 'STRATEGIC_ASSET';
  center: LatLng;
  bufferRadiusMeters: number;
}

export interface DefenseMaskingRequest {
  location?: LatLng;
  latitude?: number;
  longitude?: number;
  minJitterMeters?: number;
  maxJitterMeters?: number;
}

export interface DefenseMaskingResponse {
  original_location: LatLng;
  obfuscated_location: LatLng;
  is_within_defense_zone: boolean;
  zone_name?: string;
  zone_category?: string;
  jitter_distance_meters: number;
  policy_compliance: string;
}
