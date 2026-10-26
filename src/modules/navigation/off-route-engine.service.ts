import * as turf from '@turf/turf';
import { logger } from '../../core/config/logger';
import { env } from '../../core/config/env.config';
import { Coordinate, GeoJsonLineString } from '../../core/types/geo.types';
import { OsrmRoute } from '../../core/types/osrm.types';
import { calculateBearing, calculateDistanceMeters, checkOffRoute } from '../../core/utils/geo.utils';
import { osrmService } from '../routes/osrm.service';

export type RerouteState = 'TRACKING' | 'POTENTIAL_OFF_ROUTE' | 'REROUTING' | 'REACQUIRED';

export interface RerouteEvaluationResult {
  sessionId: string;
  state: RerouteState;
  isOffRoute: boolean;
  shouldReroute: boolean;
  distanceFromRouteMeters: number;
  nearestPointOnRoute: Coordinate;
  headingDivergenceDeg: number;
  consecutiveDivergenceEpochs: number;
  cooldownActive: boolean;
  cooldownRemainingSeconds: number;
  rerouteReason: 'LATERAL_XTD_BREACH' | 'HEADING_DIVERGENCE_3_EPOCHS' | 'MANUAL_TRIGGER' | 'NONE';
  newRoute?: OsrmRoute;
}

interface SessionRerouteTracker {
  sessionId: string;
  consecutiveDivergenceEpochs: number;
  lastRerouteTimestamp: number;
  state: RerouteState;
  rerouteCount: number;
}

/**
 * Dynamic Rerouting & Off-Route Engine
 * Implements Cross-Track Error (XTD) monitoring, 5-second anti-jitter cooldown,
 * and 3-epoch heading divergence detection (>60° divergence over 15m) per
 * features.md Section 1.4 & algorithm.md Section 2.
 */
export class OffRouteEngineService {
  private sessionTrackers = new Map<string, SessionRerouteTracker>();

  // Configuration constants
  private readonly DEFAULT_XTD_THRESHOLD_METERS = env.OFF_ROUTE_THRESHOLD_METERS || 40.0;
  private readonly HEADING_DIVERGENCE_DISTANCE_THRESHOLD_METERS = 15.0;
  private readonly HEADING_DIVERGENCE_ANGLE_THRESHOLD_DEG = 60.0;
  private readonly REQUIRED_CONSECUTIVE_EPOCHS = 3;
  private readonly REROUTE_COOLDOWN_MS = (env.REROUTE_COOLDOWN_SECONDS || 5) * 1000;

