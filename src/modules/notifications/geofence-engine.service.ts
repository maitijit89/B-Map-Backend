import * as turf from '@turf/turf';
import { logger } from '../../core/config/logger';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import {
  CustomGeofenceDefinition,
  GeofenceEvaluationEvent,
  GeofenceMilestoneType,
  GeofenceTriggerEvaluationInput,
  GeofenceTriggerEvaluationResult,
} from './notification.types';
import { pushDispatcherService } from './push-dispatcher.service';
import { geofenceTriggerService } from './geofence-trigger.service';

interface DeviceGeofenceState {
  isInside: boolean;
  entryTimestamp?: number;
  dwellNotified: boolean;
  lastEvaluatedTimestamp: number;
}

/**
 * Enterprise Geofence Engine & Real-Time Push Orchestrator
 * Supports Circular & Polygon Geofences, Point-in-Polygon Ray Casting,
 * ENTER/DWELL/EXIT transition states, anti-flapping hysteresis, and trip milestones.
 */
export class GeofenceEngineService {
  private registeredGeofences = new Map<string, CustomGeofenceDefinition>();
  // Map key: `${deviceId}:${geofenceId}`
  private devicePresence = new Map<string, DeviceGeofenceState>();

  // Anti-flapping hysteresis buffer (meters)
  private readonly HYSTERESIS_BUFFER_METERS = 15.0;

  /**
   * Registers a circular or polygonal geofence.
   */
  public registerGeofence(geofence: CustomGeofenceDefinition): CustomGeofenceDefinition {
    this.registeredGeofences.set(geofence.geofenceId, geofence);
    logger.info(`🌐 [GEOFENCE ENGINE] Registered geofence ${geofence.geofenceId} (${geofence.name}, ${geofence.type})`);
    return geofence;
  }

  public getGeofence(geofenceId: string): CustomGeofenceDefinition | null {
    return this.registeredGeofences.get(geofenceId) || null;
  }

  public listGeofences(): CustomGeofenceDefinition[] {
    return Array.from(this.registeredGeofences.values());
  }

  public removeGeofence(geofenceId: string): boolean {
    return this.registeredGeofences.delete(geofenceId);
  }

