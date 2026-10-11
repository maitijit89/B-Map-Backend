import crypto from 'crypto';
import { env } from '../../core/config/env.config';
import { logger } from '../../core/config/logger';
import { NavigationSession } from './navigation-session.model';
import { RouteHistory } from '../routes/route-history.model';
import { Coordinate, GeoJsonLineString } from '../../core/types/geo.types';
import {
  NavigationProgressResponse,
  NavigationProgressUpdate,
  NavigationSessionData,
} from './navigation.types';
import { OsrmRoute, OsrmRouteResponse } from '../../core/types/osrm.types';
import { calculateDistanceMeters, checkOffRoute } from '../../core/utils/geo.utils';
import { osrmService } from '../routes/osrm.service';
import { routeCacheService } from '../routes/route-cache.service';

export class NavigationService {
  // Active in-memory session registry for ultra-fast socket updates
  private activeSessions = new Map<string, NavigationSessionData>();

  /**
   * Starts a new turn-by-turn navigation session.
   */
  async startSession(params: {
    userId: string;
    origin: Coordinate;
    destination: Coordinate;
    waypoints?: Coordinate[];
    profile?: 'driving' | 'bike' | 'foot';
  }): Promise<NavigationSessionData> {
    const profile = params.profile || 'driving';
    const allCoords: Coordinate[] = [
      params.origin,
      ...(params.waypoints || []),
      params.destination,
    ];

    // Check route cache or fetch fresh from OSRM
    const cacheKey = routeCacheService.generateKey({
      coordinates: allCoords,
      profile,
      steps: true,
      overview: 'full',
    });

    let routeResp: OsrmRouteResponse | null = await routeCacheService.get(cacheKey);

    if (!routeResp) {
      routeResp = await osrmService.getRoute({
        coordinates: allCoords,
        profile,
        steps: true,
        overview: 'full',
        geometries: 'geojson',
      });
      await routeCacheService.set(cacheKey, routeResp);
    }

    const route = routeResp.routes[0];
    if (!route) {
      throw new Error('No valid route found between given coordinates');
    }

    const sessionId = `nav_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const geometry = route.geometry as GeoJsonLineString;
    const firstStep = route.legs[0]?.steps[0];
    const nextStep = route.legs[0]?.steps[1] || firstStep;

    const initialDistanceToNextStep = firstStep
      ? calculateDistanceMeters(params.origin, firstStep.maneuver.location)
      : 0;

    const sessionData: NavigationSessionData = {
      sessionId,
      userId: params.userId,
      origin: params.origin,
      destination: params.destination,
      waypoints: params.waypoints,
      profile,
      status: 'active',
      currentRoute: route,
      currentStepIndex: 0,
      currentLocation: params.origin,
      remainingDistanceMeters: route.distance,
      remainingDurationSeconds: route.duration,
      distanceToNextStepMeters: Math.round(initialDistanceToNextStep),
      nextStep,
      rerouteCount: 0,
      startedAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in memory
    this.activeSessions.set(sessionId, sessionData);

    // Persist to MongoDB
    await NavigationSession.create({
      sessionId,
      userId: params.userId,
      profile,
      status: 'active',
      origin: { type: 'Point', coordinates: params.origin },
      destination: { type: 'Point', coordinates: params.destination },
      totalDistanceMeters: route.distance,
      totalDurationSeconds: route.duration,
      remainingDistanceMeters: route.distance,
      remainingDurationSeconds: route.duration,
      lastKnownLocation: { type: 'Point', coordinates: params.origin },
      routeGeometry: geometry,
      startedAt: new Date(),
    });

    // Optionally save to RouteHistory
    RouteHistory.create({
      userId: params.userId,
      profile,
      origin: { type: 'Point', coordinates: params.origin },
      destination: { type: 'Point', coordinates: params.destination },
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry,
      steps: route.legs.flatMap((leg) => leg.steps),
      queryHash: cacheKey,
    }).catch((err) => logger.warn(`Failed saving RouteHistory: ${err.message}`));

    logger.info(`🧭 Navigation session started: ${sessionId} for user: ${params.userId}`);
    return sessionData;
  }

  /**
   * Processes a live location update from the user during navigation.
   * Checks step completion, distance to next maneuver, and off-route detection.
   * Triggers automatic rerouting if off-route threshold is breached.
   */
  async processProgressUpdate(
    update: NavigationProgressUpdate
  ): Promise<NavigationProgressResponse> {
    const session = this.activeSessions.get(update.sessionId);
    if (!session) {
      throw new Error(`Navigation session not found: ${update.sessionId}`);
    }

    if (session.status !== 'active') {
      return {
        sessionId: session.sessionId,
        status: session.status,
        currentLocation: update.currentLocation,
        currentStepIndex: session.currentStepIndex,
        remainingDistanceMeters: session.remainingDistanceMeters,
        remainingDurationSeconds: session.remainingDurationSeconds,
        distanceToNextStepMeters: 0,
        isOffRoute: false,
        distanceFromRouteMeters: 0,
      };
    }

    session.currentLocation = update.currentLocation;
    session.heading = update.heading;
    session.speed = update.speed;
    session.updatedAt = new Date();

    const routeGeometry = session.currentRoute.geometry as GeoJsonLineString;

    // 1. Check destination proximity (e.g. within 20m)
    const distToDestination = calculateDistanceMeters(
      update.currentLocation,
      session.destination
    );

    if (distToDestination <= 25) {
      session.status = 'completed';
      session.remainingDistanceMeters = 0;
      session.remainingDurationSeconds = 0;

      await NavigationSession.updateOne(
        { sessionId: session.sessionId },
        { status: 'completed', completedAt: new Date(), remainingDistanceMeters: 0, remainingDurationSeconds: 0 }
      );

      return {
        sessionId: session.sessionId,
        status: 'completed',
        currentLocation: update.currentLocation,
        currentStepIndex: session.currentStepIndex,
        remainingDistanceMeters: 0,
        remainingDurationSeconds: 0,
        distanceToNextStepMeters: 0,
        isOffRoute: false,
        distanceFromRouteMeters: 0,
      };
    }

    // 2. Off-Route Detection using Turf.js
    const offRouteCheck = checkOffRoute(
      update.currentLocation,
      routeGeometry,
      env.OFF_ROUTE_THRESHOLD_METERS
    );

    let rerouted = false;
    let updatedRoute: OsrmRoute | undefined;

    // 3. Automatic Rerouting if deviated
    if (offRouteCheck.isOffRoute) {
      const now = Date.now();
      const lastReroute = session.lastRerouteTimestamp || 0;
      const cooldownMs = env.REROUTE_COOLDOWN_SECONDS * 1000;

      if (now - lastReroute > cooldownMs) {
        logger.warn(
          `⚠️ Vehicle off route by ${offRouteCheck.distanceFromRouteMeters}m! Triggering dynamic reroute for ${session.sessionId}`
        );

        try {
          const freshRouteResp = await osrmService.getRoute({
            coordinates: [update.currentLocation, session.destination],
            profile: session.profile,
            steps: true,
            overview: 'full',
            geometries: 'geojson',
          });

          if (freshRouteResp.routes[0]) {
            session.currentRoute = freshRouteResp.routes[0];
            session.currentStepIndex = 0;
            session.remainingDistanceMeters = session.currentRoute.distance;
            session.remainingDurationSeconds = session.currentRoute.duration;
            session.rerouteCount += 1;
            session.lastRerouteTimestamp = now;

            rerouted = true;
            updatedRoute = session.currentRoute;

            // Update MongoDB record
            NavigationSession.updateOne(
              { sessionId: session.sessionId },
              {
                $inc: { rerouteCount: 1 },
                $set: {
                  routeGeometry: session.currentRoute.geometry,
                  totalDistanceMeters: session.currentRoute.distance,
                  totalDurationSeconds: session.currentRoute.duration,
                  lastKnownLocation: { type: 'Point', coordinates: update.currentLocation },
                },
              }
            ).catch((err) => logger.warn(`Error updating reroute in DB: ${err.message}`));
          }
        } catch (err: any) {
          logger.error(`Reroute calculation failed: ${err.message}`);
        }
      }
    }

    // 4. Calculate Step Advancement & Distance to next maneuver
    const allSteps = session.currentRoute.legs.flatMap((l) => l.steps);
    let stepIndex = session.currentStepIndex;
    let currentStep = allSteps[stepIndex];
    let nextStep = allSteps[stepIndex + 1];

    if (currentStep) {
      const distToCurrentManeuver = calculateDistanceMeters(
        update.currentLocation,
        currentStep.maneuver.location
      );

      // If user has reached the maneuver point (within 15m), advance to next step
      if (distToCurrentManeuver < 15 && stepIndex < allSteps.length - 1) {
        session.currentStepIndex += 1;
        stepIndex = session.currentStepIndex;
        currentStep = allSteps[stepIndex];
        nextStep = allSteps[stepIndex + 1];
      }
    }

    const distToNextManeuver = nextStep
      ? calculateDistanceMeters(update.currentLocation, nextStep.maneuver.location)
      : currentStep
      ? calculateDistanceMeters(update.currentLocation, currentStep.maneuver.location)
      : 0;

    session.distanceToNextStepMeters = Math.round(distToNextManeuver);
    session.nextStep = nextStep || currentStep;

    // Estimate remaining distance
    session.remainingDistanceMeters = Math.max(0, distToDestination);

    return {
      sessionId: session.sessionId,
      status: session.status,
      currentLocation: update.currentLocation,
      currentStepIndex: session.currentStepIndex,
      remainingDistanceMeters: session.remainingDistanceMeters,
      remainingDurationSeconds: session.remainingDurationSeconds,
      distanceToNextStepMeters: session.distanceToNextStepMeters,
      currentStep,
      nextStep: session.nextStep,
      isOffRoute: offRouteCheck.isOffRoute,
      distanceFromRouteMeters: offRouteCheck.distanceFromRouteMeters,
      rerouted,
      updatedRoute,
    };
  }

  /**
   * Retrieves session state.
   */
  async getSession(sessionId: string): Promise<NavigationSessionData | null> {
    const memory = this.activeSessions.get(sessionId);
    if (memory) return memory;

    const dbRecord = await NavigationSession.findOne({ sessionId });
    if (!dbRecord) return null;

    return {
      sessionId: dbRecord.sessionId,
      userId: dbRecord.userId,
      origin: dbRecord.origin.coordinates as Coordinate,
      destination: dbRecord.destination.coordinates as Coordinate,
      profile: dbRecord.profile,
      status: dbRecord.status,
      currentRoute: {
        distance: dbRecord.totalDistanceMeters,
        duration: dbRecord.totalDurationSeconds,
        weight: 0,
        weight_name: 'routability',
        geometry: dbRecord.routeGeometry,
        legs: [],
      },
      currentStepIndex: 0,
      currentLocation: dbRecord.lastKnownLocation?.coordinates as Coordinate,
      remainingDistanceMeters: dbRecord.remainingDistanceMeters,
      remainingDurationSeconds: dbRecord.remainingDurationSeconds,
      distanceToNextStepMeters: 0,
      rerouteCount: dbRecord.rerouteCount,
      startedAt: dbRecord.startedAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  /**
   * Ends an active navigation session.
   */
  async endSession(
    sessionId: string,
    status: 'completed' | 'cancelled' = 'completed'
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = status;
      this.activeSessions.delete(sessionId);
    }

    await NavigationSession.updateOne(
      { sessionId },
      { status, completedAt: new Date() }
    );

    logger.info(`🏁 Navigation session ${sessionId} ended with status: ${status}`);
  }
}

export const navigationService = new NavigationService();
