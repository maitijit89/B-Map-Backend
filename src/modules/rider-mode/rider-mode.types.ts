import { Coordinate, GeoJsonLineString } from '../../core/types/geo.types';

export type RiderVehicleType =
  | 'heavy_motorcycle'
  | 'commuter_motorcycle'
  | 'scooter_moped'
  | 'ebike_delivery'
  | 'bicycle';

export interface RiderRoutingPreferences {
  vehicleType: RiderVehicleType;
  avoidExpressways: boolean;
  avoidTolls: boolean;
  preferDedicatedMotorcycleLanes: boolean;
  allowPassableAlleys: boolean;
  avoidHighRiskSurfaces: boolean;
}

export type RiderHazardType =
  | 'tram_tracks'
  | 'metal_bridge_joint'
  | 'slippery_manhole'
  | 'loose_gravel_apex'
  | 'severe_pothole'
  | 'steep_stairs_no_access'
  | 'high_crosswind_zone'
  | 'black_ice_risk';

export interface RiderHazardReport {
  hazardId: string;
  type: RiderHazardType;
  location: Coordinate;
  severity: 'low' | 'medium' | 'high' | 'critical';
  warningMessage: string;
  verifiedReportsCount: number;
}

export interface RiderDynamicsTelemetry {
  timestamp: number;
  vehicleSpeedKmh: number;
  rollAngleDegrees: number; // negative = left lean, positive = right lean
  pitchAngleDegrees: number;
  yawRateDegPerSec: number;
  lateralAccelerationG: number;
  curveRadiusMeters?: number;
}

export interface RiderLeanStats {
  currentLeanDegrees: number;
  maxLeftLeanDegrees: number;
  maxRightLeanDegrees: number;
  leanLimitDegrees: number;
  smoothnessScore: number;
  corneringAdvisory?: {
    recommendedSpeedKmh: number;
    warning: string;
  };
}

export interface RiderWeatherCondition {
  temperatureCelsius: number;
  weatherState: 'clear' | 'rain' | 'heavy_rain' | 'fog' | 'snow';
  windSpeedKmh: number;
  windGustKmh: number;
  windDirectionDegrees: number;
  roadFrictionCoefficient: number;
}

export interface RiderWeatherAlert {
  alertType: 'crosswind_warning' | 'wet_slick_road' | 'low_temp_ice' | 'reduced_visibility';
  severity: 'caution' | 'warning' | 'danger';
  message: string;
  speedLimitAdjustmentKmh: number;
}

export interface HelmetAudioCue {
  cueId: string;
  audioChime: 'single_beep' | 'double_beep' | 'alert_chime' | 'arrival_jingle';
  conciseText: string;
  audioDuckingPercent: number;
  priority: 'low' | 'medium' | 'high' | 'emergency';
}

export interface GloveUILayout {
  displayMode: 'glove_touch_high_contrast' | 'handlebar_switch_mode';
  primaryButtons: {
    slot: 1 | 2 | 3 | 4;
    label: string;
    action: string;
    icon: string;
  }[];
}

export interface RiderCrashEvent {
  eventId: string;
  timestamp: number;
  location: Coordinate;
  impactDecelerationG: number;
  sustainedTiltAngleDegrees: number;
  stationaryDurationSeconds: number;
  emergencyDispatchTriggered: boolean;
  medicalProfile?: {
    riderName: string;
    bloodType: string;
    emergencyContacts: string[];
  };
  status: 'detected' | 'countdown_cancelling' | 'dispatched' | 'cancelled_by_rider';
}

export interface RiderNavigationState {
  vehicleType: RiderVehicleType;
  currentLeanStats: RiderLeanStats;
  weatherAlerts: RiderWeatherAlert[];
  nearbyHazards: RiderHazardReport[];
  audioCue?: HelmetAudioCue;
  activeCrashAlert?: RiderCrashEvent;
  gloveUI: GloveUILayout;
}
