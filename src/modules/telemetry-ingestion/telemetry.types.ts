/**
 * Telemetry Ingestion & Dynamic Hardware/Sensor Metric Types
 * Supports high-throughput, compressed, batch-oriented ingestion from React Native & mobile clients.
 */

export type TelemetryEventType =
  | 'heartbeat'
  | 'session_start'
  | 'session_end'
  | 'sensor_batch'
  | 'telematics'
  | 'navigation_ping'
  | 'app_state_change';

export type TelemetryClientPlatform = 'ios' | 'android' | 'web' | 'automotive' | 'iot';

export type AppLifecycleState = 'active' | 'background' | 'inactive' | 'terminated';

/**
 * Rich ~120 Dynamic Hardware, Radio, IMU, Battery, and Environmental Metrics
 */
export interface DynamicHardwareSensorMetrics {
  // 1. Battery Metrics (1-10)
  batteryLevel?: number; // 0.0 to 1.0 or 0 to 100
  batteryState?: 'unplugged' | 'charging' | 'full' | 'unknown';
  isCharging?: boolean;
  batteryTemperature?: number; // Celsius
  batteryVoltage?: number; // mV
  batteryHealth?: 'good' | 'overheat' | 'dead' | 'over_voltage' | 'failure' | 'unknown' | string;
  batteryCapacityMah?: number;
  batteryTechnology?: string;
  chargeRateMilliAmps?: number;
  isPowerSaveMode?: boolean;

  // 2. Kinematics, IMU & Accelerometer (11-25)
  accelerometerX?: number;
  accelerometerY?: number;
  accelerometerZ?: number;
  gyroscopeX?: number;
  gyroscopeY?: number;
  gyroscopeZ?: number;
  magnetometerX?: number;
  magnetometerY?: number;
  magnetometerZ?: number;
  userAccelerationX?: number;
  userAccelerationY?: number;
  userAccelerationZ?: number;
  pitch?: number;
  roll?: number;
  yaw?: number;

  // 3. Location, GNSS & Accuracy (26-40)
  latitude?: number;
  longitude?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  speed?: number; // m/s or km/h
  speedAccuracy?: number;
  heading?: number; // degrees
  headingAccuracy?: number;
  horizontalAccuracy?: number;
  verticalAccuracy?: number;
  satelliteCount?: number;
  hdop?: number;
  vdop?: number;
  pdop?: number;
  isMockLocation?: boolean;
  mockProvider?: string;

  // 4. Screen & Display (41-50)
  screenBrightness?: number;
  screenWidth?: number;
  screenHeight?: number;
  screenDensity?: number;
  refreshRate?: number;
  orientation?: 'portrait' | 'landscape' | string;
  isScreenOn?: boolean;
  displayState?: string;
  hdrSupported?: boolean;
  colorDepth?: number;

  // 5. System, Memory & CPU Performance (51-65)
  cpuModel?: string;
  cpuCores?: number;
  cpuUsagePercent?: number;
  cpuFrequencyMhz?: number;
  totalMemoryMb?: number;
  freeMemoryMb?: number;
  usedMemoryMb?: number;
  isLowMemory?: boolean;
  diskTotalGb?: number;
  diskFreeGb?: number;
  diskUsedGb?: number;
  thermalState?: 'nominal' | 'fair' | 'serious' | 'critical';
  isThermalThrottling?: boolean;
  systemUptimeSeconds?: number;
  appMemoryUsageMb?: number;

  // 6. Network, Radio & Signal (66-85)
  networkType?: 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'none' | 'unknown';
  cellularGeneration?: '2g' | '3g' | '4g' | '5g';
  carrierName?: string;
  mcc?: string;
  mnc?: string;
  signalStrengthDbm?: number;
  signalLevel?: number; // 0-4
  isRoaming?: boolean;
  isNetworkMetered?: boolean;
  wifiSsid?: string;
  wifiBssid?: string;
  wifiRssi?: number;
  wifiFrequencyMhz?: number;
  wifiLinkSpeedMbps?: number;
  bluetoothEnabled?: boolean;
  bluetoothConnectedDevicesCount?: number;
  nfcEnabled?: boolean;
  airplaneMode?: boolean;
  vpnActive?: boolean;
  ipAddressV4?: string;
  ipAddressV6?: string;