  /**
   * Evaluates the vehicle's real-time kinematic position against the active route geometry.
   * Detects lateral cross-track deviations and heading divergence, triggering automated reroute.
   */
  public async evaluateAndProcessProgress(params: {
    sessionId: string;
    currentLocation: Coordinate;
    destination: Coordinate;
    routeGeometry: GeoJsonLineString;
    profile?: 'driving' | 'bike' | 'foot';
    heading?: number;
    speedMps?: number;
    customXtdThresholdMeters?: number;
  }): Promise<RerouteEvaluationResult> {
    const {
      sessionId,
      currentLocation,
      destination,
      routeGeometry,
      profile = 'driving',
      heading,
    } = params;

    let tracker = this.sessionTrackers.get(sessionId);
    if (!tracker) {
      tracker = {
        sessionId,
        consecutiveDivergenceEpochs: 0,
        lastRerouteTimestamp: 0,
        state: 'TRACKING',
        rerouteCount: 0,
      };
      this.sessionTrackers.set(sessionId, tracker);
    }

    const xtdThreshold = params.customXtdThresholdMeters ?? this.DEFAULT_XTD_THRESHOLD_METERS;

    // 1. Geodesic Cross-Track Error (XTD) Evaluation
    const offRouteCheck = checkOffRoute(currentLocation, routeGeometry, xtdThreshold);
    const xtdMeters = offRouteCheck.distanceFromRouteMeters;

    // 2. Heading Divergence Analysis relative to nearest segment
    let headingDivergenceDeg = 0;
    if (heading !== undefined && heading >= 0) {
      const segmentBearing = this.computeNearestSegmentBearing(currentLocation, routeGeometry);
      headingDivergenceDeg = this.computeAngularDifference(heading, segmentBearing);

      // Check if heading divergence condition is met (>60° divergent while >15m off-route)
      if (
        xtdMeters >= this.HEADING_DIVERGENCE_DISTANCE_THRESHOLD_METERS &&
        headingDivergenceDeg >= this.HEADING_DIVERGENCE_ANGLE_THRESHOLD_DEG
      ) {
        tracker.consecutiveDivergenceEpochs += 1;
      } else {
        tracker.consecutiveDivergenceEpochs = 0;
      }
    } else {
      tracker.consecutiveDivergenceEpochs = 0;
    }

    // 3. Determine if reroute condition is breached
    const isLateralBreach = offRouteCheck.isOffRoute; // XTD > 40m
    const isHeadingBreach = tracker.consecutiveDivergenceEpochs >= this.REQUIRED_CONSECUTIVE_EPOCHS; // >60° for 3 epochs

    const isOffRoute = isLateralBreach || isHeadingBreach;
    let rerouteReason: RerouteEvaluationResult['rerouteReason'] = 'NONE';
    if (isHeadingBreach) {
      rerouteReason = 'HEADING_DIVERGENCE_3_EPOCHS';
    } else if (isLateralBreach) {
      rerouteReason = 'LATERAL_XTD_BREACH';
    }

    // 4. Anti-jitter cooldown verification
    const now = Date.now();
    const elapsedSinceLastReroute = now - tracker.lastRerouteTimestamp;
    const cooldownActive = elapsedSinceLastReroute < this.REROUTE_COOLDOWN_MS;
    const cooldownRemainingSec = cooldownActive
      ? Math.max(0, Math.ceil((this.REROUTE_COOLDOWN_MS - elapsedSinceLastReroute) / 1000))
      : 0;

    let shouldReroute = isOffRoute && !cooldownActive;
    let newRoute: OsrmRoute | undefined;

    // 5. Execute Reroute if triggered and cooled down
    if (shouldReroute) {
      tracker.state = 'REROUTING';
      logger.warn(
        `🚨 [REROUTE ENGINE] Deviation detected on session ${sessionId} (${rerouteReason}: XTD ${xtdMeters}m, Div ${headingDivergenceDeg.toFixed(1)}°). Triggering dynamic reroute...`
      );

      try {
        const freshPlan = await osrmService.getRoute({
          coordinates: [currentLocation, destination],
          profile,
          steps: true,
          overview: 'full',
          geometries: 'geojson',
        });

        if (freshPlan.routes && freshPlan.routes[0]) {
          newRoute = freshPlan.routes[0];
          tracker.lastRerouteTimestamp = now;
          tracker.rerouteCount += 1;
          tracker.consecutiveDivergenceEpochs = 0;
          tracker.state = 'REACQUIRED';
          logger.info(`✅ [REROUTE ENGINE] Session ${sessionId} seamlessly restitched. New distance: ${newRoute.distance}m`);
        } else {
          tracker.state = 'POTENTIAL_OFF_ROUTE';
        }
      } catch (err: any) {
        logger.error(`[REROUTE ENGINE] Failed recalculating route: ${err.message}`);
        tracker.state = 'POTENTIAL_OFF_ROUTE';
      }
    } else if (isOffRoute) {
      tracker.state = 'POTENTIAL_OFF_ROUTE';
    } else {
      tracker.state = 'TRACKING';
    }

    return {
      sessionId,
      state: tracker.state,
      isOffRoute,
      shouldReroute: newRoute !== undefined,
      distanceFromRouteMeters: xtdMeters,
      nearestPointOnRoute: offRouteCheck.nearestPointOnRoute,
      headingDivergenceDeg: Math.round(headingDivergenceDeg * 10) / 10,
      consecutiveDivergenceEpochs: tracker.consecutiveDivergenceEpochs,
      cooldownActive,
      cooldownRemainingSeconds: cooldownRemainingSec,
      rerouteReason,
      newRoute,
    };
  }

  /**
   * Resets internal tracking state for a completed or aborted navigation session.
   */
  public resetSession(sessionId: string): void {
    this.sessionTrackers.delete(sessionId);
  }

  /**
   * Finds the bearing of the road segment closest to the given coordinate.
   */
  private computeNearestSegmentBearing(
    currentLocation: Coordinate,
    routeGeometry: GeoJsonLineString
  ): number {
    const coords = routeGeometry.coordinates;
    if (coords.length < 2) return 0;

    const pt = turf.point(currentLocation);
    const line = turf.lineString(coords);
    const snapped = turf.nearestPointOnLine(line, pt);
    const segmentIndex = snapped.properties.index ?? 0;

    const startCoord = coords[segmentIndex] || coords[0];
    const endCoord = coords[segmentIndex + 1] || coords[coords.length - 1];

    return calculateBearing(startCoord, endCoord);
  }

  /**
   * Computes the smallest absolute angular difference in degrees [0..180].
   */
  private computeAngularDifference(degA: number, degB: number): number {
    const normA = (degA % 360 + 360) % 360;
    const normB = (degB % 360 + 360) % 360;
    let diff = Math.abs(normA - normB);
    if (diff > 180) {
      diff = 360 - diff;
    }
    return diff;
  }
}

export const offRouteEngineService = new OffRouteEngineService();
