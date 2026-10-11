import { Coordinate } from '../../core/types/geo.types';

export type AppLifecycleMode = 'foreground' | 'background' | 'terminated';

export type IngestionFrequencyMode = 'high_frequency' | 'low_frequency' | 'geofencing_only';

export interface ClientLocationPermissions {
  /**
   * ACCESS_FINE_LOCATION on Android, 'WhenInUse' on iOS
   */
  fineLocation: boolean;

  /**
   * ACCESS_BACKGROUND_LOCATION on Android, 'AlwaysAllow' on iOS
   */
  backgroundLocation: boolean;

  /**
   * ACCESS_COARSE_LOCATION (optional cellular/wifi coarse fix)
   */
  coarseLocation?: boolean;

  /**
   * Evaluated permission tier
   */
  permissionLevel?: 'granted_always' | 'granted_foreground_only' | 'denied';
}

export interface GeofenceEventPayload {
  milestoneId: string;
  type:
    | 'APPROACHING_TURN'
    | 'APPROACHING_DESTINATION'
    | 'WAYPOINT_REACHED'
    | 'WAYPOINT_PASSED'
    | 'GEOFENCE_ENTER'
    | 'GEOFENCE_EXIT';
  distanceToTargetMeters?: number;
  metadata?: Record<string, any>;
}

export interface LocationTelemetryPayload {
  /**
   * Unique active trip / navigation session ID (REQUIRED for validation against active DB trips)
   */
  tripId: string;

  /**
   * Client user ID
   */
  userId: string;

  /**
   * [longitude, latitude]
   */
  coordinates: Coordinate;

  /**
   * Compass heading in degrees (0 - 360)
   */
  heading?: number;

  /**
   * Instantaneous speed in meters/second or km/h
   */
  speed?: number;

  /**
   * GPS horizontal accuracy in meters
   */
  accuracy?: number;

  /**
   * Altitude in meters
   */
  altitude?: number;

  /**
   * Client fix timestamp in milliseconds
   */
  timestamp?: number;

  /**
   * Client lifecycle state: 'foreground' (1–2s updates) or 'background' (30–60s updates)
   */
  appLifecycleMode: AppLifecycleMode;

  /**
   * Current permissions on device
   */
  permissions?: ClientLocationPermissions;

  /**
   * Device battery level (0.0 to 1.0, e.g. 0.82 = 82%)
   */
  batteryLevel?: number;

  /**
   * Whether this update was triggered by an OS geofencing / milestone wake-up
   */
  isGeofenceTrigger?: boolean;

  /**
   * Detailed geofence event context if triggered by geofence
   */
  geofenceEvent?: GeofenceEventPayload;

  /**
   * Detected physical motion activity (STILL, WALKING, DRIVING, RUNNING, etc.)
   */
  activity?: string;
  activityConfidence?: number;

  /**
   * Scanned BLE beacons detected in weak-signal / underground / indoor environments
   */
  scannedBeacons?: any[];

  /**
   * Cryptographically signed, short-lived JSON Web Token (JWT) linked explicitly to an open destination route.
   * Required under strict cryptographic scoping.
   */
  tripToken?: string;

  /**
   * Additional telemetry metadata
   */
  metadata?: Record<string, any>;
}

export type PermissionStatus = 'granted' | 'revoked' | 'denied';

export interface UserPermissionState {
  userId: string;
  backgroundLocation: PermissionStatus;
  fineLocation: PermissionStatus;
  motionFitness?: PermissionStatus;
  bluetoothScan?: PermissionStatus;
  postNotifications?: PermissionStatus;
  lastUpdatedAt: number;
  activeTripSessions?: string[];
  pollingHalted: boolean;
  socketExpectingTelemetry: boolean;
}

export interface TripTelemetryTokenPayload {
  sub: string; // userId
  tripId: string;
  routeId: string; // explicitly linked to an open destination route
  destinationCoordinates: Coordinate;
  scope: 'telemetry:ingest';
  type: 'trip_scoped_token';
  iat?: number;
  exp?: number;
}

export interface IngestionRateDirective {
  mode: IngestionFrequencyMode;
  recommendedIntervalMs: number;
  recommendedIntervalSeconds: number;
  batterySavingActive: boolean;
  throttleApplied: boolean;
  minDistanceFilterMeters: number;
}

export interface LocationIngestionResult {
  accepted: boolean;
  tripId: string;
  userId: string;
  appLifecycleMode: AppLifecycleMode;
  ingestionRate: IngestionRateDirective;
  sessionState?: {
    status: 'active' | 'completed' | 'cancelled' | 'paused';
    remainingDistanceMeters?: number;
    remainingDurationSeconds?: number;
  };
  geofencingContext?: {
    isWithinMilestoneGeofence: boolean;
    distanceToDestinationMeters?: number;
    nextRecommendedWakeupSeconds: number;
  };
  motionEvaluation?: any;
  geofencePushTrigger?: any;
  indoorBeaconPosition?: any;
  rejectionReason?: string;
  errorCode?: string;
  timestamp: number;
}

export interface ClientLifecycleChangePayload {
  tripId: string;
  userId: string;
  appLifecycleMode: AppLifecycleMode;
  permissions?: ClientLocationPermissions;
  batteryLevel?: number;
  timestamp?: number;
}
