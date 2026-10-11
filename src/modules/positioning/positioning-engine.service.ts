import { Coordinate } from '../../core/types/geo.types';
import {
  EnvironmentType,
  FusedPositionState,
  PrecisionLevel,
  RawSensorPacket,
} from './positioning.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import { deadReckoningService, DeadReckoningState } from './dead-reckoning.service';
import { ekfFusionService, EkfState } from './ekf-fusion.service';
import { environmentDetectorService } from './environment-detector.service';
import { rtkCorrectionService } from './rtk-correction.service';
import { weakSignalResolverService } from './weak-signal-resolver.service';

interface DeviceTrackingContext {
  deviceId: string;
  ekfState?: EkfState;
  drState?: DeadReckoningState;
  lastEnvironment: EnvironmentType;
  lastKnownCoordinates: Coordinate;
  lastTimestamp: number;
}

export class PositioningEngineService {
  private activeContexts = new Map<string, DeviceTrackingContext>();

  /**
   * Cleans up stale tracking contexts (> 1 hour inactive)
   */
  pruneContexts(): void {
    const now = Date.now();
    for (const [id, ctx] of this.activeContexts.entries()) {
      if (now - ctx.lastTimestamp > 3600000) {
        this.activeContexts.delete(id);
      }
    }
  }

