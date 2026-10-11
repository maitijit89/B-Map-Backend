import { Coordinate } from '../../core/types/geo.types';

// GNSS Fix Quality
export type GnssFixType =
  | 'none'
  | '2d'
  | '3d'
  | 'dgps' // Differential GPS (~0.5 - 1.5m)
  | 'rtk_float' // RTK Float (~0.2 - 0.5m)
  | 'rtk_fixed'; // RTK Fixed (~0.01 - 0.05m centimeter-level)

// Operating Environment Type
export type EnvironmentType =
  | 'open_sky' // Strong GNSS, low multipath
  | 'urban_canyon' // High multipath, high PDOP, partially occluded
  | 'tunnel' // Severe GNSS signal blockage, linear constrained motion
  | 'underground_parking' // Complete GNSS outage, multi-floor indoor structure
  | 'indoor'; // Complex indoor pedestrian / vehicle structure

// Positioning Precision Classification
export type PrecisionLevel =
  | 'centimeter_level' // RTK Fixed (< 0.1m)
  | 'lane_level' // RTK Float / High-Precision Fusion (< 0.5m)
  | 'meter_level' // Standard DGPS / Fused GNSS (< 3.0m)
  | 'dead_reckoning' // Pure IMU + Odometry extrapolation (< 5.0m depending on duration)
  | 'weak_signal_fallback'; // Wi-Fi / BLE / Cell RSSI trilateration (< 10.0m)

export interface RawGnssData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number; // Reported radius in meters
  speed?: number; // Speed over ground in m/s
  bearing?: number; // Course over ground in degrees (0..360)
  hdop?: number; // Horizontal Dilution of Precision
  vdop?: number; // Vertical Dilution of Precision
  pdop?: number; // Position Dilution of Precision
  satellitesInView?: number;
  satellitesUsed?: number;
  cnoRatios?: number[]; // Carrier-to-Noise density ratio (dB-Hz) per satellite
  fixType?: GnssFixType;
  timestamp: number;
}

export interface ImuData {
  timestamp: number;
  // 3-axis Accelerometer in m/s^2 (vehicle frame: x=lateral, y=longitudinal, z=vertical)
  accelerometer: {
    x: number;
    y: number;
    z: number;
  };
  // 3-axis Gyroscope in rad/s (vehicle frame: x=roll, y=pitch, z=yaw rate)
  gyroscope: {
    x: number;
    y: number;
    z: number;
  };
  // 3-axis Magnetometer in microteslas (optional)
  magnetometer?: {
    x: number;
    y: number;
    z: number;
  };
}

export interface OdometryData {
  timestamp: number;
  speedMps: number; // Wheel speed in m/s
  wheelTicks?: number; // Accumulated pulse count
  gear?: 'forward' | 'reverse' | 'neutral' | 'park';
}

export interface WifiAccessPoint {
  bssid: string; // MAC address
  rssi: number; // Received Signal Strength Indication (dBm)
  frequency?: number; // MHz (e.g., 2412 or 5180)
  ssid?: string;
}

export interface BleBeacon {
  uuid: string;
  major: number;
  minor: number;
  rssi: number; // dBm
  txPower?: number; // Calibrated RSSI at 1 meter (default: -59 dBm)
  floorLevel?: number;
}

export interface CellularTower {
  cellId: number;
  lac: number;
  mcc: number;
  mnc: number;
  signalStrength: number; // dBm
}

export interface EnvironmentalSignals {
  wifi?: WifiAccessPoint[];
  beacons?: BleBeacon[];
  cellular?: CellularTower[];
}

export interface RawSensorPacket {
  deviceId: string;
  timestamp: number;
  gnss?: RawGnssData;
  imu?: ImuData;
  odometry?: OdometryData;
  signals?: EnvironmentalSignals;
  metadata?: Record<string, any>;
}

export interface FusedPositionState {
  deviceId: string;
  timestamp: number;
  coordinates: Coordinate; // [longitude, latitude]
  altitude?: number;
  speedMps: number;
  headingDegrees: number; // 0..360
  precisionLevel: PrecisionLevel;
  environment: EnvironmentType;
  confidenceRadiusMeters: number;
  isDeadReckoningActive: boolean;
  deadReckoningDurationSeconds: number;
  laneInfo?: {
    assignedLaneIndex: number; // 0: left-most, 1: middle, etc.
    distanceToCenterLineMeters: number;
    confidence: number;
  };
  rtkStatus?: {
    fixType: GnssFixType;
    baselineLengthKm?: number;
    ageOfCorrectionsSeconds?: number;
  };
  metrics: {
    gnssQualityScore: number; // 0..100
    filterInnovationDistanceMeters: number;
    imuBiasDriftEstimate: number;
  };
}

export interface BeaconAnchor {
  id: string;
  uuid: string;
  major: number;
  minor: number;
  location: Coordinate; // [longitude, latitude]
  altitude?: number;
  floorLevel: number;
  facilityName: string;
  facilityType: 'underground_parking' | 'tunnel' | 'indoor_mall' | 'terminal';
  txPowerAt1m: number;
}

export interface WifiAnchor {
  bssid: string;
  location: Coordinate; // [longitude, latitude]
  altitude?: number;
  floorLevel: number;
  facilityName: string;
}
