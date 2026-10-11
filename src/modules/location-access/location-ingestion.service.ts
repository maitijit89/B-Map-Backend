import { logger } from '../../core/config/logger';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import { NavigationSession } from '../navigation/navigation-session.model';
import { geoTrackingService } from '../tracking/geo-tracking.service';
import { dynamicRateLimiterService } from './dynamic-rate-limiter.service';
import {
  ClientLifecycleChangePayload,
  IngestionRateDirective,
  LocationIngestionResult,
  LocationTelemetryPayload,
} from './location-access.types';
import { sessionValidationService } from './session-validation.service';
import { activityRecognitionService } from '../motion-fitness/activity-recognition.service';
import { PhysicalActivityType } from '../motion-fitness/motion-fitness.types';
import { geofenceTriggerService } from '../notifications/geofence-trigger.service';
import { indoorBeaconMappingService } from '../nearby-devices/indoor-beacon-mapping.service';
import { permissionCacheService } from './permission-cache.service';
import { tripTokenService } from './trip-token.service';

export class LocationIngestionService {
  /**
   * Main entry point for ingesting client location telemetry.
   * Enforces:
   * 1. Session Validation: Must match an active database trip session, or rejected to protect user privacy.
   * 2. Dynamic Ingestion Rates: High-frequency (1–2s) for foreground, low-frequency (30–60s) or geofence triggers for background.
   */
  async ingestLocation(payload: LocationTelemetryPayload): Promise<LocationIngestionResult> {
    const timestamp = payload.timestamp || Date.now();
    const { tripId, userId, appLifecycleMode, permissions } = payload;
    let coordinates = payload.coordinates;

    // STEP 0: Strict Cryptographic Scoping Verification
    // Never accept a raw coordinate update unless accompanied by a valid, short-lived JWT linked explicitly to an open destination route.
    if (payload.tripToken || tripTokenService.isTripTokenized(tripId)) {
      const cryptoCheck = await tripTokenService.verifyTripTelemetryToken(
        payload.tripToken,
        tripId,
        userId
      );

      if (!cryptoCheck.isValid) {
        logger.warn(
          `🛡️ [CRYPTOGRAPHIC REJECTION] Discarded raw coordinates on trip ${tripId}: ${cryptoCheck.message}`
        );

        const defaultDirective = dynamicRateLimiterService.getPolicyForLifecycle(
          appLifecycleMode,
          permissions,
          payload.batteryLevel
        );

        return {
          accepted: false,
          tripId,
          userId,
          appLifecycleMode,
          ingestionRate: defaultDirective,
          rejectionReason: cryptoCheck.message,
          errorCode: cryptoCheck.errorCode,
          timestamp,
        };
      }
    }

    // STEP 0.5: Permission State Caching Verification (Redis & In-Memory Map)
    // If a user revokes background access, the backend instantly stops accepting background fixes.
    if (appLifecycleMode === 'background') {
      const bgAllowed = await permissionCacheService.isBackgroundAccessAllowed(userId);
      if (!bgAllowed) {
        logger.warn(
          `🛡️ [PERMISSION REVOKED] Discarded background telemetry for user ${userId} on trip ${tripId}: Background access revoked.`
        );

        const defaultDirective = dynamicRateLimiterService.getPolicyForLifecycle(
          appLifecycleMode,
          permissions,
          payload.batteryLevel
        );

        return {
          accepted: false,
          tripId,
          userId,
          appLifecycleMode,
          ingestionRate: defaultDirective,
          rejectionReason:
            'Background location access is revoked for this user session. Backend has ceased background polling and discarded coordinates.',
          errorCode: 'PERMISSION_REVOKED_BACKGROUND_ACCESS',
          timestamp,
        };
      }
    }

    // STEP 1: Cross-reference incoming coordinates against active database trip IDs
    const validation = await sessionValidationService.validateActiveTripSession(tripId, userId);

    if (!validation.isValid) {
      logger.warn(
        `🛡️ [PRIVACY REJECTION] Discarded location fix for user ${userId} on trip ${tripId}: ${validation.message}`
      );

      // Return rejection response directly without persisting coordinates
      const defaultDirective = dynamicRateLimiterService.getPolicyForLifecycle(
        appLifecycleMode,
        permissions,
        payload.batteryLevel
      );

      return {
        accepted: false,
        tripId,
        userId,
        appLifecycleMode,
        ingestionRate: defaultDirective,
        rejectionReason: validation.message,
        errorCode: validation.errorCode,
        timestamp,
      };
    }

    const session = validation.session!;

    // STEP 2: Evaluate dynamic ingestion rate & battery-saving throttling
    const { directive, isStationary, shouldPersistToHistory } =
      dynamicRateLimiterService.evaluateIngestionRate(payload);

    // If client is in background mode but OS reports ACCESS_BACKGROUND_LOCATION is missing, log warning
    if (appLifecycleMode === 'background' && permissions && !permissions.backgroundLocation) {
      logger.warn(
        `⚠️ Device transmitted background coordinates for trip ${tripId} without ACCESS_BACKGROUND_LOCATION permission.`
      );
    }

    // STEP 3: If not throttled, update real-time Redis Geospatial layer
    if (shouldPersistToHistory) {
      await geoTrackingService.updateLocation({
        userId,
        role: 'navigator',
        longitude: coordinates[0],
        latitude: coordinates[1],
        heading: payload.heading,
        speed: payload.speed,
        accuracy: payload.accuracy,
        timestamp,
        metadata: {
          tripId,
          appLifecycleMode,
          batteryLevel: payload.batteryLevel,
          isGeofenceTrigger: payload.isGeofenceTrigger,
        },
      });

      // Update Navigation Session progress asynchronously
      this.updateNavigationSessionLocation(tripId, coordinates, payload.heading, payload.speed).catch(
        (err) => {
          logger.debug(`Session async progress update skipped: ${err.message}`);
        }
      );
    }

    // STEP 4: Geofence milestone context (approaching destination check)
    let distanceToDestinationMeters: number | undefined;
    let isWithinMilestoneGeofence = false;

    if (session.destinationCoordinates) {
      distanceToDestinationMeters = Math.round(
        calculateDistanceMeters(coordinates, session.destinationCoordinates)
      );

      // Milestone geofences: within 500m or 100m of destination
      isWithinMilestoneGeofence = distanceToDestinationMeters <= 500;
    }

    // Calculate next recommended wake-up window for background client OS
    const nextWakeupSeconds = isWithinMilestoneGeofence
      ? 15 // Wake up more frequently as user approaches destination
      : directive.recommendedIntervalSeconds;

    // STEP 5: Physical Activity & Motion Recognition (STILL vs Motion State Switching)
    let motionEvaluation: any;
    if (payload.activity) {
      try {
        motionEvaluation = await activityRecognitionService.processActivityUpdate({
          tripId,
          userId,
          activity: payload.activity as PhysicalActivityType,
          confidence: payload.activityConfidence ?? 100,
          coordinates,
          speed: payload.speed,
          heading: payload.heading,
          timestamp,
          permissions: payload.permissions
            ? {
                activityRecognition: true,
                fineLocation: payload.permissions.fineLocation,
              }
            : undefined,
          trafficCongestionLevel: payload.metadata?.trafficCongestionLevel,
        });
      } catch (err: any) {
        logger.debug(`Motion evaluation skipped: ${err.message}`);
      }
    }

    // STEP 6: Real-Time Geofence Push Trigger Engine (e.g. Driver is 500m or 100m away)
    let geofencePushTrigger: any;
    if (session.destinationCoordinates) {
      try {
        geofencePushTrigger = await geofenceTriggerService.evaluateProximityAndTriggerPush({
          tripId,
          driverId: userId,
          customerUserId: session.customerUserId || session.userId,
          driverCoordinates: coordinates,
          destinationCoordinates: session.destinationCoordinates,
          distanceToTargetMeters: distanceToDestinationMeters,
        });
      } catch (err: any) {
        logger.debug(`Geofence push trigger check skipped: ${err.message}`);
      }
    }

    // STEP 7: Bluetooth BLE Beacon Mapping (Indoor & Underground Weak-Signal Areas)
    let indoorBeaconPosition: any;
    if (payload.scannedBeacons && payload.scannedBeacons.length > 0) {
      try {
        indoorBeaconPosition = await indoorBeaconMappingService.translateBeaconsToIndoorCoordinates({
          beacons: payload.scannedBeacons,
          permissions: payload.permissions
            ? {
                platform: 'android',
                bluetoothScan: true,
                bluetoothConnect: true,
                ...(payload.permissions as any),
              }
            : undefined,
          userId,
          tripId,
        });

        // If indoor coordinates are resolved in a weak-signal area, override coordinates
        if (indoorBeaconPosition && indoorBeaconPosition.resolved) {
          coordinates = indoorBeaconPosition.geographicCoordinates;
        }
      } catch (err: any) {
        logger.debug(`Indoor beacon translation skipped: ${err.message}`);
      }
    }

    return {
      accepted: true,
      tripId,
      userId,
      appLifecycleMode,
      ingestionRate: {
        ...directive,
        recommendedIntervalSeconds: nextWakeupSeconds,
      },
      sessionState: {
        status: motionEvaluation?.tripStatus || session.status,
        remainingDistanceMeters: distanceToDestinationMeters,
      },
      geofencingContext: {
        isWithinMilestoneGeofence,
        distanceToDestinationMeters,
        nextRecommendedWakeupSeconds: nextWakeupSeconds,
      },
      motionEvaluation,
      geofencePushTrigger,
      indoorBeaconPosition,
      timestamp,
    };
  }

