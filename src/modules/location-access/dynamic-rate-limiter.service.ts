import { Coordinate } from '../../core/types/geo.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import {
  AppLifecycleMode,
  ClientLocationPermissions,
  IngestionRateDirective,
  LocationTelemetryPayload,
} from './location-access.types';

interface TransmissionHistory {
  lastTimestamp: number;
  lastCoordinates: Coordinate;
  lastSpeed?: number;
  mode: AppLifecycleMode;
  totalPings: number;
}

export class DynamicRateLimiterService {
  private historyMap = new Map<string, TransmissionHistory>();

  /**
   * Evaluates transmission timing against device lifecycle state to enforce dynamic ingestion rates:
   * - Foreground: 1–2 seconds high-frequency ingestion for turn-by-turn guidance.
   * - Background: 30–60 seconds low-frequency ingestion or geofencing triggers to conserve battery.
   */
  evaluateIngestionRate(payload: LocationTelemetryPayload): {
    directive: IngestionRateDirective;
    isStationary: boolean;
    shouldPersistToHistory: boolean;
  } {
    const tripKey = payload.tripId;
    const now = payload.timestamp || Date.now();
    const mode = payload.appLifecycleMode || 'foreground';
    const isGeofenceTrigger = Boolean(payload.isGeofenceTrigger);

    const prev = this.historyMap.get(tripKey);

    // Calculate movement delta if previous coordinates exist
    let deltaMeters = 0;
    if (prev) {
      deltaMeters = calculateDistanceMeters(prev.lastCoordinates, payload.coordinates);
    }

    const elapsedMs = prev ? now - prev.lastTimestamp : 999999;
    const speed = payload.speed ?? (prev ? (deltaMeters / Math.max(elapsedMs / 1000, 1)) * 3.6 : 0);

    // Stationary detection: speed < 2.0 km/h and movement < 10m
    const isStationary = speed < 2.0 && deltaMeters < 10 && Boolean(prev);

    // 1. Foreground Mode (1–2 seconds)
    if (mode === 'foreground') {
      const minIntervalMs = 1000; // 1 second minimum interval
      const throttleApplied = elapsedMs < 800; // Throttle only if spammed below 800ms

      const directive: IngestionRateDirective = {
        mode: 'high_frequency',
        recommendedIntervalMs: 1500, // 1.5 seconds target interval
        recommendedIntervalSeconds: 2,
        batterySavingActive: false,
        throttleApplied,
        minDistanceFilterMeters: 2,
      };

      if (!throttleApplied) {
        this.historyMap.set(tripKey, {
          lastTimestamp: now,
          lastCoordinates: payload.coordinates,
          lastSpeed: speed,
          mode,
          totalPings: (prev?.totalPings || 0) + 1,
        });
      }

      return {
        directive,
        isStationary: false,
        shouldPersistToHistory: !throttleApplied,
      };
    }

    // 2. Background Mode (30–60 seconds or Geofencing Triggers)
    // Milestone / Geofence triggers bypass the standard background throttle delay
    if (isGeofenceTrigger) {
      const directive: IngestionRateDirective = {
        mode: 'geofencing_only',
        recommendedIntervalMs: 30000,
        recommendedIntervalSeconds: 30,
        batterySavingActive: true,
        throttleApplied: false,
        minDistanceFilterMeters: 25,
      };

      this.historyMap.set(tripKey, {
        lastTimestamp: now,
        lastCoordinates: payload.coordinates,
        lastSpeed: speed,
        mode,
        totalPings: (prev?.totalPings || 0) + 1,
      });

      return {
        directive,
        isStationary,
        shouldPersistToHistory: true,
      };
    }

    // Standard Background Pings:
    // Stationary -> 60 seconds interval
    // Moving -> 30 seconds interval
    const targetIntervalMs = isStationary ? 60000 : 30000;
    const targetIntervalSec = isStationary ? 60 : 30;
    const minThresholdMs = 25000; // Allow slight clock jitter down to 25s

    // If client is sending background pings faster than 25 seconds without a geofence trigger,
    // apply graceful throttling to protect backend resources and instruct client to sleep
    const throttleApplied = elapsedMs < minThresholdMs;

    const directive: IngestionRateDirective = {
      mode: isStationary ? 'geofencing_only' : 'low_frequency',
      recommendedIntervalMs: targetIntervalMs,
      recommendedIntervalSeconds: targetIntervalSec,
      batterySavingActive: true,
      throttleApplied,
      minDistanceFilterMeters: isStationary ? 50 : 25,
    };

    if (!throttleApplied) {
      this.historyMap.set(tripKey, {
        lastTimestamp: now,
        lastCoordinates: payload.coordinates,
        lastSpeed: speed,
        mode,
        totalPings: (prev?.totalPings || 0) + 1,
      });
    }

    return {
      directive,
      isStationary,
      shouldPersistToHistory: !throttleApplied,
    };
  }

  /**
   * Returns optimal client ingestion configuration when client switches between foreground and background.
   */
  getPolicyForLifecycle(
    mode: AppLifecycleMode,
    permissions?: ClientLocationPermissions,
    batteryLevel?: number
  ): IngestionRateDirective {
    const isLowBattery = batteryLevel !== undefined && batteryLevel < 0.2; // < 20% battery

    if (mode === 'foreground') {
      return {
        mode: 'high_frequency',
        recommendedIntervalMs: isLowBattery ? 3000 : 1500, // Slightly relax if critically low battery
        recommendedIntervalSeconds: isLowBattery ? 3 : 2,
        batterySavingActive: isLowBattery,
        throttleApplied: false,
        minDistanceFilterMeters: 2,
      };
    }

    // Background mode
    const targetSeconds = isLowBattery ? 60 : 30;
    return {
      mode: isLowBattery ? 'geofencing_only' : 'low_frequency',
      recommendedIntervalMs: targetSeconds * 1000,
      recommendedIntervalSeconds: targetSeconds,
      batterySavingActive: true,
      throttleApplied: false,
      minDistanceFilterMeters: 30,
    };
  }

  /**
   * Resets rate limiter memory when a trip concludes.
   */
  clearTrip(tripId: string): void {
    this.historyMap.delete(tripId);
  }
}

export const dynamicRateLimiterService = new DynamicRateLimiterService();
