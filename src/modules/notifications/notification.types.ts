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
  | 'GEOFENCE_EXIT';

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
