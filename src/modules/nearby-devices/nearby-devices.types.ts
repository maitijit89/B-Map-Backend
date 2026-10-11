import { Coordinate } from '../../core/types/geo.types';

// =============================================================================
// CLIENT BLUETOOTH & NEARBY DEVICES PERMISSIONS
// =============================================================================

export type ClientPlatform = 'android' | 'ios' | 'web';

/**
 * Client permission state reported by mobile / web apps:
 * - Android 12+ (API 31+): BLUETOOTH_SCAN, BLUETOOTH_CONNECT, BLUETOOTH_ADVERTISE
 * - Android <12 legacy: ACCESS_FINE_LOCATION (required to perform BLE scans)
 * - iOS: Bluetooth Sharing (NSBluetoothAlwaysUsageDescription, CoreBluetooth CBCentralManager)
 */
export interface BluetoothClientPermissions {
  platform: ClientPlatform;
  /**
   * Android 12+ (API 31+) permission: Needed to discover BLE advertisements & beacons
   */
  bluetoothScan?: boolean;

  /**
   * Android 12+ (API 31+) permission: Needed to communicate with / query Bluetooth peripherals
   */
  bluetoothConnect?: boolean;

  /**
   * Android 12+ (API 31+) permission: Needed to broadcast as BLE peripheral
   */
  bluetoothAdvertise?: boolean;

  /**
   * Android legacy fallback (< Android 12): Fine location needed for BLE beacon discovery
   */
  accessFineLocation?: boolean;

  /**
   * iOS CoreBluetooth permission: Bluetooth Sharing / Always Usage
   */
  bluetoothSharing?: boolean;

  /**
   * iOS CBManagerAuthorization status
   */
  authorizationStatus?: 'authorized' | 'denied' | 'restricted' | 'notDetermined';
}

export interface PermissionValidationResult {
  isValid: boolean;
  platform: ClientPlatform;
  missingPermissions?: string[];
  errorCode?: 'BLUETOOTH_PERMISSION_DENIED' | 'LOCATION_PERMISSION_REQUIRED_FOR_BLE';
  message: string;
}

// =============================================================================
// BLE BEACON PROTOCOLS & SCAN TELEMETRY
// =============================================================================

export type BeaconProtocolType = 'ibeacon' | 'eddystone' | 'altbeacon' | 'generic_ble';

/**
 * Raw scanned beacon reported by mobile client during scan cycle
 */
export interface ScannedBeaconPayload {
  /**
   * Unique identifier or composite key (e.g., "bcn_dlf_b2_p14", "E2C56DB5-...:100:1", or MAC address)
   */
  beaconId?: string;

  /**
   * BLE Beacon protocol
   */
  protocol?: BeaconProtocolType;

  // --- Apple iBeacon format ---
  /**
   * 128-bit Proximity UUID (e.g. "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0")
   */
  uuid?: string;

  /**
   * 16-bit Major number (typically represents facility or floor)
   */
  major?: number;

  /**
   * 16-bit Minor number (identifies specific pillar, room, or zone)
   */
  minor?: number;

  // --- Google Eddystone format ---
  /**
   * 10-byte Namespace ID
   */
  namespaceId?: string;

  /**
   * 6-byte Instance ID
   */
  instanceId?: string;

  // --- Hardware / Signal Telemetry ---
  /**
   * Hardware MAC Address (e.g. "AA:BB:CC:11:22:33")
   */
  macAddress?: string;

  /**
   * Received Signal Strength Indication in dBm (e.g., -68 dBm, typically -30 to -95)
   */
  rssi: number;

  /**
   * Measured / calibrated transmission power at 1 meter (default: -59 dBm)
   */
  txPower?: number;

  /**
   * Client scan timestamp in ms
   */
  timestamp?: number;
}

// =============================================================================
// INDOOR MAPPING DATABASE RECORDS
// =============================================================================

export type IndoorFacilityType =
  | 'underground_parking'
  | 'shopping_center'
  | 'airport_terminal'
  | 'train_transit_hub'
  | 'commercial_office'
  | 'metro_station';

/**
 * Indoor beacon metadata stored in the indoor mapping database
 */
export interface IndoorBeaconRecord {
  /**
   * Unique beacon identifier in database
   */
  beaconId: string;

  /**
   * Associated facility ID (e.g., "fac_cybercity_gurugram", "fac_igi_t3_delhi")
   */
  facilityId: string;

  /**
   * Human-readable facility name
   */
  facilityName: string;

  /**
   * Categorization of indoor space
   */
  facilityType: IndoorFacilityType;

  /**
   * Floor level: e.g. -2 for Basement Parking Level 2, -1 for B1, 0 for Ground, 1 for L1
   */
  floorLevel: number;

