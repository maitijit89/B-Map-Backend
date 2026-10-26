import { Coordinate } from '../../core/types/geo.types';

export type BayType =
  | 'standard'
  | 'compact'
  | 'accessible_disabled'
  | 'ev_charging'
  | 'vip'
  | 'motorcycle';

export type BayStatus =
  | 'vacant'
  | 'occupied'
  | 'reserved'
  | 'maintenance';

export interface AisleNode {
  id: string;
  coordinates: Coordinate;
  type: 'intersection' | 'ramp' | 'elevator' | 'bay_access';
}

export interface AisleEdge {
  fromNode: string;
  toNode: string;
  distanceMeters: number;
  isOneWay: boolean;
}

export interface ParkingFloorLevel {
  levelNumber: number; // e.g., -2 for B2
  name: string; // "B2", "B1", "P1"
  heightLimitMeters: number;
  totalSpaces: number;
  availableSpaces: number;
  aisleGraphNodes: AisleNode[];
  aisleGraphEdges: AisleEdge[];
}

export interface ParkingFacility {
  facilityId: string;
  name: string;
  address: string;
  location: Coordinate;
  boundaryPolygon?: Coordinate[];
  entranceGates: {
    gateId: string;
    name: string;
    barrierCoordinates: Coordinate;
  }[];
  exitGates: {
    gateId: string;
    name: string;
    barrierCoordinates: Coordinate;
  }[];
  floors: ParkingFloorLevel[];
  hourlyRate: number;
}

export interface ParkingBay {
  bayId: string;
  facilityId: string;
  floorLevel: number;
  floorName: string;
  zone: string;
  spaceNumber: string;
  coordinates: Coordinate;
  dimensions: {
    lengthMeters: number;
    widthMeters: number;
  };
  bayType: BayType;
  status: BayStatus;
  sensorType: 'ultrasonic' | 'geomagnetic' | 'camera_ai' | 'manual';
  evCharger?: {
    powerKw: number;
    plugType: 'CCS2' | 'Type2' | 'NACS' | 'GB/T';
    isAvailable: boolean;
  };
  distanceToNearestElevatorMeters: number;
  nearestAisleNodeId: string;
  assignedVehicleLicensePlate?: string;
}

export interface IndoorNavigationStep {
  stepIndex: number;
  instruction: string;
  distanceMeters: number;
  turnDirection:
    | 'straight'
    | 'left'
    | 'right'
    | 'slight_left'
    | 'slight_right'
    | 'ramp_down'
    | 'ramp_up'
    | 'destination';
  targetFloorLevel: number;
  geometry: Coordinate[];
}

export interface IndoorRoutePlan {
  facilityId: string;
  entranceGateId: string;
  targetBayId: string;
  targetFloor: string;
  spaceNumber: string;
  totalDistanceMeters: number;
  estimatedDurationSeconds: number;
  steps: IndoorNavigationStep[];
  fullPolyline: Coordinate[];
}

export interface FindMyCarPedestrianRoute {
  startLocationType: 'elevator' | 'staircase' | 'pedestrian_entrance';
  startCoordinates: Coordinate;
  parkedBay: ParkingBay;
  walkingDistanceMeters: number;
  walkingSteps: {
    instruction: string;
    distanceMeters: number;
  }[];
}

export interface ParkingReservation {
  reservationId: string;
  bayId: string;
  facilityId: string;
  userId: string;
  reservedAt: number;
  expiresAt: number;
  pinCode: string;
  status: 'active' | 'checked_in' | 'completed' | 'cancelled' | 'expired';
}

export interface ParkingCheckInResult {
  sessionId: string;
  reservationId?: string;
  bayId: string;
  checkInTime: number;
  hourlyRate: number;
}
