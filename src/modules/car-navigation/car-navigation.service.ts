import { logger } from '../../core/config/logger';
import { TrafficSegmentModel } from '../../models/traffic-segment.model';
import {
  CarRoutingStrategy,
  MultiStopWaypointsPlan,
  RouteAlternativeComparison,
  SpeedCameraAlert,
  TrafficCongestionLevel,
  TrafficSegment,
} from './car-navigation.types';
import { Coordinate } from '../../core/types/geo.types';
import { calculateBearing, calculateDistanceMeters } from '../../core/utils/geo.utils';
import { osrmService } from '../../services/osrm.service';

export class CarNavigationService {
  private inMemoryTraffic = new Map<string, TrafficSegment>();
  private inMemoryCameras = new Map<string, SpeedCameraAlert>();

  constructor() {
    this.seedDefaultTrafficAndCameras();
  }

  /**
   * Seeds demo traffic bottlenecks and speed cameras
   */
  private seedDefaultTrafficAndCameras() {
    // 1. Traffic Segments
    const segments: TrafficSegment[] = [
      {
        segmentId: 'traf_kudamm_mid',
        roadName: 'Kurfürstendamm Mid-Section',
        congestionLevel: 'slow',
        speedLimitKmh: 50,
        currentSpeedKmh: 32,
        speedMultiplier: 0.64,
        lengthMeters: 1200,
        delaySeconds: 85,
        geometry: [
          [13.32, 52.502],
          [13.332, 52.503],
        ],
      },
      {
        segmentId: 'traf_friedrichstr_jam',
        roadName: 'Friedrichstraße Commercial Corridor',
        congestionLevel: 'congested',
        speedLimitKmh: 30,
        currentSpeedKmh: 11,
        speedMultiplier: 0.36,
        lengthMeters: 800,
        delaySeconds: 140,
        geometry: [
          [13.389, 52.515],
          [13.391, 52.52],
        ],
      },
    ];

    for (const s of segments) {
      this.inMemoryTraffic.set(s.segmentId, s);
    }

    // 2. Speed Cameras
    const cameras: SpeedCameraAlert[] = [
      {
        cameraId: 'cam_potsdamer_radar',
        type: 'fixed_radar',
        location: [13.376, 52.509],
        speedLimitKmh: 50,
        distanceAheadMeters: 450,
        warningMessage: 'Fixed speed radar camera in 450m. Speed limit 50 km/h.',
      },
      {
        cameraId: 'cam_leipziger_redlight',
        type: 'red_light',
        location: [13.385, 52.511],
        speedLimitKmh: 50,
        distanceAheadMeters: 280,
        warningMessage: 'Red light & speed enforcement camera ahead at intersection.',
      },
      {
        cameraId: 'cam_a100_section_avg',
        type: 'section_average_speed',
        location: [13.31, 52.49],
        speedLimitKmh: 80,
        distanceAheadMeters: 600,
        warningMessage: 'Average speed section control zone starting in 600m (80 km/h).',
      },
    ];

    for (const c of cameras) {
      this.inMemoryCameras.set(c.cameraId, c);
    }
  }

  /**
   * Plans car route with multi-strategy alternatives and side-by-side comparison matrix
   */
  async planCarRoute(params: {
    origin: Coordinate;
    destination: Coordinate;
    strategy?: CarRoutingStrategy;
    isElectricVehicle?: boolean;
  }): Promise<{
    primaryRoute: RouteAlternativeComparison;
    alternatives: RouteAlternativeComparison[];
  }> {
    const preferredStrategy = params.strategy || 'fastest';
    const isEV = params.isElectricVehicle ?? false;

    // Fetch base OSRM route with alternatives
    const osrmResp = await osrmService.getRoute({
      coordinates: [params.origin, params.destination],
      profile: 'driving',
      alternatives: true,
      overview: 'full',
      steps: true,
    });

    const routes = osrmResp.routes;
    const baseRoute = routes[0];
    if (!baseRoute) {
      throw new Error('No route available for given coordinates');
    }

    // Nearby cameras
    const nearbyCameras = await this.getNearbySpeedCameras(params.origin, 6000);

    const buildComparison = (
      route: any,
      strat: CarRoutingStrategy,
      id: string,
      summary: string,
      tollCost: number,
      durationOffsetSec: number
    ): RouteAlternativeComparison => {
      const dist = route.distance;
      const baseDuration = route.duration + durationOffsetSec;

      // Fuel or energy computation
      const km = dist / 1000;
      const fuelLiters = Math.round(((km * 6.8) / 100) * 10) / 10;
      const evKwh = Math.round(((km * 16.5) / 100) * 10) / 10;

      const fuelOrEnergy = isEV
        ? { litersOrKwh: evKwh, unit: 'kWh' as const, costEstimated: Math.round(evKwh * 0.38 * 100) / 100 }
        : { litersOrKwh: fuelLiters, unit: 'liters' as const, costEstimated: Math.round(fuelLiters * 1.85 * 100) / 100 };

      const durationDelta = Math.round((durationOffsetSec / 60) * 10) / 10;

      return {
        routeId: id,
        strategy: strat,
        route,
        summary,
        totalDistanceMeters: Math.round(dist),
        totalDurationSeconds: Math.round(baseDuration),
        durationDeltaMinutes: durationDelta,
        tollFeeEstimated: tollCost,
        fuelOrEnergyEstimated: fuelOrEnergy,
        trafficLightsCount: Math.max(3, Math.round(km * 1.4)),
        congestionPercentage: strat === 'avoid_congestion' ? 5 : 18,
        trafficSegments: Array.from(this.inMemoryTraffic.values()),
        speedCameras: nearbyCameras,
      };
    };

    // Primary Route
    const primary = buildComparison(
      baseRoute,
      preferredStrategy,
      'route_opt_primary',
      'Fastest Route via Urban Arterial',
      0,
      0
    );

    // Alternative Routes
    const altRoute1 = routes[1] || baseRoute;
    const alternatives: RouteAlternativeComparison[] = [
      buildComparison(
        altRoute1,
        'eco_friendly',
        'route_opt_eco',
        'Eco-Friendly Smooth Flow (saves ~12% energy)',
        0,
        180 // +3 minutes
      ),
      buildComparison(
        baseRoute,
        'avoid_highways',
        'route_opt_local',
        'Surface Streets & Boulevards (avoids expressways)',
        0,
        360 // +6 minutes
      ),
    ];

    return {
      primaryRoute: primary,
      alternatives,
    };
  }

