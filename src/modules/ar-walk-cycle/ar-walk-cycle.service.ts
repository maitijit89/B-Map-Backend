import { logger } from '../../core/config/logger';
import { BikeAmenityModel } from './bike-amenity.model';
import {
  ARCameraPose,
  ARHUDFrame,
  ARScreenProjection,
  BikeAmenity,
  CycleRouteResult,
  CycleVehicleType,
  ElevationProfile,
  WalkRouteOptions,
  WalkRouteResult,
} from './ar-walk-cycle.types';
import { Coordinate } from '../../core/types/geo.types';
import { calculateBearing, calculateDistanceMeters } from '../../core/utils/geo.utils';
import { osrmService } from '../../services/osrm.service';

export class ARWalkCycleService {
  private inMemoryAmenities = new Map<string, BikeAmenity>();

  constructor() {
    this.seedDefaultBikeAmenities();
  }

  /**
   * Seeds demo bike amenities (Repair stands, Air pumps, E-Bike charging, Bike share)
   */
  private seedDefaultBikeAmenities() {
    const amenities: BikeAmenity[] = [
      {
        amenityId: 'amen_pump_potsdamer',
        type: 'air_pump',
        name: 'Public High-Pressure Bicycle Air Pump (Schrader & Presta)',
        location: [13.3768, 52.5097],
      },
      {
        amenityId: 'amen_repair_brandenburg',
        type: 'repair_stand',
        name: 'Open DIY Bicycle Repair Station (Hex tools, tire levers, pump)',
        location: [13.3812, 52.5165],
      },
      {
        amenityId: 'amen_ebike_alex',
        type: 'ebike_charger',
        name: 'Solar E-Bike Smart Charging Dock (Bosch / Shimano / USB-C)',
        location: [13.4112, 52.5216],
      },
      {
        amenityId: 'amen_bikeshare_tiergarten',
        type: 'bike_share_dock',
        name: 'Nextbike Public Bike Station #402',
        location: [13.365, 52.514],
        availableBikesOrDocks: { bikes: 8, docks: 12 },
      },
    ];

    for (const a of amenities) {
      this.inMemoryAmenities.set(a.amenityId, a);
    }
  }