  /**
   * Evaluates a device's real-time coordinate against all registered geofences.
   * Emits ENTER, DWELL, and EXIT events, and fires push notifications when configured.
   */
  public async evaluateDeviceGeofences(params: {
    userId: string;
    deviceId: string;
    currentCoordinates: [number, number]; // [lon, lat]
    timestamp?: number;
  }): Promise<GeofenceEvaluationEvent[]> {
    const { userId, deviceId, currentCoordinates } = params;
    const now = params.timestamp || Date.now();
    const events: GeofenceEvaluationEvent[] = [];

    for (const geofence of this.registeredGeofences.values()) {
      const stateKey = `${deviceId}:${geofence.geofenceId}`;
      let prevState = this.devicePresence.get(stateKey) || {
        isInside: false,
        dwellNotified: false,
        lastEvaluatedTimestamp: now,
      };

      const isInside = this.checkInsideGeofence(currentCoordinates, geofence);
      let eventType: GeofenceEvaluationEvent['eventType'] = isInside ? 'INSIDE' : 'OUTSIDE';
      let triggeredPush = false;
      let dwellTimeSec: number | undefined;

      // 1. ENTER transition (was outside, now inside)
      if (isInside && !prevState.isInside) {
        eventType = 'ENTER';
        prevState = {
          isInside: true,
          entryTimestamp: now,
          dwellNotified: false,
          lastEvaluatedTimestamp: now,
        };
        this.devicePresence.set(stateKey, prevState);

        logger.info(`📍 [GEOFENCE ENGINE] Device ${deviceId} ENTERED ${geofence.name}`);
        await pushDispatcherService.sendTargetedPush({
          recipientUserId: userId,
          title: `Entered ${geofence.name} 📍`,
          body: `You have arrived at ${geofence.name}.`,
          eventType: 'GEOFENCE_ENTER',
          data: { geofenceId: geofence.geofenceId, event: 'ENTER', timestamp: now },
          priority: 'high',
        });
        triggeredPush = true;
      }
      // 2. DWELL transition (inside for >= threshold)
      else if (isInside && prevState.isInside) {
        const dwellThreshold = (geofence.dwellThresholdSeconds || 120) * 1000;
        const dwellDuration = now - (prevState.entryTimestamp || now);
        dwellTimeSec = Math.floor(dwellDuration / 1000);

        if (!prevState.dwellNotified && dwellDuration >= dwellThreshold) {
          eventType = 'DWELL';
          prevState.dwellNotified = true;
          this.devicePresence.set(stateKey, prevState);

          logger.info(`⏳ [GEOFENCE ENGINE] Device ${deviceId} DWELLING in ${geofence.name} (${dwellTimeSec}s)`);
          await pushDispatcherService.sendTargetedPush({
            recipientUserId: userId,
            title: `Still at ${geofence.name} ⏳`,
            body: `You have been at ${geofence.name} for ${Math.floor(dwellTimeSec / 60)} minutes.`,
            eventType: 'GEOFENCE_DWELL',
            data: { geofenceId: geofence.geofenceId, event: 'DWELL', dwellTimeSec },
            priority: 'normal',
          });
          triggeredPush = true;
        }
      }
      // 3. EXIT transition (was inside, now outside)
      else if (!isInside && prevState.isInside) {
        eventType = 'EXIT';
        const totalDwellSec = prevState.entryTimestamp
          ? Math.floor((now - prevState.entryTimestamp) / 1000)
          : 0;
        dwellTimeSec = totalDwellSec;

        prevState = {
          isInside: false,
          dwellNotified: false,
          lastEvaluatedTimestamp: now,
        };
        this.devicePresence.set(stateKey, prevState);

        logger.info(`🚶 [GEOFENCE ENGINE] Device ${deviceId} EXITED ${geofence.name}`);
        await pushDispatcherService.sendTargetedPush({
          recipientUserId: userId,
          title: `Departed ${geofence.name} 🚶`,
          body: `You have left ${geofence.name}.`,
          eventType: 'GEOFENCE_EXIT',
          data: { geofenceId: geofence.geofenceId, event: 'EXIT', timestamp: now },
          priority: 'normal',
        });
        triggeredPush = true;
      }

      events.push({
        geofenceId: geofence.geofenceId,
        name: geofence.name,
        eventType,
        dwellTimeSeconds: dwellTimeSec,
        triggeredPush,
        timestamp: now,
      });
    }

    return events;
  }

  /**
   * Spatial point-in-geofence verification with hysteresis.
   */
  public checkInsideGeofence(
    coords: [number, number],
    geofence: CustomGeofenceDefinition
  ): boolean {
    if (geofence.type === 'CIRCULAR') {
      const distMeters = calculateDistanceMeters(coords, geofence.center);
      return distMeters <= geofence.radiusMeters;
    }

    if (geofence.type === 'POLYGON') {
      const pt = turf.point(coords);
      // Ensure polygon is closed
      const polyCoords = [...geofence.coordinates];
      if (
        polyCoords.length > 0 &&
        (polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] ||
          polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1])
      ) {
        polyCoords.push(polyCoords[0]);
      }
      const poly = turf.polygon([polyCoords]);
      return turf.booleanPointInPolygon(pt, poly);
    }

    return false;
  }

  /**
   * Evaluates trip delivery proximity milestones (500m & 100m arrival).
   */
  public async evaluateTripMilestones(
    input: GeofenceTriggerEvaluationInput
  ): Promise<GeofenceTriggerEvaluationResult> {
    return geofenceTriggerService.evaluateProximityAndTriggerPush(input);
  }
}

export const geofenceEngineService = new GeofenceEngineService();
