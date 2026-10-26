import crypto from 'crypto';
import { logger } from '../../core/config/logger';
import { Coordinate, GeoJsonLineString } from '../../core/types/geo.types';
import { LaneLevelGuidance, VeteranRoutingStyle } from '../../types/lane-routing.types';
import { OsrmRoute } from '../../core/types/osrm.types';
import {
  DynamicRecommendation,
  UnifiedNavigationState,
  UnifiedSessionContext,
  UnifiedTelemetryTick,
} from './unified-engine.types';
import { calculateDistanceMeters, checkOffRoute } from '../../core/utils/geo.utils';
import { laneRoutingService } from '../lane-routing/lane-routing.service';
import { veteranDriverLayerService } from '../lane-routing/veteran-driver-layer.service';
import { osrmService } from '../../services/osrm.service';
import { positioningEngineService } from '../positioning/positioning-engine.service';
import { dynamicRecommendationService } from './dynamic-recommendation.service';
import { offRouteEngineService } from '../navigation/off-route-engine.service';

export class UnifiedUnderlyingEngineService {
  private activeSessions = new Map<string, UnifiedSessionContext>();

  /**
   * Initializes a new Unified Navigation Session
   */
  async startUnifiedSession(params: {
    deviceId: string;
    userId?: string;
    origin: Coordinate;
    destination: Coordinate;
    routingStyle?: VeteranRoutingStyle;
    batteryOrFuelPercentage?: number;
  }): Promise<UnifiedSessionContext> {
    const style = params.routingStyle || 'veteran_fast';
    const sessionId = `unisess_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // 1. Calculate initial route using Veteran Experience Layer
    const veteranPlan = await veteranDriverLayerService.planVeteranEnhancedRoute({
      origin: params.origin,
      destination: params.destination,
      style,
    });

    const context: UnifiedSessionContext = {
      sessionId,
      deviceId: params.deviceId,
      userId: params.userId,
      origin: params.origin,
      destination: params.destination,
      activeRoute: veteranPlan.route,
      routingStyle: style,
      startedAt: Date.now(),
      lastUpdated: Date.now(),
      drivingDurationSeconds: 0,
      batteryOrFuelPercentage: params.batteryOrFuelPercentage ?? 100,
      activeRecommendations: new Map(),
      dismissedRecommendationIds: new Set(),
    };

    this.activeSessions.set(sessionId, context);
    logger.info(`🚀 Unified Underlying Navigation Session started: ${sessionId} for ${params.deviceId}`);
    return context;
  }

  /**
   * Ingests a single real-time telemetry tick and executes the unified underlying pipeline:
   * 1. Sensor Fusion Positioning (RTK / EKF / Dead Reckoning)
   * 2. Off-Route Check & Dynamic Rerouting
   * 3. Lane-Level Real-Time Guidance
   * 4. Context-Aware Dynamic Recommendations
   */
  async processUnifiedTick(tick: UnifiedTelemetryTick): Promise<UnifiedNavigationState> {
    const startTime = Date.now();
    let context = this.activeSessions.get(tick.sessionId);

    // Auto-create context if not already registered
    if (!context) {
      const defaultOrigin: Coordinate = tick.sensorPacket.gnss
        ? [tick.sensorPacket.gnss.longitude, tick.sensorPacket.gnss.latitude]
        : [13.38886, 52.517037];
      const defaultDest: Coordinate = [13.397634, 52.529407];

      context = await this.startUnifiedSession({
        deviceId: tick.sensorPacket.deviceId,
        origin: defaultOrigin,
        destination: defaultDest,
        batteryOrFuelPercentage: tick.batteryOrFuelPercentage,
      });
    }

    const now = tick.timestamp || Date.now();
    const dtSeconds = Math.max(0.1, (now - context.lastUpdated) / 1000.0);
    context.lastUpdated = now;
    context.drivingDurationSeconds += dtSeconds;
    if (tick.batteryOrFuelPercentage !== undefined) {
      context.batteryOrFuelPercentage = tick.batteryOrFuelPercentage;
    }

    // STEP 1: High-Precision Positioning & Sensor Fusion
    const fusedPosition = await positioningEngineService.processSensorPacket(tick.sensorPacket);

    // STEP 2: Progress & Off-Route Verification via OffRouteEngine
    const routeGeometry = context.activeRoute.geometry as GeoJsonLineString;
    const rerouteEval = await offRouteEngineService.evaluateAndProcessProgress({
      sessionId: context.sessionId,
      currentLocation: fusedPosition.coordinates,
      destination: context.destination,
      routeGeometry,
      heading: fusedPosition.headingDegrees,
      speedMps: fusedPosition.speedMps,
    });

    let isRerouted = false;
    if (rerouteEval.shouldReroute) {
      logger.warn(
        `⚠️ Unified Engine: Off route detected (${rerouteEval.rerouteReason}: ${rerouteEval.distanceFromRouteMeters}m). Rerouting with Veteran layer...`
      );
      try {
        const reroutePlan = await veteranDriverLayerService.planVeteranEnhancedRoute({
          origin: fusedPosition.coordinates,
          destination: context.destination,
          style: context.routingStyle,
        });
        context.activeRoute = reroutePlan.route;
        isRerouted = true;
      } catch (err: any) {
        if (rerouteEval.newRoute) {
          context.activeRoute = rerouteEval.newRoute;
          isRerouted = true;
        } else {
          logger.error(`Unified Reroute failed: ${err.message}`);
        }
      }
    }

    // Remaining distance & duration
    const remainingDist = calculateDistanceMeters(fusedPosition.coordinates, context.destination);
    const avgSpeedMps = Math.max(5.0, fusedPosition.speedMps || 12.0);
    const remainingDurationSec = Math.round(remainingDist / avgSpeedMps);

    // STEP 3: Lane-Level Guidance
    const currentLaneIndex = fusedPosition.laneInfo?.assignedLaneIndex ?? 1;
    const nextTurnDirection = remainingDist < 500 ? 'left' : 'straight';

    const laneGuidance: LaneLevelGuidance = await laneRoutingService.computeLaneGuidance({
      roadName: 'Main Route Corridor',
      currentCoordinates: fusedPosition.coordinates,
      currentLaneIndex,
      distanceToNextTurnMeters: Math.min(remainingDist, 350),
      nextManeuverDirection: nextTurnDirection,
      currentSpeedMps: fusedPosition.speedMps,
      timestamp: now,
    });

    // STEP 4: Dynamic Recommendations (Faster Routes, Destination Parking, Low Energy, Fatigue)
    const recommendations = await dynamicRecommendationService.evaluateRecommendations(
      context,
      fusedPosition.coordinates,
      fusedPosition.speedMps,
      remainingDist
    );

    // Compute latency & status
    const latency = Date.now() - startTime;
    const engineStatus = fusedPosition.isDeadReckoningActive
      ? 'dead_reckoning'
      : fusedPosition.metrics.gnssQualityScore >= 60
      ? 'optimal'
      : 'degraded';

    return {
      sessionId: context.sessionId,
      deviceId: context.deviceId,
      timestamp: now,
      fusedPosition,
      remainingDistanceMeters: Math.round(remainingDist),
      remainingDurationSeconds: remainingDurationSec,
      laneGuidance,
      activeRecommendations: recommendations,
      isRerouted,
      systemMetrics: {
        latencyMs: latency,
        gnssQualityScore: fusedPosition.metrics.gnssQualityScore,
        positionPrecision: fusedPosition.precisionLevel,
        engineStatus,
      },
    };
  }

  /**
   * Retrieves active session context
   */
  getSession(sessionId: string): UnifiedSessionContext | null {
    return this.activeSessions.get(sessionId) || null;
  }
}

export const unifiedUnderlyingEngineService = new UnifiedUnderlyingEngineService();
