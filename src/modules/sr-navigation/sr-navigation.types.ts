import { Coordinate, GeoJsonLineString } from '../../core/types/geo.types';
import { LaneTurnDirection, LaneType } from '../../types/lane-routing.types';

export type SRBoundaryType =
  | 'solid_white'
  | 'dashed_white'
  | 'double_solid_white'
  | 'solid_yellow'
  | 'dashed_yellow'
  | 'double_solid_yellow'
  | 'curb'
  | 'guardrail';

export type SRRoadMarkingType =
  | 'straight_arrow'
  | 'left_turn_arrow'
  | 'right_turn_arrow'
  | 'u_turn_arrow'
  | 'merge_arrow'
  | 'crosswalk'
  | 'stop_line'
  | 'speed_limit_number'
  | 'bicycle_sharrow'
  | 'deceleration_fishbone';

export interface SRLaneBoundary {
  boundaryIndex: number;
  boundaryType: SRBoundaryType;
  color: 'white' | 'yellow';
  coordinates: Coordinate[];
}

export interface SRRoadSurfaceMarking {
  markingType: SRRoadMarkingType;
  laneIndex: number;
  location: Coordinate;
  label?: string;
}

export type SRObjectClassification =
  | 'car'
  | 'truck'
  | 'bus'
  | 'motorcycle'
  | 'bicycle'
  | 'pedestrian'
  | 'traffic_cone'
  | 'barrier';

export interface SRPerceptionObject {
  id: string;
  classification: SRObjectClassification;
  relativePosition: {
    lateralMeters: number; // Negative = left, positive = right
    longitudinalMeters: number; // Positive = ahead, negative = behind
  };
  absoluteLocation?: Coordinate;
  speedKmh: number;
  relativeSpeedKmh: number;
  laneIndex?: number;
  isCutIn?: boolean;
  timeToCollisionSeconds?: number;
}

export interface SRJunctionCard {
  junctionId: string;
  junctionName: string;
  junctionType: 'roundabout' | 'highway_split' | 'highway_merge' | 'flyover_fork' | 'complex_crossroad';
  distanceMeters: number;
  highlightedLaneIndices: number[];
  allLanes: {
    laneIndex: number;
    turnDirection: LaneTurnDirection;
    isHighlighted: boolean;
    overheadSignText?: string;
  }[];
  overheadGantry?: {
    signText: string;
    destinationCities?: string[];
    routeShields?: string[];
  };
  schematicSvgOrModelKey?: string;
}

export interface SRLateralOffsetState {
  matchedLaneIndex: number;
  lateralOffsetFromCenterMeters: number;
  distanceToLeftBoundaryMeters: number;
  distanceToRightBoundaryMeters: number;
  laneWidthMeters: number;
  isDepartingLane: boolean;
  departureDirection?: 'left' | 'right';
  departureWarning: boolean;
}

export interface SRNavigationHUDState {
  timestamp: number;
  currentRoad: string;
  speedKmh: number;
  speedLimitKmh: number;
  lateralOffset: SRLateralOffsetState;
  activeLanes: {
    laneIndex: number;
    type: LaneType;
    direction: LaneTurnDirection;
    isOptimal: boolean;
    statusText: string;
  }[];
  recommendedLaneIndex: number;
  laneChangeUrgency: 'none' | 'prepare' | 'execute' | 'critical';
  laneChangeManeuver?: {
    targetLaneIndex: number;
    distanceMeters: number;
    voiceText: string;
    hudVisualPrompt: string;
  };
  surroundingObjects: SRPerceptionObject[];
  forwardCollisionWarning: boolean;
  activeJunctionCard?: SRJunctionCard;
}
