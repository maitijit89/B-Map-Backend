import { LatLng } from '../../core/utils/response';

export interface SnappedPoint {
  location: LatLng;
  original_index: number;
  place_id: string;
}

export interface SpeedLimitItem {
  place_id: string;
  speed_limit_kmh: number;
  unit: string;
  road_name?: string;
}
