import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import {
  GeofenceMilestoneType,
  GeofenceTriggerEvaluationInput,
  GeofenceTriggerEvaluationResult,
} from './notification.types';
import { pushDispatcherService } from './push-dispatcher.service';

export class GeofenceTriggerService {
  // In-memory set of triggered milestones to prevent duplicate notifications during subsequent pings
  private triggeredMilestones = new Set<string>();

  /**
   * Resets triggered milestone state for a trip (e.g. on new trip start).
   */
  resetTripMilestones(tripId: string): void {
    this.triggeredMilestones.delete(`${tripId}:500m`);
    this.triggeredMilestones.delete(`${tripId}:100m`);
  }

  /**
   * Real-time Trigger Engine:
   * When a background or foreground location update triggers a backend geofence
   * (e.g. a delivery driver is 500 meters away), the backend acts as the orchestrator
   * to fire a targeted payload message to the customer's phone via APNs / FCM.
   */
  async evaluateProximityAndTriggerPush(
    input: GeofenceTriggerEvaluationInput
  ): Promise<GeofenceTriggerEvaluationResult> {
    const {
      tripId,
      driverId,
      customerUserId,
      driverCoordinates,
      destinationCoordinates,
      etaSeconds,
    } = input;

    // Calculate real-time geodesic distance in meters
    const distanceToTargetMeters = Math.round(
      calculateDistanceMeters(driverCoordinates, destinationCoordinates)
    );

    const etaMinutes = etaSeconds ? Math.ceil(etaSeconds / 60) : Math.ceil(distanceToTargetMeters / 300); // ~300m/min urban driving estimate

    let milestoneTriggered: GeofenceMilestoneType | 'NONE' = 'NONE';
    let pushDispatched = false;
    let pushResult;

    // -------------------------------------------------------------------------
    // 1. ARRIVAL GEOFENCE: Within 100 meters
    // -------------------------------------------------------------------------
    if (distanceToTargetMeters <= 100) {
      const milestoneKey = `${tripId}:100m`;
      const isAlreadyFired = await this.hasMilestoneFired(tripId, '100m');

      if (!isAlreadyFired) {
        await this.markMilestoneFired(tripId, '100m');
        milestoneTriggered = 'GEOFENCE_ARRIVAL_100M';

        logger.info(
          `🎯 [GEOFENCE TRIGGER] Trip ${tripId}: Driver reached 100m arrival radius. Orchestrating targeted push to customer ${customerUserId}...`
        );

        pushResult = await pushDispatcherService.sendTargetedPush({
          recipientUserId: customerUserId,
          title: 'Driver Arrived! 📍',
          body: 'Your driver has arrived at your pickup location.',
          eventType: 'GEOFENCE_ARRIVAL_100M',
          data: {
            eventType: 'GEOFENCE_ARRIVAL_100M',
            tripId,
            driverId,
            distanceMeters: distanceToTargetMeters,
            etaMinutes: 0,
            status: 'arrived',
          },
          priority: 'high',
        });

        pushDispatched = true;
      }
    }
    // -------------------------------------------------------------------------
    // 2. PROXIMITY GEOFENCE: Within 500 meters (e.g. Delivery Driver 500m Away)
    // -------------------------------------------------------------------------
    else if (distanceToTargetMeters <= 500) {
      const milestoneKey = `${tripId}:500m`;
      const isAlreadyFired = await this.hasMilestoneFired(tripId, '500m');

      if (!isAlreadyFired) {
        await this.markMilestoneFired(tripId, '500m');
        milestoneTriggered = 'GEOFENCE_PROXIMITY_500M';

        logger.info(
          `🚗 [GEOFENCE TRIGGER] Trip ${tripId}: Driver is ${distanceToTargetMeters}m away (<= 500m geofence). Orchestrating targeted push to customer ${customerUserId}...`
        );

        pushResult = await pushDispatcherService.sendTargetedPush({
          recipientUserId: customerUserId,
          title: 'Driver Approaching! 🚗',
          body: `Your driver is approximately 500 meters away (ETA ~${Math.max(etaMinutes, 1)} mins).`,
          eventType: 'GEOFENCE_PROXIMITY_500M',
          data: {
            eventType: 'GEOFENCE_PROXIMITY_500M',
            tripId,
            driverId,
            distanceMeters: distanceToTargetMeters,
            etaMinutes: Math.max(etaMinutes, 1),
            status: 'approaching',
          },
          priority: 'high',
        });

        pushDispatched = true;
      }
    }

    return {
      tripId,
      distanceToTargetMeters,
      milestoneTriggered,
      pushDispatched,
      targetedPushResult: pushResult,
      etaMinutes,
      timestamp: Date.now(),
    };
  }

  /**
   * Checks whether a milestone has already been dispatched to prevent duplicate notification spam.
   */
  private async hasMilestoneFired(tripId: string, milestone: string): Promise<boolean> {
    const key = `${tripId}:${milestone}`;
    if (this.triggeredMilestones.has(key)) {
      return true;
    }

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        const exists = await redis.exists(`geofence:${key}`);
        if (exists === 1) return true;
      }
    } catch (e) {
      // Ignored
    }

    return false;
  }

  /**
   * Marks milestone as fired with 24-hour expiration in Redis / memory.
   */
  private async markMilestoneFired(tripId: string, milestone: string): Promise<void> {
    const key = `${tripId}:${milestone}`;
    this.triggeredMilestones.add(key);

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        await redis.setex(`geofence:${key}`, 86400, '1');
      }
    } catch (e) {
      // Ignored
    }
  }
}

export const geofenceTriggerService = new GeofenceTriggerService();
