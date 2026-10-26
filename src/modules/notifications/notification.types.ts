export type DevicePlatform = 'android' | 'ios' | 'web';
export type PushTokenType = 'fcm' | 'apns';

export interface ClientNotificationPermissions {
  /**
   * POST_NOTIFICATIONS on Android 13+ / Remote Notifications on iOS
   */
  postNotifications: boolean;
  authorizationStatus?: 'authorized' | 'provisional' | 'denied' | 'not_determined';
}

export interface RegisterDeviceTokenDto {
  userId: string;
  token: string;
  platform: DevicePlatform;
  tokenType?: PushTokenType;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  permissions?: ClientNotificationPermissions;
}

export type GeofenceMilestoneType =
  | 'GEOFENCE_PROXIMITY_500M'
  | 'GEOFENCE_ARRIVAL_100M'
  | 'GEOFENCE_ENTER'
  | 'GEOFENCE_DWELL'
  | 'GEOFENCE_EXIT';

export type GeofenceGeometryType = 'CIRCULAR' | 'POLYGON';

export interface CircularGeofenceDefinition {
  geofenceId: string;
  name: string;
  type: 'CIRCULAR';
  center: [number, number]; // [lon, lat]
  radiusMeters: number;
  dwellThresholdSeconds?: number;
  metadata?: Record<string, any>;
}

export interface PolygonGeofenceDefinition {
  geofenceId: string;
  name: string;
  type: 'POLYGON';
  coordinates: [number, number][]; // Array of [lon, lat] vertices forming closed polygon
  dwellThresholdSeconds?: number;
  metadata?: Record<string, any>;
}

export type CustomGeofenceDefinition = CircularGeofenceDefinition | PolygonGeofenceDefinition;

export interface GeofenceEvaluationEvent {
  geofenceId: string;
  name: string;
  eventType: 'ENTER' | 'DWELL' | 'EXIT' | 'INSIDE' | 'OUTSIDE';
  distanceToCenterMeters?: number;
  dwellTimeSeconds?: number;
  triggeredPush: boolean;
  timestamp: number;
}


export interface PushNotificationPayload {
  recipientUserId: string;
  title: string;
  body: string;
  subtitle?: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  priority?: 'high' | 'normal';
  collapseKey?: string;
  eventType?: GeofenceMilestoneType | 'TRIP_UPDATE' | 'CUSTOM';
}

export interface TargetedPushResult {
  recipientUserId: string;
  title: string;
  body: string;
  tokensTargetedCount: number;
  successfulTokensCount: number;
  failedTokensCount: number;
  eventType: string;
  dispatchedAt: number;
  channel: 'apns' | 'fcm' | 'websocket_hybrid';
}

export interface GeofenceTriggerEvaluationInput {
  tripId: string;
  driverId: string;
  customerUserId: string;
  driverCoordinates: [number, number];
  destinationCoordinates: [number, number];
  distanceToTargetMeters?: number;
  etaSeconds?: number;
}

export interface GeofenceTriggerEvaluationResult {
  tripId: string;
  distanceToTargetMeters: number;
  milestoneTriggered: GeofenceMilestoneType | 'NONE';
  pushDispatched: boolean;
  targetedPushResult?: TargetedPushResult;
  etaMinutes?: number;
  timestamp: number;
}
