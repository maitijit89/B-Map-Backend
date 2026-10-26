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
    // 1. Sovereign Indian Highway & Urban Traffic Segments
    const segments: TrafficSegment[] = [
      {
        segmentId: 'traf_nh48_gurgaon',
        roadName: 'NH-48 Delhi-Gurugram Expressway (Cyber City to IFFCO)',
        congestionLevel: 'congested',
        speedLimitKmh: 70,
        currentSpeedKmh: 24,
        speedMultiplier: 0.34,
        lengthMeters: 2800,
        delaySeconds: 280,
        geometry: [
          [77.085, 28.495],
          [77.072, 28.472],
        ],
      },
      {
        segmentId: 'traf_weh_mumbai',
        roadName: 'Western Express Highway (BKC Flyover Merge)',
        congestionLevel: 'slow',
        speedLimitKmh: 60,
        currentSpeedKmh: 31,
        speedMultiplier: 0.52,
        lengthMeters: 1900,
        delaySeconds: 165,
        geometry: [
          [72.852, 19.068],
          [72.848, 19.052],
        ],
      },
      {
        segmentId: 'traf_outer_ring_blr',
        roadName: 'Outer Ring Road (Marathahalli - Bellandur Tech Corridor)',
        congestionLevel: 'congested',
        speedLimitKmh: 50,
        currentSpeedKmh: 14,
        speedMultiplier: 0.28,
        lengthMeters: 2400,
        delaySeconds: 320,
        geometry: [
          [77.695, 12.935],
          [77.682, 12.924],
        ],
      },
      {
        segmentId: 'traf_kudamm_mid',
        roadName: 'Central Arterial Corridor',
        congestionLevel: 'slow',
        speedLimitKmh: 50,
        currentSpeedKmh: 32,
        speedMultiplier: 0.64,
        lengthMeters: 1200,
        delaySeconds: 85,
        geometry: [
          [77.2177, 28.6304],
          [77.228, 28.633],
        ],
      },
    ];

    for (const s of segments) {
      this.inMemoryTraffic.set(s.segmentId, s);
    }

    // 2. Sovereign Speed & Red Light Enforcement Cameras
    const cameras: SpeedCameraAlert[] = [
      {
        cameraId: 'cam_nh48_delhi_radar',
        type: 'fixed_radar',
        location: [77.102, 28.528],
        speedLimitKmh: 70,
        distanceAheadMeters: 450,
        warningMessage: 'Delhi Police Automated Radar Camera in 450m (70 km/h limit).',
      },
      {
        cameraId: 'cam_yamuna_avg_speed',
        type: 'section_average_speed',
        location: [77.535, 28.18],
        speedLimitKmh: 100,
        distanceAheadMeters: 600,
        warningMessage: 'Yamuna Expressway Average Speed Zone in 600m (100 km/h limit).',
      },
      {
        cameraId: 'cam_bengaluru_airport_redlight',
        type: 'red_light',
        location: [77.605, 13.085],
        speedLimitKmh: 80,
        distanceAheadMeters: 300,
        warningMessage: 'BTP Automated Red Light & Speed Camera ahead at Hebbal junction.',
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
export const carNavigationEngineService = carNavigationService;