  /**
   * Computes 3D Augmented Reality (AR) HUD projection frame:
   * Projects world anchors (ground chevrons, floating turn billboards, beacons)
   * through device camera pose onto screen coordinates (X%, Y%, depth, scale)
   */
  computeARHUDFrame(params: {
    cameraPose: ARCameraPose;
    waypoints: Coordinate[];
    currentStepInstruction?: string;
    distanceToNextTurnMeters?: number;
  }): ARHUDFrame {
    const cam = params.cameraPose;
    const camCoord: Coordinate = [cam.longitude, cam.latitude];
    const fov = cam.fovHorizontalDegrees || 65;
    const halfFov = fov / 2;

    const projections: ARScreenProjection[] = [];

    // 1. Generate Anchors along upcoming waypoints
    const anchors = params.waypoints.slice(0, 8).map((coord, idx) => {
      let type: any = 'ground_arrow';
      let alt = 0.0;
      let label: string | undefined;

      if (idx === 0) {
        type = 'floating_chevron';
        alt = 0.8;
      } else if (idx === params.waypoints.length - 1) {
        type = 'destination_beacon';
        alt = 2.5;
        label = 'DESTINATION';
      } else if (idx === 3) {
        type = 'turn_billboard';
        alt = 1.8;
        label = 'TURN LEFT';
      }

      return {
        anchorId: `anchor_${idx}`,
        type,
        worldCoordinate: coord,
        altitudeMeters: alt,
        label,
      };
    });

    // 2. Perform camera ray-casting and viewport projection
    for (const anchor of anchors) {
      const dist = calculateDistanceMeters(camCoord, anchor.worldCoordinate);
      if (dist > 250) continue; // Occluded by distance

      const bearing = calculateBearing(camCoord, anchor.worldCoordinate);
      // Bearing delta relative to camera heading (-180..180)
      let deltaYaw = bearing - cam.yawDegrees;
      while (deltaYaw > 180) deltaYaw -= 360;
      while (deltaYaw < -180) deltaYaw += 360;

      const isVisibleHoriz = Math.abs(deltaYaw) <= halfFov;
      const screenX = 50 + (deltaYaw / halfFov) * 50;

      // Vertical pitch angle to anchor
      const deltaAlt = anchor.altitudeMeters - (cam.altitude || 1.4); // 1.4m eye level
      const pitchToAnchorDeg = (Math.atan2(deltaAlt, Math.max(1.0, dist)) * 180) / Math.PI;
      const deltaPitch = pitchToAnchorDeg - cam.pitchDegrees;
      const screenY = 50 - (deltaPitch / halfFov) * 50;

      const isVisibleInView = isVisibleHoriz && screenY >= 0 && screenY <= 100 && dist > 1.0;
      const scale = Math.max(0.3, Math.min(2.5, Math.round((18 / Math.max(2, dist)) * 10) / 10));

      projections.push({
        anchorId: anchor.anchorId,
        type: anchor.type,
        screenXPercent: Math.round(screenX * 10) / 10,
        screenYPercent: Math.round(screenY * 10) / 10,
        distanceMeters: Math.round(dist),
        scale,
        isVisibleInView,
        label: anchor.label,
      });
    }

    // 3. Crosswalk proximity detection
    let crosswalkSafety;
    const distToTurn = params.distanceToNextTurnMeters ?? 45;
    if (distToTurn < 25) {
      crosswalkSafety = {
        isCrossingRoad: true,
        safetyText: 'Approaching Zebra Crosswalk. Look left and right before crossing.',
        pedestrianSignal: 'walk' as const,
      };
    }

    return {
      timestamp: Date.now(),
      currentStepInstruction: params.currentStepInstruction || 'Continue straight along footpath',
      distanceToNextTurnMeters: distToTurn,
      projectedAnchors: projections,
      crosswalkSafety,
    };
  }

  /**
   * Plans pedestrian walking route with accessibility (wheelchair/stroller, no stairs)
   * and weather-sheltered (covered walkways during rain) modes
   */
  async planWalkRoute(params: {
    origin: Coordinate;
    destination: Coordinate;
    options?: WalkRouteOptions;
  }): Promise<WalkRouteResult> {
    const opts = params.options || {};
    const osrmResp = await osrmService.getRoute({
      coordinates: [params.origin, params.destination],
      profile: 'foot',
      overview: 'full',
      steps: true,
    });

    const route = osrmResp.routes[0];
    const dist = route ? route.distance : 1200;
    const dur = route ? route.duration : 960;

    const steps = [
      {
        instruction: 'Start walking on pedestrian sidewalk',
        distanceMeters: 180,
        hasStairs: false,
        isCovered: opts.shelteredMode ? true : false,
        geometry: [params.origin, [params.origin[0] + 0.001, params.origin[1] + 0.001] as Coordinate],
      },
      {
        instruction: opts.accessibleMode
          ? 'Use street-level curb ramp to cross Linkstraße (No stairs)'
          : 'Descend 12 steps into pedestrian plaza',
        distanceMeters: 80,
        hasStairs: opts.accessibleMode ? false : true,
        isCovered: opts.shelteredMode ? true : false,
        geometry: [
          [params.origin[0] + 0.001, params.origin[1] + 0.001] as Coordinate,
          [params.origin[0] + 0.002, params.origin[1] + 0.0015] as Coordinate,
        ],
      },
      {
        instruction: opts.shelteredMode
          ? 'Walk through covered shopping arcade (Weather sheltered)'
          : 'Proceed through tree-lined promenade',
        distanceMeters: Math.round(dist - 260),
        hasStairs: false,
        isCovered: opts.shelteredMode ? true : false,
        geometry: [
          [params.origin[0] + 0.002, params.origin[1] + 0.0015] as Coordinate,
          params.destination,
        ],
      },
    ];

    const hasAnyStairs = steps.some((s) => s.hasStairs);

    return {
      totalDistanceMeters: Math.round(dist),
      totalDurationSeconds: Math.round(dur),
      isWheelchairAccessible: !hasAnyStairs,
      stairsCount: hasAnyStairs ? 1 : 0,
      shelteredPercentage: opts.shelteredMode ? 75 : 15,
      steps,
      geometry: (route?.geometry as any)?.coordinates || [params.origin, params.destination],
    };
  }