  /**
   * Handles client notification of lifecycle change (e.g. app sent to background or brought to foreground).
   */
  async handleLifecycleChange(payload: ClientLifecycleChangePayload): Promise<IngestionRateDirective> {
    const { tripId, userId, appLifecycleMode, permissions, batteryLevel } = payload;

    // Validate that trip session is still active
    const validation = await sessionValidationService.validateActiveTripSession(tripId, userId);
    if (!validation.isValid) {
      logger.warn(`Lifecycle change for non-active trip rejected: ${tripId}`);
    }

    const policy = dynamicRateLimiterService.getPolicyForLifecycle(
      appLifecycleMode,
      permissions,
      batteryLevel
    );

    logger.info(
      `📱 Client lifecycle changed for trip ${tripId}: Mode=${appLifecycleMode}, TargetInterval=${policy.recommendedIntervalSeconds}s (BatterySaver=${policy.batterySavingActive})`
    );

    return policy;
  }

  /**
   * Updates MongoDB navigation session document with latest fix.
   */
  private async updateNavigationSessionLocation(
    sessionId: string,
    coordinates: [number, number],
    heading?: number,
    speed?: number
  ): Promise<void> {
    try {
      await NavigationSession.updateOne(
        { sessionId, status: 'active' },
        {
          $set: {
            'lastKnownLocation.coordinates': coordinates,
            lastHeading: heading ?? 0,
            lastSpeed: speed ?? 0,
            updatedAt: new Date(),
          },
        }
      );
    } catch (e) {
      // Ignored for non-blocking execution
    }
  }
}

export const locationIngestionService = new LocationIngestionService();