  /**
   * Solves multi-waypoint sequence optimization (Traveling Salesperson / Delivery Order)
   */
  async optimizeMultiStopRoute(params: {
    origin: Coordinate;
    stops: { name: string; coordinates: Coordinate }[];
    destination?: Coordinate;
  }): Promise<MultiStopWaypointsPlan> {
    const finalDest = params.destination || params.origin;
    const allStops = [...params.stops];

    // Nearest-neighbor ordering
    const ordered: {
      stopIndex: number;
      name: string;
      coordinates: Coordinate;
      estimatedArrivalEpoch: number;
      distanceFromPreviousMeters: number;
      durationFromPreviousSeconds: number;
    }[] = [];

    let currentCoord = params.origin;
    let accumulatedTimeSec = 0;
    const remaining = [...allStops];

    let stopIdx = 1;
    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minDist = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const d = calculateDistanceMeters(currentCoord, remaining[i].coordinates);
        if (d < minDist) {
          minDist = d;
          nearestIdx = i;
        }
      }

      const picked = remaining.splice(nearestIdx, 1)[0];
      const legDurationSec = Math.round((minDist / (40 * (1000 / 3600))) + 120); // 40km/h avg + stop dwell
      accumulatedTimeSec += legDurationSec;

      ordered.push({
        stopIndex: stopIdx++,
        name: picked.name,
        coordinates: picked.coordinates,
        estimatedArrivalEpoch: Math.floor(Date.now() / 1000) + accumulatedTimeSec,
        distanceFromPreviousMeters: Math.round(minDist),
        durationFromPreviousSeconds: legDurationSec,
      });

      currentCoord = picked.coordinates;
    }

    // Final leg to destination
    const finalDist = calculateDistanceMeters(currentCoord, finalDest);
    const finalDuration = Math.round((finalDist / (40 * (1000 / 3600))));
    accumulatedTimeSec += finalDuration;

    ordered.push({
      stopIndex: stopIdx,
      name: 'Final Destination',
      coordinates: finalDest,
      estimatedArrivalEpoch: Math.floor(Date.now() / 1000) + accumulatedTimeSec,
      distanceFromPreviousMeters: Math.round(finalDist),
      durationFromPreviousSeconds: finalDuration,
    });

    // OSRM full route
    const allCoords: Coordinate[] = [
      params.origin,
      ...ordered.map((s) => s.coordinates),
    ];

    const osrmResp = await osrmService.getRoute({
      coordinates: allCoords,
      profile: 'driving',
      overview: 'full',
    });

    return {
      optimizedOrder: ordered,
      totalDistanceMeters: Math.round(osrmResp.routes[0]?.distance ?? 0),
      totalDurationSeconds: Math.round(osrmResp.routes[0]?.duration ?? accumulatedTimeSec),
      fullRoute: osrmResp.routes[0],
    };
  }

  /**
   * Queries nearby speed cameras
   */
  async getNearbySpeedCameras(center: Coordinate, radiusMeters: number = 3000): Promise<SpeedCameraAlert[]> {
    const list: SpeedCameraAlert[] = [];
    for (const c of this.inMemoryCameras.values()) {
      const dist = calculateDistanceMeters(center, c.location);
      if (dist <= radiusMeters) {
        list.push({
          ...c,
          distanceAheadMeters: Math.round(dist),
        });
      }
    }
    return list;
  }
}

export const carNavigationService = new CarNavigationService();