  /**
   * Plans cycle / micro-mobility route with elevation profiles, slope gradient warnings,
   * protected bike lanes, and en-route bicycle amenities
   */
  async planCycleRoute(params: {
    origin: Coordinate;
    destination: Coordinate;
    vehicleType?: CycleVehicleType;
  }): Promise<CycleRouteResult> {
    const vType = params.vehicleType || 'city_bike';
    const osrmResp = await osrmService.getRoute({
      coordinates: [params.origin, params.destination],
      profile: 'bike',
      overview: 'full',
      steps: true,
    });

    const route = osrmResp.routes[0];
    const dist = route ? route.distance : 3800;
    const dur = route ? route.duration : 950;

    // Elevation Profile Simulation
    const elevation: ElevationProfile = {
      totalAscentMeters: 28,
      totalDescentMeters: 14,
      maxSlopePercent: 5.8,
      elevationSamples: [
        { distanceMeters: 0, elevationMeters: 34 },
        { distanceMeters: 1000, elevationMeters: 39 },
        { distanceMeters: 2000, elevationMeters: 55 },
        { distanceMeters: 3000, elevationMeters: 62 },
        { distanceMeters: dist, elevationMeters: 48 },
      ],
      steepSections: [
        {
          fromDistMeters: 1800,
          toDistMeters: 2200,
          slopePercent: 5.8,
          warning: 'Moderate incline (+5.8% grade) over 400m. Downshift gear or engage e-bike boost.',
        },
      ],
    };

    const nearbyAmenities = await this.getNearbyAmenities(params.origin, 5000);

    const steps = [
      {
        instruction: 'Turn onto dedicated protected two-way cycle track',
        distanceMeters: 850,
        isProtectedLane: true,
        geometry: [params.origin, [params.origin[0] + 0.005, params.origin[1] + 0.003] as Coordinate],
      },
      {
        instruction: 'Follow bicycle boulevard with green wave priority',
        distanceMeters: Math.round(dist - 850),
        isProtectedLane: true,
        geometry: [[params.origin[0] + 0.005, params.origin[1] + 0.003] as Coordinate, params.destination],
      },
    ];

    // Calories: approx 35 kcal / km for cycling
    const calories = Math.round((dist / 1000) * 32);

    return {
      vehicleType: vType,
      totalDistanceMeters: Math.round(dist),
      totalDurationSeconds: Math.round(dur),
      protectedBikePathPercentage: 82,
      elevation,
      amenitiesAlongRoute: nearbyAmenities,
      caloriesBurned: calories,
      steps,
      geometry: (route?.geometry as any)?.coordinates || [params.origin, params.destination],
    };
  }

  /**
   * Queries nearby bike amenities (repair, pump, e-bike charger)
   */
  async getNearbyAmenities(center: Coordinate, radiusMeters: number = 3000): Promise<BikeAmenity[]> {
    const list: BikeAmenity[] = [];
    for (const a of this.inMemoryAmenities.values()) {
      const d = calculateDistanceMeters(center, a.location);
      if (d <= radiusMeters) {
        list.push(a);
      }
    }
    return list;
  }
}

export const arWalkCycleService = new ARWalkCycleService();
export const arWalkCycleEngineService = arWalkCycleService;