  /**
   * Friendly floor name (e.g., "Basement Parking B2 (Yellow Pillar Zone)")
   */
  floorName?: string;

  /**
   * Indoor specific zone (e.g., "Pillar P-24, Bay B", "Gate 14 Boarding Lounge")
   */
  zone: string;

  // --- EXACT INDOOR CARTESIAN COORDINATES ---
  /**
   * Exact indoor X coordinate in meters relative to floor origin (0, 0)
   */
  indoorX: number;

  /**
   * Exact indoor Y coordinate in meters relative to floor origin (0, 0)
   */
  indoorY: number;

  /**
   * Vertical height in meters above floor level (e.g., mounted at 2.5m ceiling/pillar)
   */
  indoorZ?: number;

  // --- EXTERNAL GEO-REFERENCE ---
  /**
   * Georeferenced WGS-84 coordinates [longitude, latitude]
   */
  geographicLocation: Coordinate;

  /**
   * Altitude above sea level in meters
   */
  altitudeMeters?: number;

  // --- RF CALIBRATION PARAMETERS ---
  /**
   * Measured RSSI at 1 meter distance (default -59 dBm)
   */
  txPowerAt1m: number;

  /**
   * Environmental path-loss exponent (typically 2.0–3.5 for indoor concrete/corridors)
   */
  pathLossExponent: number;

  /**
   * Effective BLE coverage radius in meters
   */
  coverageRadiusMeters: number;

  // --- PROTOCOL ATTRIBUTES ---
  protocol: BeaconProtocolType;
  uuid?: string;
  major?: number;
  minor?: number;
  namespaceId?: string;
  instanceId?: string;
  macAddress?: string;

  /**
   * Hardware health / deployment status
   */
  status: 'active' | 'maintenance' | 'inactive';
}

// =============================================================================
// BEACON TRANSLATION REQUEST & RESPONSE
// =============================================================================

export interface IndoorBeaconTranslationRequest {
  /**
   * Scanned BLE beacons detected by device
   */
  beacons: ScannedBeaconPayload[];

  /**
   * Client device permissions for verification
   */
  permissions?: BluetoothClientPermissions;

  /**
   * Optional facility hint if known by navigation session
   */
  facilityIdHint?: string;

  /**
   * User / device ID transmitting scan
   */
  userId?: string;

  /**
   * Optional active trip session ID
   */
  tripId?: string;

  /**
   * Client timestamp
   */
  timestamp?: number;
}

export interface IndoorCoordinates {
  /**
   * Exact indoor X coordinate in meters
   */
  x: number;

  /**
   * Exact indoor Y coordinate in meters
   */
  y: number;

  /**
   * Floor elevation in meters
   */
  z?: number;
}

export interface MatchedBeaconDetail {
  beaconId: string;
  zone: string;
  floorLevel: number;
  rssi: number;
  estimatedDistanceMeters: number;
  indoorX: number;
  indoorY: number;
  weight: number;
}

export interface IndoorBeaconTranslationResult {
  /**
   * Whether translation succeeded into exact indoor coordinates
   */
  resolved: boolean;

  /**
   * Identified facility ID
   */
  facilityId: string;

  /**
   * Facility human name
   */
  facilityName: string;

  /**
   * Facility category (underground parking, shopping mall, etc.)
   */
  facilityType: IndoorFacilityType;

  /**
   * Isolated floor level (-2, -1, 0, 1, etc.)
   */
  floorLevel: number;

  /**
   * Floor name
   */
  floorName?: string;

  /**
   * Identified zone (e.g. "Pillar P-24, Bay B (Near Lift Lobby 2)")
   */
  zone: string;

  /**
   * Exact indoor X/Y coordinates in meters
   */
  indoorCoordinates: IndoorCoordinates;

  /**
   * Georeferenced coordinates [longitude, latitude] for global maps
   */
  geographicCoordinates: Coordinate;

  /**
   * Estimated horizontal positioning accuracy in meters (e.g., 1.5m to 4.0m)
   */
  accuracyMeters: number;

  /**
   * Calculation confidence (0.0 to 1.0)
   */
  confidence: number;

  /**
   * Number of valid beacons used in position calculation
   */
  matchedBeaconsCount: number;

  /**
   * Dominant (strongest) beacon ID
   */
  dominantBeaconId: string;

  /**
   * Method used for indoor localization
   */
  localizationMethod: 'nearest_proximity' | 'weighted_trilateration' | 'multi_beacon_centroid';

  /**
   * Detailed info on each matched beacon
   */
  matchedBeacons?: MatchedBeaconDetail[];

  /**
   * Weak signal assistance context
   */
  weakSignalContext: {
    isWeakGpsArea: boolean;
    gpsReplacedByIndoorMap: boolean;
    reason: string;
  };

  /**
   * Calculation timestamp
   */
  timestamp: number;
}
