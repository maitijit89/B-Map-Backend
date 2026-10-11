import { Coordinate } from '../../core/types/geo.types';

// ==========================================
// Apple CarPlay & Android Auto Projection
// ==========================================

export interface CarPlayManeuver {
  symbolImage: string; // Arrow SVG or icon identifier
  instructionVariants: string[];
  junctionImage?: string;
  distanceMeters: number;
  remainingTimeSeconds: number;
}

export interface CarPlayTravelEstimates {
  distanceRemainingMeters: number;
  timeRemainingSeconds: number;
  destinationArrivalEpoch: number;
  speedLimitKmh?: number;
}

export interface CarPlayNavigationTemplate {
  currentManeuver: CarPlayManeuver;
  nextManeuver?: CarPlayManeuver;
  travelEstimates: CarPlayTravelEstimates;
  tripProgressPercentage: number;
  colorScheme: 'day' | 'night';
  speedLimit?: number;
  voicePrompt?: string;
}

export interface AndroidAutoActionStrip {
  actions: {
    id: string;
    title: string;
    icon: string;
    actionType: 'reroute' | 'overview' | 'mute' | 'stop_search';
  }[];
}

export interface AndroidAutoNavigationTemplate {
  headerTitle: string;
  stepManeuver: {
    title: string;
    description: string;
    iconUri: string;
    distanceToStepMeters: number;
  };
  laneGuidanceCard?: {
    lanes: {
      icons: string[];
      isRecommended: boolean;
    }[];
  };
  junctionAlertCard?: {
    imageKey: string;
    turnTitle: string;
  };
  travelEstimates: {
    formattedRemainingDistance: string;
    formattedDuration: string;
    formattedEta: string;
  };
  actionStrip: AndroidAutoActionStrip;
  isSplitScreen: boolean;
}

// ==========================================
// AAOS (Android Automotive OS) & VHAL
// ==========================================

export interface AAOSVehicleState {
  speedKmh: number;
  gear: 'P' | 'R' | 'N' | 'D';
  steeringWheelAngleDegrees: number;
  turnSignal: 'NONE' | 'LEFT' | 'RIGHT';
  fuelLevelPercent?: number;
  evBatteryPercent?: number;
  tirePressureBar?: { fl: number; fr: number; rl: number; rr: number };
  wipersActive: boolean;
  headlightsOn: boolean;
}

// ==========================================
// CAN Bus / OBD-II Telemetry & Eco Scoring
// ==========================================

export interface CANBusTelemetryPacket {
  vin?: string;
  timestamp: number;
  engineRpm?: number;
  motorPowerKw?: number;
  instantFuelFlowLitersPerHour?: number;
  instantEnergyKwhPer100km?: number;
  odometerKm: number;
  brakePedalPressed: boolean;
  acceleratorPedalPositionPercent: number;
  regenerativeBrakingKw?: number;
}

export interface EcoDrivingScore {
  overallScore: number; // 0..100
  harshAccelerations: number;
  harshBrakingEvents: number;
  idleWasteMinutes: number;
  co2SavedKg: number;
  tips: string[];
}

// ==========================================
// EV Range & Charging Stop Planning
// ==========================================

export interface EVVehicleProfile {
  make: string;
  model: string;
  batteryCapacityKwh: number;
  usableCapacityKwh: number;
  consumptionWhPerKm: number;
  maxDcChargingPowerKw: number;
  connectorTypes: ('CCS2' | 'Type2' | 'NACS' | 'GB/T' | 'CHAdeMO')[];
}

export interface EVChargingStop {
  stationId: string;
  stationName: string;
  location: Coordinate;
  chargerPowerKw: number;
  arrivalSocPercent: number;
  targetSocPercent: number;
  estimatedChargingMinutes: number;
  detourTimeMinutes: number;
  preConditioningTriggered: boolean;
}

export interface EVSmartRoutePlan {
  origin: Coordinate;
  destination: Coordinate;
  totalDistanceMeters: number;
  initialSocPercent: number;
  projectedArrivalSocPercent: number;
  isChargingRequired: boolean;
  chargingStops: EVChargingStop[];
  batteryPreConditioningScheduledAtMeters?: number;
  summaryMessage: string;
}

// ==========================================
// Smart HUD (Heads-Up Display) Protocol
// ==========================================

export interface SmartHUDFrame {
  timestamp: number;
  maneuverCode: number;
  maneuverSymbol: string;
  distanceBarPercent: number;
  targetLaneBitmask: number;
  vehicleSpeedKmh: number;
  speedLimitKmh: number;
  overspeedWarning: boolean;
  adasWarningCode: number;
  compactHexPayload: string;
}

export interface CockpitSyncEvent {
  screenTarget: 'center_console' | 'instrument_cluster' | 'head_up_display' | 'all';
  payloadType: 'navigation' | 'media' | 'alert' | 'charging';
  data: any;
}