  // 7. Environmental & Ambient Sensors (86-100)
  ambientLightLux?: number;
  proximityDistanceCm?: number;
  proximityNear?: boolean;
  barometricPressureHpa?: number;
  relativeHumidityPercent?: number;
  ambientTemperatureC?: number;
  pedometerStepCount?: number;
  magneticFieldStrengthUt?: number;
  microphoneAudioLevelDb?: number;
  isCameraInUse?: boolean;

  // 8. Device Integrity & Emulator Telemetry (101-120)
  deviceModel?: string;
  deviceManufacturer?: string;
  brand?: string;
  board?: string;
  hardware?: string;
  bootloader?: string;
  osVersion?: string;
  osBuildNumber?: string;
  securityPatchDate?: string;
  isRootedOrJailbroken?: boolean;
  isEmulator?: boolean;
  isDevModeEnabled?: boolean;
  adbEnabled?: boolean;
  biometricType?: string;
  appForegroundTimeSeconds?: number;
  touchLatencyMs?: number;

  // Flexible dynamic extension for any additional custom sensor or proprietary telematics key
  [key: string]: any;
}

/**
 * Single Telemetry Event Payload
 */
export interface TelemetryEvent {
  eventId: string; // Client-generated UUID (for strict idempotency & deduplication)
  deviceId: string;
  userId?: string;
  sessionId: string;
  eventType: TelemetryEventType;
  platform: TelemetryClientPlatform;
  appVersion: string;
  timestamp: number; // Epoch milliseconds
  clientTimezone: string; // IANA e.g. "Asia/Kolkata", "America/New_York"
  sessionStartTime?: number; // Epoch milliseconds
  sessionEndTime?: number; // Epoch milliseconds
  appState?: AppLifecycleState;
  ipAddress?: string; // Derived by backend gateway / proxy
  metrics: DynamicHardwareSensorMetrics;
}

/**
 * Mobile Batch Envelope Payload
 * Flushed periodically (every 30-60s) or on app background transition
 */
export interface TelemetryBatchEnvelope {
  batchId: string; // Client-generated UUID for the batch
  deviceId?: string;
  clientTimezone?: string;
  platform?: TelemetryClientPlatform;
  appVersion?: string;
  timestamp?: number;
  events: TelemetryEvent[];
}

/**
 * Fraud Evaluation Result
 */
export interface FraudEvaluationResult {
  isFraudDetected: boolean;
  fraudScore: number; // 0 (legitimate) to 100 (confirmed fraud/emulator)
  fraudReasons: string[];
  anomalies: {
    timezoneMismatch?: {
      clientTimezone: string;
      ipCountry?: string;
      detectedTimezone?: string;
      offsetDifferenceHours?: number;
    };
    batteryAnomaly?: {
      previousBatteryLevel: number;
      currentBatteryLevel: number;
      timeDeltaSeconds: number;
      rateOfChangePerMinute: number;
      isEmulatorSignature: boolean;
    };
    emulatorHardware?: {
      fingerprintMatched?: string;
      isEmulatorFlag: boolean;
      isMockLocation: boolean;
    };
    kinematicAnomaly?: {
      impliedSpeedKmh?: number;
      maxAllowedSpeedKmh: number;
    };
  };
}

/**
 * Worker Enqueue Result
 */
export interface TelemetryIngestResponse {
  status: 'queued' | 'already_processed';
  batchId?: string;
  eventId?: string;
  queuedCount: number;
  duplicateCount: number;
  timestamp: string;
}

/**
 * Worker Analytics Summary
 */
export interface TelemetryAnalyticsSummary {
  sessionLengthSeconds: number;
  openStopRate: number; // Ratio of open sessions to total session toggles
  fraudEvaluation: FraudEvaluationResult;
}