  /**
   * Main unified positioning pipeline:
   * Ingests multi-sensor telemetry and outputs high-precision fused position
   */
  async processSensorPacket(packet: RawSensorPacket): Promise<FusedPositionState> {
    const now = packet.timestamp || Date.now();
    let ctx = this.activeContexts.get(packet.deviceId);

    // Initial default coordinate
    const fallbackCoord: Coordinate = packet.gnss
      ? [packet.gnss.longitude, packet.gnss.latitude]
      : [13.38886, 52.517037];

    if (!ctx) {
      ctx = {
        deviceId: packet.deviceId,
        lastEnvironment: 'open_sky',
        lastKnownCoordinates: fallbackCoord,
        lastTimestamp: now,
      };
      this.activeContexts.set(packet.deviceId, ctx);
    }

    // 1. Environment & Quality Assessment
    const { environment, qualityScore } =
      environmentDetectorService.detectEnvironment(
        packet.gnss,
        packet.signals,
        packet.imu,
        ctx.lastEnvironment
      );
    ctx.lastEnvironment = environment;

    // 2. High-Precision RTK Correction (if GNSS present)
    let rtkResult = packet.gnss
      ? rtkCorrectionService.applyCorrection(packet.gnss)
      : null;

    // 3. Weak-Signal Beacon Resolution (if in underground parking/tunnel or GNSS weak)
    let weakSignalFix = null;
    if (environment === 'underground_parking' || environment === 'indoor' || qualityScore < 30) {
      if (packet.signals?.beacons && packet.signals.beacons.length > 0) {
        weakSignalFix = await weakSignalResolverService.resolveBlePosition(packet.signals.beacons);
      }
    }

    // 4. Initialize EKF and Dead Reckoning states if not already active
    if (!ctx.ekfState) {
      const initialCoord = rtkResult?.correctedCoordinates || weakSignalFix?.coordinates || ctx.lastKnownCoordinates;
      ctx.ekfState = ekfFusionService.createInitialState(
        initialCoord,
        packet.gnss?.bearing ?? 0,
        packet.gnss?.speed ?? packet.odometry?.speedMps ?? 0,
        now
      );
    }

    if (!ctx.drState) {
      ctx.drState = {
        lastKnownCoordinates: ctx.lastKnownCoordinates,
        headingDegrees: packet.gnss?.bearing ?? 0,
        speedMps: packet.gnss?.speed ?? packet.odometry?.speedMps ?? 0,
        gyroZBias: 0,
        lastTimestamp: now,
        elapsedDrDurationSeconds: 0,
        confidenceRadiusMeters: rtkResult ? rtkResult.accuracyRadiusMeters : 5.0,
      };
    }

    // 5. Extended Kalman Filter (EKF) Prediction Step
    ekfFusionService.predict(ctx.ekfState, packet.imu, now);

    // 6. Dead Reckoning Propagation
    ctx.drState = deadReckoningService.propagate(
      ctx.drState,
      packet.imu,
      packet.odometry,
      now
    );

    // 7. Measurement Update Step (Correction)
    let innovationDist = 0;
    let isDeadReckoningActive = false;
    let precisionLevel: PrecisionLevel = 'meter_level';
    let confidenceRadius = 3.0;

    if (rtkResult && rtkResult.isRtkApplied && qualityScore >= 60) {
      // High-precision RTK observation update
      const updateResult = ekfFusionService.update(
        ctx.ekfState,
        rtkResult.correctedCoordinates,
        rtkResult.accuracyRadiusMeters,
        true
      );
      innovationDist = updateResult.innovationDistanceMeters;
      isDeadReckoningActive = false;
      ctx.drState.elapsedDrDurationSeconds = 0;
      ctx.drState.confidenceRadiusMeters = rtkResult.accuracyRadiusMeters;

      if (rtkResult.fixType === 'rtk_fixed') {
        precisionLevel = 'centimeter_level';
        confidenceRadius = rtkResult.accuracyRadiusMeters; // < 0.1m
      } else if (rtkResult.fixType === 'rtk_float') {
        precisionLevel = 'lane_level';
        confidenceRadius = rtkResult.accuracyRadiusMeters; // < 0.5m
      } else {
        precisionLevel = 'meter_level';
        confidenceRadius = rtkResult.accuracyRadiusMeters;
      }
    } else if (weakSignalFix) {
      // Weak-signal beacon observation update (underground parking / tunnel)
      const updateResult = ekfFusionService.update(
        ctx.ekfState,
        weakSignalFix.coordinates,
        weakSignalFix.accuracyMeters,
        false
      );
      innovationDist = updateResult.innovationDistanceMeters;
      isDeadReckoningActive = false;
      precisionLevel = 'weak_signal_fallback';
      confidenceRadius = weakSignalFix.accuracyMeters;
      ctx.drState.lastKnownCoordinates = weakSignalFix.coordinates;
      ctx.drState.confidenceRadiusMeters = weakSignalFix.accuracyMeters;
    } else if (packet.gnss && qualityScore >= 35) {
      // Standard GNSS observation update
      const updateResult = ekfFusionService.update(
        ctx.ekfState,
        [packet.gnss.longitude, packet.gnss.latitude],
        packet.gnss.accuracy,
        true
      );
      innovationDist = updateResult.innovationDistanceMeters;
      isDeadReckoningActive = false;
      precisionLevel = 'meter_level';
      confidenceRadius = packet.gnss.accuracy;
      ctx.drState.lastKnownCoordinates = [packet.gnss.longitude, packet.gnss.latitude];
      ctx.drState.elapsedDrDurationSeconds = 0;
    } else {
      // Pure Dead Reckoning Mode (tunnel / blackout / parking without beacons)
      isDeadReckoningActive = true;
      precisionLevel = 'dead_reckoning';
      confidenceRadius = ctx.drState.confidenceRadiusMeters;
    }

    // 8. Compute final fused coordinate from EKF state
    const fusedCoord = ekfFusionService.localToWgs84(
      ctx.ekfState.xEastMeters,
      ctx.ekfState.yNorthMeters,
      ctx.ekfState.anchorWgs84
    );

    // Keep state updated
    ctx.lastKnownCoordinates = fusedCoord;
    ctx.lastTimestamp = now;

    // Heading and speed from EKF state
    const currentSpeed = Math.sqrt(
      ctx.ekfState.vxMps * ctx.ekfState.vxMps + ctx.ekfState.vyMps * ctx.ekfState.vyMps
    );
    const headingDeg = (ctx.ekfState.headingRad * 180.0) / Math.PI;

    // 9. Lane-level resolution if precision is centimeter or lane level
    let laneInfo = undefined;
    if (precisionLevel === 'centimeter_level' || precisionLevel === 'lane_level') {
      // Emulate lane matching with lateral offset
      const lateralDist = Math.sin((now / 10000) * Math.PI) * 1.8; // within road bounds
      laneInfo = rtkCorrectionService.resolveLaneLevel(lateralDist);
    }

    return {
      deviceId: packet.deviceId,
      timestamp: now,
      coordinates: [
        Math.round(fusedCoord[0] * 10000000) / 10000000,
        Math.round(fusedCoord[1] * 10000000) / 10000000,
      ],
      altitude: packet.gnss?.altitude,
      speedMps: Math.round(currentSpeed * 100) / 100,
      headingDegrees: Math.round(headingDeg * 10) / 10,
      precisionLevel,
      environment,
      confidenceRadiusMeters: Math.round(confidenceRadius * 100) / 100,
      isDeadReckoningActive,
      deadReckoningDurationSeconds: ctx.drState.elapsedDrDurationSeconds,
      laneInfo,
      rtkStatus: rtkResult
        ? {
            fixType: rtkResult.fixType,
            baselineLengthKm: rtkResult.baselineDistanceKm,
          }
        : undefined,
      metrics: {
        gnssQualityScore: qualityScore,
        filterInnovationDistanceMeters: Math.round(innovationDist * 100) / 100,
        imuBiasDriftEstimate: Math.round(ctx.ekfState.gyroBiasRadSec * 100000) / 100000,
      },
    };
  }
}

export const positioningEngineService = new PositioningEngineService();
