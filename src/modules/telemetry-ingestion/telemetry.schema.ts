import { z } from 'zod';

/**
 * 1. HTTP Request Header Validation Schema
 * Parses and verifies security, routing, and idempotency headers.
 */
export const telemetryHeadersSchema = z.object({
  'x-idempotency-key': z.string().min(8).max(128).optional(),
  'x-event-id': z.string().min(8).max(128).optional(),
  'x-client-platform': z.enum(['ios', 'android', 'web', 'automotive', 'iot']).optional(),
  'x-app-version': z.string().max(32).optional(),
  'x-client-timestamp': z.union([z.string(), z.number()]).optional(),
  'content-encoding': z.string().optional(),
}).passthrough();

/**
 * 2. Dynamic Hardware & Sensor Metrics Schema (~120 metrics supported)
 * Strictly typed core fields + dynamic catchall for extended hardware/sensor telemetry.
 */
export const hardwareSensorMetricsSchema = z.object({
  // Battery Metrics (1-10)
  batteryLevel: z.number().min(0).max(100).optional(),
  batteryState: z.enum(['unplugged', 'charging', 'full', 'unknown']).optional(),
  isCharging: z.boolean().optional(),
  batteryTemperature: z.number().optional(),
  batteryVoltage: z.number().optional(),
  batteryHealth: z.string().optional(),
  batteryCapacityMah: z.number().optional(),
  batteryTechnology: z.string().optional(),
  chargeRateMilliAmps: z.number().optional(),
  isPowerSaveMode: z.boolean().optional(),

  // Kinematics & IMU (11-25)
  accelerometerX: z.number().optional(),
  accelerometerY: z.number().optional(),
  accelerometerZ: z.number().optional(),
  gyroscopeX: z.number().optional(),
  gyroscopeY: z.number().optional(),
  gyroscopeZ: z.number().optional(),
  magnetometerX: z.number().optional(),
  magnetometerY: z.number().optional(),
  magnetometerZ: z.number().optional(),
  userAccelerationX: z.number().optional(),
  userAccelerationY: z.number().optional(),
  userAccelerationZ: z.number().optional(),
  pitch: z.number().optional(),
  roll: z.number().optional(),
  yaw: z.number().optional(),

  // Location & GNSS (26-40)
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  altitude: z.number().optional(),
  altitudeAccuracy: z.number().optional(),
  speed: z.number().min(0).optional(),
  speedAccuracy: z.number().optional(),
  heading: z.number().min(0).max(360).optional(),
  headingAccuracy: z.number().optional(),
  horizontalAccuracy: z.number().optional(),
  verticalAccuracy: z.number().optional(),
  satelliteCount: z.number().int().min(0).optional(),
  hdop: z.number().optional(),
  vdop: z.number().optional(),
  pdop: z.number().optional(),
  isMockLocation: z.boolean().optional(),
  mockProvider: z.string().optional(),

  // Display & Screen (41-50)
  screenBrightness: z.number().min(0).max(1).optional(),
  screenWidth: z.number().positive().optional(),
  screenHeight: z.number().positive().optional(),
  screenDensity: z.number().positive().optional(),
  refreshRate: z.number().positive().optional(),
  orientation: z.string().optional(),
  isScreenOn: z.boolean().optional(),
  displayState: z.string().optional(),
  hdrSupported: z.boolean().optional(),
  colorDepth: z.number().optional(),

  // CPU & Performance (51-65)
  cpuModel: z.string().optional(),
  cpuCores: z.number().int().positive().optional(),
  cpuUsagePercent: z.number().min(0).max(100).optional(),
  cpuFrequencyMhz: z.number().positive().optional(),
  totalMemoryMb: z.number().positive().optional(),
  freeMemoryMb: z.number().min(0).optional(),
  usedMemoryMb: z.number().min(0).optional(),
  isLowMemory: z.boolean().optional(),
  diskTotalGb: z.number().positive().optional(),
  diskFreeGb: z.number().min(0).optional(),
  diskUsedGb: z.number().min(0).optional(),
  thermalState: z.enum(['nominal', 'fair', 'serious', 'critical']).optional(),
  isThermalThrottling: z.boolean().optional(),
  systemUptimeSeconds: z.number().min(0).optional(),
  appMemoryUsageMb: z.number().min(0).optional(),

  // Radio & Connectivity (66-85)
  networkType: z.enum(['wifi', 'cellular', 'ethernet', 'bluetooth', 'none', 'unknown']).optional(),
  cellularGeneration: z.enum(['2g', '3g', '4g', '5g']).optional(),
  carrierName: z.string().optional(),
  mcc: z.string().optional(),
  mnc: z.string().optional(),
  signalStrengthDbm: z.number().optional(),
  signalLevel: z.number().int().min(0).max(5).optional(),
  isRoaming: z.boolean().optional(),
  isNetworkMetered: z.boolean().optional(),
  wifiSsid: z.string().optional(),
  wifiBssid: z.string().optional(),
  wifiRssi: z.number().optional(),
  wifiFrequencyMhz: z.number().optional(),
  wifiLinkSpeedMbps: z.number().optional(),
  bluetoothEnabled: z.boolean().optional(),
  bluetoothConnectedDevicesCount: z.number().int().min(0).optional(),
  nfcEnabled: z.boolean().optional(),
  airplaneMode: z.boolean().optional(),
  vpnActive: z.boolean().optional(),
  ipAddressV4: z.string().optional(),
  ipAddressV6: z.string().optional(),

  // Environmental Sensors (86-100)
  ambientLightLux: z.number().min(0).optional(),
  proximityDistanceCm: z.number().min(0).optional(),
  proximityNear: z.boolean().optional(),
  barometricPressureHpa: z.number().optional(),
  relativeHumidityPercent: z.number().min(0).max(100).optional(),
  ambientTemperatureC: z.number().optional(),
  pedometerStepCount: z.number().int().min(0).optional(),
  magneticFieldStrengthUt: z.number().optional(),
  microphoneAudioLevelDb: z.number().optional(),
  isCameraInUse: z.boolean().optional(),

  // Device Integrity & Emulator Telemetry (101-120)
  deviceModel: z.string().optional(),
  deviceManufacturer: z.string().optional(),
  brand: z.string().optional(),
  board: z.string().optional(),
  hardware: z.string().optional(),
  bootloader: z.string().optional(),
  osVersion: z.string().optional(),
  osBuildNumber: z.string().optional(),
  securityPatchDate: z.string().optional(),
  isRootedOrJailbroken: z.boolean().optional(),
  isEmulator: z.boolean().optional(),
  isDevModeEnabled: z.boolean().optional(),
  adbEnabled: z.boolean().optional(),
  biometricType: z.string().optional(),
  appForegroundTimeSeconds: z.number().min(0).optional(),
  touchLatencyMs: z.number().min(0).optional(),
}).catchall(z.union([z.number(), z.string(), z.boolean(), z.null(), z.record(z.string(), z.any()), z.array(z.any())]));

