import { Request, Response, NextFunction } from 'express';
import { Coordinate } from '../types/geo.types';
import { calculateDistanceMeters } from '../utils/geo.utils';
import { logger } from '../config/logger';
import { sendError } from '../utils/api-response';

export interface TelemetryPlausibilityAssessment {
  isPlausible: boolean;
  plausibilityScore: number; // 0..100
  threatLevel: 'NONE' | 'SUSPICIOUS' | 'CRITICAL_SPOOFING';
  violationType?:
    | 'TELEPORTATION_ANOMALY'
    | 'IMPOSSIBLE_ACCELERATION'
    | 'SYNTHETIC_ZERO_JITTER'
    | 'BEARING_DISPLACEMENT_MISMATCH'
    | 'MOCK_LOCATION_FLAG';
  computedKinematics: {
    dtSeconds: number;
    distanceMeters: number;
    computedSpeedKmh: number;
    reportedSpeedKmh: number;
    accelerationMps2: number;
    spatialEntropyVariance: number;
  };
  explanation: string;
}

export interface HistoricalTelemetryPoint {
  coordinate: Coordinate;
  speedKmh: number;
  headingDeg: number;
  timestamp: number;
  accuracyMeters?: number;
}

/**
 * Enterprise Anti-GPS Spoofing & Telematics Kinematic Plausibility Guard.
 * Evaluates physics constraints, kinematic derivatives, Doppler-displacement concordance,
 * and sensor micro-entropy to neutralize synthetic bots, emulator spoofers, and Sybil injection.
 */
export class AntiSpoofingGuard {
  // Maximum plausible physical acceleration for civilian surface road vehicles: 6.5 m/s^2 (~0.66g)
  private readonly MAX_PLAUSIBLE_ACCEL_MPS2 = 6.5;

  // Maximum plausible top speed: 220 km/h
  private readonly MAX_PLAUSIBLE_SPEED_KMH = 220.0;

  // Maximum tolerable discrepancy between displacement vector bearing and reported heading
  private readonly MAX_BEARING_DISCREPANCY_DEG = 70.0;

  // Minimum required spatial micro-entropy (synthetic emulators produce perfectly static/interpolated coordinates)
  private readonly MIN_SPATIAL_ENTROPY_THRESHOLD = 1e-9;

  // Device telemetry history window: deviceId -> HistoricalTelemetryPoint[]
  private deviceHistory = new Map<string, HistoricalTelemetryPoint[]>();

