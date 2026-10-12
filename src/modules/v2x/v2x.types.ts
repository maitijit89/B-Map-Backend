import { LatLng } from '../../core/utils/response';

export type SignalPhase =
  | 'GREEN'
  | 'YELLOW'
  | 'RED'
  | 'PROTECTED_TURN_GREEN'
  | 'FLASHING_RED';

export interface LaneMovement {
  lane_index: number;
  direction: 'left' | 'through' | 'right';
  phase: SignalPhase;
  time_remaining_sec: number;
}

export interface TrafficSignalSPaT {
  intersection_id: string;
  name: string;
  location: LatLng;
  current_phase: SignalPhase;
  time_remaining_sec: number;
  cycle_duration_sec: number;
  lane_movements: LaneMovement[];
  last_updated_at: string;
}

export interface GLOSARecommendation {
  intersection_id: string;
  distance_to_light_meters: number;
  current_phase: SignalPhase;
  time_remaining_sec: number;
  recommended_speed_kmh: number;
  advisory_message: string;
  will_catch_green: boolean;
}
