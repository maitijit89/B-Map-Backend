import { Coordinate, GeoJsonLineString, GeoJsonPoint } from '../../core/types/geo.types';

export type LaneTurnDirection =
  | 'straight'
  | 'left'
  | 'right'
  | 'slight_left'
  | 'slight_right'
  | 'u_turn'
  | 'left_straight'
  | 'right_straight';

export type LaneType =
  | 'normal'
  | 'bus_only'
  | 'hov_carpool' // High-Occupancy Vehicle
  | 'reversible' // Tidal lane changing direction by time
  | 'emergency'
  | 'toll_etc'
  | 'exit_ramp';

export type LaneStatus =
  | 'optimal' // Highly recommended for upcoming maneuver
  | 'acceptable' // Valid lane, allows maneuver
  | 'suboptimal' // Permitted but requires imminent lane change
  | 'forbidden' // Prohibited (e.g. turns wrong way, bus lane active)
  | 'blocked'; // Temporary hazard or construction blockage

export interface TimeRestriction {
  startHour: number; // 0..23 (e.g., 7 for 07:00)
  endHour: number; // 0..23 (e.g., 9 for 09:00)
  daysOfWeek: number[]; // 1=Mon, ..., 7=Sun
  allowedVehicleTypes: ('bus' | 'taxi' | 'emergency' | 'all')[];
}

export interface LaneDetail {
  laneIndex: number; // 0 = left-most lane, 1 = second from left, etc.
  turnDirection: LaneTurnDirection;
  laneType: LaneType;
  widthMeters: number;
  speedLimitKmh: number;
  restrictions?: TimeRestriction[];
  isActive?: boolean;
}

export interface LaneSegment {
  segmentId: string;
  roadName: string;
  roadClass: 'motorway' | 'trunk' | 'primary' | 'secondary' | 'residential';
  totalLanes: number;
  lanes: LaneDetail[];
  geometry: GeoJsonLineString;
  lengthMeters: number;
  // Map of which laneIndex connects to which targetLaneIndices on the next segment
  nextLaneTransitions?: Record<number, number[]>;
}

export interface LaneChangePrompt {
  fromLaneIndex: number;
  targetLaneIndex: number;
  distanceToManeuverMeters: number;
  recommendedChangeStartMeters: number;
  urgency: 'early_notice' | 'recommended' | 'urgent' | 'critical';
  instructionText: string;
}

export interface LaneLevelGuidance {
  currentRoadName: string;
  currentLaneIndex?: number;
  totalLanes: number;
  lanes: {
    laneIndex: number;
    turnDirection: LaneTurnDirection;
    laneType: LaneType;
    status: LaneStatus;
    reason?: string;
  }[];
  recommendedLanes: number[];
  prompt?: LaneChangePrompt;
  distanceToNextTurnMeters: number;
  nextManeuverDirection: LaneTurnDirection;
}

// ==========================================
// "Veteran Driver" Layer Types (老司机经验图层)
// ==========================================

export type VeteranRoutingStyle =
  | 'standard' // Default shortest/fastest algorithm
  | 'veteran_fast' // Veteran Speed: exploits proven local shortcuts, avoids bad signal delays
  | 'veteran_smooth' // Veteran Comfort: avoids tricky merges, speed bumps, awkward U-turns
  | 'novice_friendly' // Novice Shield: widest lanes, easy merges, no multi-lane cuts or narrow streets
  | 'commuter_smart'; // Commuter Habits: learns habitual time-of-day flow

export type VeteranHazardType =
  | 'frequent_bottleneck' // Notorious bottleneck trap
  | 'awkward_merge' // Blind or dangerous merge angle
  | 'difficult_left_turn' // Unprotected left across multi-lane traffic
  | 'heavy_jaywalking' // Pedestrian density hotspot
  | 'illegal_parking_blockage' // Curbside delivery/parking blocking right lane
  | 'severe_potholes' // Rough road / speed bumps
  | 'blind_corner' // Zero-visibility turn
  | 'strict_enforcement_camera'; // Speed trap or bus lane camera

export interface VeteranExperienceSegment {
  segmentId: string;
  roadName: string;
  geometry: GeoJsonLineString;
  // Crowd-sourced score multiplier (e.g. 0.8 = 20% faster than map theoretical speed, 1.6 = notorious jam)
  speedEfficiencyRatio: number;
  veteranPreferenceScore: number; // 0..100 (high = seasoned drivers frequently choose this route)
  noviceDifficultyRating: number; // 1..5 (5 = extremely difficult for novice drivers)
  hazards: {
    type: VeteranHazardType;
    description: string;
    location: Coordinate;
    verifiedReportsCount: number;
    isActive: boolean;
  }[];
  shortcutAlternativeForSegmentId?: string; // Links this segment as a veteran bypass for a congested main road
  shortcutTimeSavedSeconds?: number;
  historicalPaceByHour?: Record<number, number>; // Hour 0..23 -> average historical speed km/h
}

export interface VeteranRouteOptions {
  origin: Coordinate;
  destination: Coordinate;
  style: VeteranRoutingStyle;
  avoidHazards?: VeteranHazardType[];
  allowAlleyShortcuts?: boolean;
}

export interface VeteranRouteAnalysis {
  chosenStyle: VeteranRoutingStyle;
  originalDurationSeconds: number;
  veteranAdjustedDurationSeconds: number;
  timeSavedSeconds: number;
  veteranShortcutsApplied: {
    roadName: string;
    timeSavedSeconds: number;
    description: string;
  }[];
  hazardsAvoided: {
    type: VeteranHazardType;
    roadName: string;
    description: string;
  }[];
  noviceFriendlinessScore: number; // 0..100
  laneChangeSmoothnessScore: number; // 0..100 (fewer multi-lane jumps = higher score)
}