  /**
   * Assesses kinematic plausibility and anti-spoofing integrity for an incoming telemetry update.
   */
  public verifyTelemetryPlausibility(
    deviceId: string,
    current: HistoricalTelemetryPoint
  ): TelemetryPlausibilityAssessment {
    const history = this.deviceHistory.get(deviceId) || [];
    const prev = history[history.length - 1];

    // First fix for device: record baseline
    if (!prev) {
      this.recordDevicePoint(deviceId, current, history);
      return {
        isPlausible: true,
        plausibilityScore: 100,
        threatLevel: 'NONE',
        computedKinematics: {
          dtSeconds: 0,
          distanceMeters: 0,
          computedSpeedKmh: current.speedKmh,
          reportedSpeedKmh: current.speedKmh,
          accelerationMps2: 0,
          spatialEntropyVariance: 1.0,
        },
        explanation: 'Initial telemetry fix established.',
      };
    }

    const dtSeconds = Math.max(0.1, (current.timestamp - prev.timestamp) / 1000);
    const distanceMeters = calculateDistanceMeters(prev.coordinate, current.coordinate);

    // 1. Computed velocity from coordinate displacement: v = d / dt
    const computedSpeedMps = distanceMeters / dtSeconds;
    const computedSpeedKmh = computedSpeedMps * 3.6;

    // 2. Computed acceleration: a = (v_t - v_{t-1}) / dt
    const reportedSpeedDeltaMps = Math.abs((current.speedKmh - prev.speedKmh) * (1000 / 3600));
    const accelerationMps2 = Math.round((reportedSpeedDeltaMps / dtSeconds) * 100) / 100;

    // 3. Spatial micro-entropy across recent points
    const entropyVariance = this.calculateMicroEntropy([prev, current]);

    // Record point in sliding history
    this.recordDevicePoint(deviceId, current, history);

    // --- RULE 1: Teleportation Anomaly Check ---
    if (computedSpeedKmh > this.MAX_PLAUSIBLE_SPEED_KMH) {
      logger.warn(
        `🚨 [ANTI-SPOOFING] Teleportation detected on device ${deviceId}: Traveled ${distanceMeters.toFixed(1)}m in ${dtSeconds.toFixed(1)}s (${computedSpeedKmh.toFixed(1)} km/h)`
      );
      return {
        isPlausible: false,
        plausibilityScore: 10,
        threatLevel: 'CRITICAL_SPOOFING',
        violationType: 'TELEPORTATION_ANOMALY',
        computedKinematics: {
          dtSeconds,
          distanceMeters,
          computedSpeedKmh,
          reportedSpeedKmh: current.speedKmh,
          accelerationMps2,
          spatialEntropyVariance: entropyVariance,
        },
        explanation: `Teleportation anomaly: implied speed ${computedSpeedKmh.toFixed(1)} km/h exceeds maximum surface limit (${this.MAX_PLAUSIBLE_SPEED_KMH} km/h).`,
      };
    }

    // --- RULE 2: Impossible Kinematic Acceleration Check ---
    if (accelerationMps2 > this.MAX_PLAUSIBLE_ACCEL_MPS2) {
      logger.warn(
        `🚨 [ANTI-SPOOFING] Impossible acceleration on device ${deviceId}: ${accelerationMps2.toFixed(1)} m/s^2 exceeds threshold (${this.MAX_PLAUSIBLE_ACCEL_MPS2} m/s^2)`
      );
      return {
        isPlausible: false,
        plausibilityScore: 25,
        threatLevel: 'CRITICAL_SPOOFING',
        violationType: 'IMPOSSIBLE_ACCELERATION',
        computedKinematics: {
          dtSeconds,
          distanceMeters,
          computedSpeedKmh,
          reportedSpeedKmh: current.speedKmh,
          accelerationMps2,
          spatialEntropyVariance: entropyVariance,
        },
        explanation: `Impossible acceleration: ${accelerationMps2.toFixed(1)} m/s^2 violates physical vehicle propulsion dynamics.`,
      };
    }

    // --- RULE 3: Synthetic Zero-Jitter Entropy Check (Mock Location Injection) ---
    // Emulators injecting static points with 0 noise over multiple timestamps
    if (history.length >= 4 && entropyVariance < this.MIN_SPATIAL_ENTROPY_THRESHOLD && current.speedKmh > 10.0) {
      return {
        isPlausible: false,
        plausibilityScore: 35,
        threatLevel: 'SUSPICIOUS',
        violationType: 'SYNTHETIC_ZERO_JITTER',
        computedKinematics: {
          dtSeconds,
          distanceMeters,
          computedSpeedKmh,
          reportedSpeedKmh: current.speedKmh,
          accelerationMps2,
          spatialEntropyVariance: entropyVariance,
        },
        explanation: 'Synthetic coordinate signature: zero GNSS noise variance detected while reporting active velocity.',
      };
    }

    // --- RULE 4: Doppler-Displacement Consistency Check ---
    // If reporting high speed (> 25 km/h), displacement speed must roughly correlate with reported speed
    if (current.speedKmh > 25.0 && computedSpeedKmh < 3.0 && dtSeconds >= 1.0) {
      return {
        isPlausible: false,
        plausibilityScore: 40,
        threatLevel: 'SUSPICIOUS',
        violationType: 'BEARING_DISPLACEMENT_MISMATCH',
        computedKinematics: {
          dtSeconds,
          distanceMeters,
          computedSpeedKmh,
          reportedSpeedKmh: current.speedKmh,
          accelerationMps2,
          spatialEntropyVariance: entropyVariance,
        },
        explanation: `Discrepancy: reported speed ${current.speedKmh} km/h but coordinate displacement is only ${computedSpeedKmh.toFixed(1)} km/h.`,
      };
    }

    return {
      isPlausible: true,
      plausibilityScore: 98,
      threatLevel: 'NONE',
      computedKinematics: {
        dtSeconds,
        distanceMeters,
        computedSpeedKmh: Math.round(computedSpeedKmh * 10) / 10,
        reportedSpeedKmh: current.speedKmh,
        accelerationMps2,
        spatialEntropyVariance: entropyVariance,
      },
      explanation: 'Kinematic trajectory satisfies physical motion constraints.',
    };
  }

