import { Coordinate, GeoJsonLineString } from '../../core/types/geo.types';
import { TrafficCongestionLevel } from '../car-navigation/car-navigation.types';

export type VehicleTelemetryType =
  | 'scooter'
  | 'motorcycle'
  | 'car'
  | 'auto_rickshaw'
  | 'bus'
  | 'truck'
  | 'commercial_van';

export type RoadClassification =
  | 'expressway'
  | 'national_highway'
  | 'arterial'
  | 'sub_arterial'
  | 'collector'
  | 'local_street'
  | 'service_lane';

export type IntersectionType =
  | 'signalized'
  | 'roundabout'
  | 'uncontrolled'
  | 'flyover_merge'
  | 'cloverleaf_ramp'
  | 't_junction';

/**
 * Raw or anonymized device telemetry velocity vector
 */
export interface TelemetryVelocityVector {
  deviceId: string;
  anonymizedDeviceId?: string;
  coordinate: Coordinate; // [longitude, latitude]
  speedKmh: number;
  headingDeg: number; // 0..360
  accuracyMeters?: number;
  timestamp: number; // Epoch ms
  vehicleType: VehicleTelemetryType;
  altitudeMeters?: number;
}

/**
 * Projected velocity vector on a specific road segment
 */
export interface ProjectedTelemetryVector extends TelemetryVelocityVector {
  segmentId: string;
  projectedCoordinate: Coordinate;
  lateralOffsetMeters: number; // Distance from segment centerline
  vectorAlignmentCos: number; // Cosine of heading delta (-1..1)
  projectedSpeedKmh: number; // Speed component along the road segment
  isDirectionValid: boolean; // Heading aligned within +/- 60 degrees
  isOutlier?: boolean;
  anomalyReason?: string;
}

/**
 * Cluster of slow/stationary devices evaluated for traffic vs false positive
 */
export interface MultiDeviceCluster {
  clusterId: string;
  segmentId: string;
  centroid: Coordinate;
  deviceCount: number;
  averageSpeedKmh: number;
  isQuorumReached: boolean; // At least MIN_CLUSTER_QUORUM (e.g. 3) devices
  devices: {
    anonymizedDeviceId: string;
    vehicleType: VehicleTelemetryType;
    speedKmh: number;
    lateralOffsetMeters: number;
  }[];
  classification:
    | 'CONFIRMED_CONGESTION'
    | 'ISOLATED_ANOMALY'
    | 'ROADSIDE_PAUSE'
    | 'MOVING_PLATOON';
  confidenceScore: number; // 0..1
}

/**
 * Outlier inspection result for roadside pauses (tea stall, delivery stop, etc.)
 */
export interface AnomalyEvaluationResult {
  deviceId: string;
  segmentId: string;
  isOutlier: boolean;
  anomalyType:
    | 'SINGLE_DEVICE_ROADSIDE_STOP' // e.g. Scooter at roadside tea stall
    | 'TEA_STALL_PAUSE'
    | 'CURB_PARKING'
    | 'DELIVERY_DROP_OFF'
    | 'CONFIRMED_JAM'
    | 'NORMAL_TRAFFIC';
  confidenceScore: number;
  details: {
    lateralOffsetMeters: number;
    speedKmh: number;
    segmentAverageSpeedKmh: number;
    activeClusterSize: number;
    isExcludedFromAggregation: boolean;
    explanation: string;
  };
}

/**
 * Historical speed distribution record for a 15-minute time window
 */
export interface HistoricalSpeedBucket {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  timeBucketIndex: number; // 0..95 (96 buckets per 24 hours = 15-minute intervals)
  timeWindowLabel: string; // e.g. "08:30-08:45"
  meanSpeedKmh: number;
  standardDeviationKmh: number;
  sampleCount: number;
  congestionProbability: number; // 0..1
  freeFlowSpeedKmh: number;
  p95DelaySeconds: number;
}

/**
 * Road Segment Edge in the Directed Graph
 */
export interface RoadSegmentEdge {
  segmentId: string;
  name: string;
  fromNodeId: string;
  toNodeId: string;
  lengthMeters: number;
  roadType: RoadClassification;
  freeFlowSpeedKmh: number;
  currentSpeedKmh: number;
  predictedSpeedKmh: number;
  effectiveSpeedKmh: number;
  
  // PRIMARY WEIGHTING: Travel Time in MINUTES (not kilometers!)
  travelTimeMinutes: number;
  freeFlowTravelTimeMinutes: number;
  delayMinutes: number;
  
  congestionLevel: TrafficCongestionLevel;
  geometry: Coordinate[]; // Array of [lon, lat]
  oneWay: boolean;
  activeDeviceCount: number;
  lastTelemetryTimestamp: number;
  historicalSpeedKmh?: number;
}

/**
 * Intersection Node in the Directed Graph
 */
export interface IntersectionNode {
  nodeId: string;
  name: string;
  coordinate: Coordinate; // [lon, lat]
  intersectionType: IntersectionType;
  signalCycleWaitMinutes: number; // Signal/roundabout delay penalty in minutes
  connectedOutgoingEdgeIds: string[];
  connectedIncomingEdgeIds: string[];
}

/**
 * Detailed Segment Step in calculated ETA Route
 */
export interface RouteStepEta {
  stepIndex: number;
  segmentId: string;
  roadName: string;
  fromIntersection: string;
  toIntersection: string;
  lengthMeters: number;
  travelTimeMinutes: number; // In MINUTES
  travelTimeSeconds: number;
  speedKmh: number;
  freeFlowSpeedKmh: number;
  delayMinutes: number;
  congestionLevel: TrafficCongestionLevel;
  geometry: Coordinate[];
}

/**
 * Real-time ETA Calculation Result
 */
export interface TrafficEtaResponse {
  routeId: string;
  origin: Coordinate;
  destination: Coordinate;
  totalDistanceMeters: number;
  totalDistanceKm: number;
  
  // Crucial requirement: Weighted by Travel Time in MINUTES
  totalEtaMinutes: number;
  totalEtaSeconds: number;
  freeFlowDurationMinutes: number;
  totalDelayMinutes: number;
  
  overallCongestionLevel: TrafficCongestionLevel;
  averageSpeedKmh: number;
  estimatedArrivalEpoch: number;
  bottlenecksCount: number;
  
  intersectionsCrossed: {
    nodeId: string;
    name: string;
    type: IntersectionType;
    waitMinutes: number;
    coordinate: Coordinate;
  }[];
  
  steps: RouteStepEta[];
  fullPolyline: Coordinate[];
  
  alternatives?: {
    alternativeId: string;
    name: string;
    totalEtaMinutes: number;
    totalDistanceKm: number;
    delayMinutes: number;
    congestionLevel: TrafficCongestionLevel;
    savingsMinutesVsBaseline: number;
  }[];
}