/**
 * 3. Individual Telemetry Signal Schema
 */
export const telemetryEventSchema = z.object({
  eventId: z.string().min(8, 'eventId must be at least 8 characters (UUID recommended)').max(128),
  deviceId: z.string().min(1, 'deviceId is required').max(128),
  userId: z.string().max(128).optional(),
  sessionId: z.string().min(1, 'sessionId is required').max(128),
  eventType: z.enum([
    'heartbeat',
    'session_start',
    'session_end',
    'sensor_batch',
    'telematics',
    'navigation_ping',
    'app_state_change',
  ]),
  platform: z.enum(['ios', 'android', 'web', 'automotive', 'iot']),
  appVersion: z.string().min(1, 'appVersion is required').max(32),
  timestamp: z.number().int().positive('timestamp must be a valid epoch millisecond integer'),
  clientTimezone: z.string().min(1, 'clientTimezone is required (e.g. Asia/Kolkata, America/New_York)'),
  sessionStartTime: z.number().int().positive().optional(),
  sessionEndTime: z.number().int().positive().optional(),
  appState: z.enum(['active', 'background', 'inactive', 'terminated']).optional(),
  metrics: hardwareSensorMetricsSchema.default({}),
});

/**
 * 4. Mobile Client Batch Envelope Schema (Recommended client buffering pattern)
 */
export const telemetryBatchEnvelopeSchema = z.object({
  batchId: z.string().min(8).max(128),
  deviceId: z.string().max(128).optional(),
  clientTimezone: z.string().max(64).optional(),
  platform: z.enum(['ios', 'android', 'web', 'automotive', 'iot']).optional(),
  appVersion: z.string().max(32).optional(),
  timestamp: z.number().optional(),
  events: z.array(telemetryEventSchema).min(1, 'Batch must contain at least 1 event').max(500, 'Batch exceeds 500 events limit'),
});

/**
 * 5. Flexible Ingestion Request Schema
 * Seamlessly accepts either a single event, an array of events, or a batch envelope object.
 */
export const telemetryIngestPayloadSchema = z.union([
  telemetryBatchEnvelopeSchema,
  z.array(telemetryEventSchema).min(1).max(500),
  telemetryEventSchema,
]);

/**
 * 6. Query Filter Schema for Telemetry Analytics
 */
export const telemetryQuerySchema = z.object({
  deviceId: z.string().optional(),
  sessionId: z.string().optional(),
  eventType: z.enum([
    'heartbeat',
    'session_start',
    'session_end',
    'sensor_batch',
    'telematics',
    'navigation_ping',
    'app_state_change',
  ]).optional(),
  isFraudDetected: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  limit: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(500)).optional().default(50 as any),
  page: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1)).optional().default(1 as any),
});