  private readonly MAX_DEVICES_TRACKED = 5000;

  private recordDevicePoint(
    deviceId: string,
    point: HistoricalTelemetryPoint,
    history: HistoricalTelemetryPoint[]
  ): void {
    if (this.deviceHistory.size >= this.MAX_DEVICES_TRACKED && !this.deviceHistory.has(deviceId)) {
      const oldestKey = this.deviceHistory.keys().next().value;
      if (oldestKey) this.deviceHistory.delete(oldestKey);
    }

    history.push(point);
    if (history.length > 10) {
      history.shift(); // Retain sliding window of 10 fixes
    }
    this.deviceHistory.set(deviceId, history);
  }

  private calculateMicroEntropy(points: HistoricalTelemetryPoint[]): number {
    if (points.length < 2) return 1.0;
    const lons = points.map((p) => p.coordinate[0]);
    const lats = points.map((p) => p.coordinate[1]);
    const meanLon = lons.reduce((a, b) => a + b, 0) / lons.length;
    const meanLat = lats.reduce((a, b) => a + b, 0) / lats.length;

    const varLon = lons.reduce((acc, x) => acc + Math.pow(x - meanLon, 2), 0) / lons.length;
    const varLat = lats.reduce((acc, y) => acc + Math.pow(y - meanLat, 2), 0) / lats.length;

    return varLon + varLat;
  }

  /**
   * Express Middleware implementing Layer 10 Kinematic Anti-Spoofing Guard.
   * Assesses coordinates and speed vectors on telemetry requests.
   */
  public createMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      const deviceId = (req.body?.deviceId as string) || (req.headers['x-device-id'] as string);
      const isKinematicVerify =
        req.headers['x-kinematic-verify'] === 'true' ||
        req.path.includes('/telemetry') ||
        req.path.includes('/kinematics');

      if (
        deviceId &&
        isKinematicVerify &&
        req.body &&
        (req.body.coordinate || (req.body.latitude !== undefined && req.body.longitude !== undefined))
      ) {
        const coord: Coordinate = req.body.coordinate || [
          Number(req.body.longitude),
          Number(req.body.latitude),
        ];
        const assessment = this.verifyTelemetryPlausibility(deviceId, {
          coordinate: coord,
          speedKmh: Number(req.body.speedKmh ?? req.body.speed ?? 0),
          headingDeg: Number(req.body.headingDeg ?? req.body.heading ?? 0),
          timestamp: Number(req.body.timestamp || Date.now()),
          accuracyMeters: req.body.accuracyMeters ? Number(req.body.accuracyMeters) : undefined,
        });

        (req as any).spoofingAssessment = assessment;
        if (!assessment.isPlausible && assessment.threatLevel === 'CRITICAL_SPOOFING') {
          sendError(res, 403, `Kinematic Anti-Spoofing Violation: ${assessment.explanation}`, {
            violationType: assessment.violationType,
            threatLevel: assessment.threatLevel,
          });
          return;
        }
      }

      next();
    };
  }
}

export const antiSpoofingGuard = new AntiSpoofingGuard();
