import mongoose from 'mongoose';
import { Coordinate } from '../../core/types/geo.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import { logger } from '../../core/config/logger';
import { UserVisitedPlaceModel, UserVisitedSpotModel } from './visited-place-scaling.model';
import {
  GeoJSONFeature,
  PersonalizedMapLayerPayload,
  PlaceScaleResult,
  PlaceScalingOptions,
  RecordVisitInput,
  SpotGrowthClassification,
  SpotScaleResult,
  SpotScalingOptions,
  VisitedPlaceRecord,
  VisitedSpotRecord,
} from './visited-place-scaling.types';

export class VisitedPlaceScalingService {
  /**
   * Dual-tier in-memory registries for instant offline response,
   * unit test execution, and zero-downtime client queries.
   */
  private userPlacesMap = new Map<string, Map<string, VisitedPlaceRecord>>(); // userId -> (placeId -> record)
  private userSpotsMap = new Map<string, VisitedSpotRecord[]>();              // userId -> spot records

  constructor() {
    this.seedDefaultUserHabits();
  }

  /**
   * Seeds demo user mobility habits to showcase:
   * 1. Places with high visits becoming prominently larger.
   * 2. Spots with high visits and slow speeds (dwell points) expanding via "slow large".
   * 3. Spots with high visits but high speeds (transit corridors) staying compact.
   */
  private seedDefaultUserHabits(): void {
    const demoUserId = 'usr_traveler_01';

    // 1. Visited Places (Named POIs)
    const places: VisitedPlaceRecord[] = [
      {
        placeId: 'poi_cyber_hub_01',
        name: 'DLF CyberHub Gurugram',
        category: 'commercial_complex',
        coordinates: [77.0885, 28.4955],
        visitCount: 32, // High frequency -> should be largest tier ("landmark_hub")
        totalDwellMinutes: 2880,
        avgSpeedKmH: 2.1,
        tags: ['dining', 'entertainment', 'offices'],
      },
      {
        placeId: 'poi_starbucks_cyber',
        name: 'Starbucks Reserve - CyberHub',
        category: 'cafe',
        coordinates: [77.0891, 28.4958],
        visitCount: 19, // Moderate-high frequency -> "frequent"
        totalDwellMinutes: 1140,
        avgSpeedKmH: 0.9,
        tags: ['coffee', 'wifi', 'workspace'],
      },
      {
        placeId: 'poi_fitso_gym',
        name: 'Cult Fitness & Pool Hub',
        category: 'fitness',
        coordinates: [77.0915, 28.4920],
        visitCount: 8, // Regular frequency -> "regular"
        totalDwellMinutes: 480,
        avgSpeedKmH: 1.5,
        tags: ['gym', 'swimming'],
      },
      {
        placeId: 'poi_ambience_mall',
        name: 'Ambience Mall Gurugram',
        category: 'shopping_mall',
        coordinates: [77.0970, 28.5040],
        visitCount: 2, // Low frequency -> "compact"
        totalDwellMinutes: 180,
        avgSpeedKmH: 3.2,
        tags: ['shopping', 'cinema'],
      },
      {
        placeId: 'poi_art_gallery',
        name: 'National Modern Art Gallery',
        category: 'museum',
        coordinates: [77.2340, 28.6110],
        visitCount: 1, // Single visit -> "compact" (base scale)
        totalDwellMinutes: 90,
        avgSpeedKmH: 1.2,
        tags: ['art', 'culture'],
      },
    ];

    const placeMap = new Map<string, VisitedPlaceRecord>();
    places.forEach((p) => placeMap.set(p.placeId, p));
    this.userPlacesMap.set(demoUserId, placeMap);

    // 2. Visited Spots (Coordinates / Stay-points / Dwell spots)
    const spots: VisitedSpotRecord[] = [
      {
        spotId: 'spot_cyber_amphitheater',
        coordinates: [77.0888, 28.4957],
        visitCount: 24,
        avgSpeedKmH: 0.6, // Very slow / stationary (sitting at amphitheater)
        totalDwellMinutes: 1440,
        spotLabel: 'CyberHub Open Amphitheater Dwell Spot',
      },
      {
        spotId: 'spot_coworking_corner',
        coordinates: [77.0895, 28.4962],
        visitCount: 16,
        avgSpeedKmH: 1.2, // Slow walking / cafe seating
        totalDwellMinutes: 960,
        spotLabel: '91springboard Coworking Bench',
      },
      {
        spotId: 'spot_nh48_toll_flyover',
        coordinates: [77.0810, 28.4990],
        visitCount: 22, // High visits, BUT high speed (highway corridor)
        avgSpeedKmH: 62.0, // High speed -> slownessFactor close to 0 -> stays small!
        totalDwellMinutes: 11,
        spotLabel: 'NH-48 Elevated Expressway Pass-Through',
      },
      {
        spotId: 'spot_metro_rapid_walkway',
        coordinates: [77.0872, 28.4942],
        visitCount: 12,
        avgSpeedKmH: 4.8, // Brisk pedestrian walking
        totalDwellMinutes: 120,
        spotLabel: 'Cyber City Rapid Metro Footbridge',
      },
      {
        spotId: 'spot_quiet_park_bench',
        coordinates: [77.0930, 28.4910],
        visitCount: 1,
        avgSpeedKmH: 0.4, // Very slow, but only 1 visit -> starts compact and slowly grows
        totalDwellMinutes: 25,
        spotLabel: 'Aravalli Biodiversity Park Bench',
      },
    ];

    this.userSpotsMap.set(demoUserId, spots);
  }

  // ============================================================================
  // ALGORITHM 1: USER MOST VISITED PLACES ARE LARGER
  // ============================================================================

  /**
   * Computes dynamic visual scale, pixel radius, ground meter radius,
   * prominence tier, and MapLibre styling for a visited place.
   *
   * Formulated via logarithmic saturating growth:
   *   norm = ln(1 + visitCount) / ln(1 + visitCap)
   *   R = R_min + (R_max - R_min) * (norm ^ gamma)
   */
  public calculatePlaceScale(place: VisitedPlaceRecord, options: PlaceScalingOptions = {}): PlaceScaleResult {
    const visitCount = Math.max(1, place.visitCount || 1);
    const minR = options.minRadiusPx ?? 12;
    const maxR = options.maxRadiusPx ?? 44;
    const minM = options.minRadiusMeters ?? 15;
    const maxM = options.maxRadiusMeters ?? 120;
    const visitCap = options.visitCap ?? 50;
    const gamma = options.curvatureGamma ?? 0.85;

    // Logarithmic normalization
    const norm = Math.min(1.0, Math.log(1 + visitCount) / Math.log(1 + visitCap));
    const curve = Math.pow(norm, gamma);

    const markerRadiusPx = Math.round(minR + (maxR - minR) * curve);
    const influenceRadiusMeters = Math.round(minM + (maxM - minM) * curve);
    const scaleFactor = Math.round((markerRadiusPx / minR) * 100) / 100;
    const importanceWeight = Math.round(curve * 100) / 100;

    // Prominence Tier
    let prominenceTier: PlaceScaleResult['prominenceTier'] = 'compact';
    let labelVisibilityZoom = 15;
    let pulseAnimation = false;

    if (visitCount >= 20) {
      prominenceTier = 'landmark_hub';
      labelVisibilityZoom = 11; // Visible from high altitude
      pulseAnimation = true;
    } else if (visitCount >= 6) {
      prominenceTier = 'frequent';
      labelVisibilityZoom = 13;
      pulseAnimation = true;
    } else if (visitCount >= 2) {
      prominenceTier = 'regular';
      labelVisibilityZoom = 14;
    }

    // Tier-calibrated colors
    let fillColor = '#3B82F6';
    let haloColor = 'rgba(59, 130, 246, 0.25)';
    if (prominenceTier === 'landmark_hub') {
      fillColor = '#8B5CF6'; // Royal Violet
      haloColor = 'rgba(139, 92, 246, 0.40)';
    } else if (prominenceTier === 'frequent') {
      fillColor = '#06B6D4'; // Electric Cyan
      haloColor = 'rgba(6, 182, 212, 0.30)';
    } else if (prominenceTier === 'regular') {
      fillColor = '#10B981'; // Emerald
      haloColor = 'rgba(16, 185, 129, 0.20)';
    }

    const geojsonFeature: GeoJSONFeature = {
      type: 'Feature',
      id: place.placeId,
      geometry: {
        type: 'Point',
        coordinates: place.coordinates,
      },
      properties: {
        placeId: place.placeId,
        name: place.name,
        category: place.category,
        visitCount,
        markerRadiusPx,
        influenceRadiusMeters,
        scaleFactor,
        prominenceTier,
        importanceWeight,
        labelVisibilityZoom,
        circleColor: fillColor,
        haloColor,
        pulseAnimation,
      },
    };

    return {
      placeId: place.placeId,
      name: place.name,
      category: place.category,
      coordinates: place.coordinates,
      visitCount,
      scaleFactor,
      markerRadiusPx,
      influenceRadiusMeters,
      prominenceTier,
      importanceWeight,
      haloRadiusPx: markerRadiusPx + 10,
      labelVisibilityZoom,
      style: {
        fillColor,
        strokeColor: '#FFFFFF',
        haloColor,
        pulseAnimation,
      },
      geojsonFeature,
    };
  }

  // ============================================================================
  // ALGORITHM 2: MOST VISITED SPOTS ARE "SLOW LARGE"
  // ============================================================================

  /**
   * Computes dynamic footprint for visited spots where spots with high visits
   * AND slow movement (dwell points, lingering stops) grow "slow large".
   *
   * Formulated via:
   *   1. Slowness Factor: W_slow = 1 / (1 + (v / v_0)^1.8)
   *      - v = 0 km/h (stationary)  => W_slow = 1.00 (maximum boost)
   *      - v = 2 km/h (slow stroll) => W_slow = 0.88
   *      - v = 6 km/h (jog/transit) => W_slow = 0.50
   *      - v = 60 km/h (highway)    => W_slow = 0.015 (heavily suppressed)
   *
   *   2. Dwell Boost: D = (min(dwell, 300) / 15)^0.35
   *
   *   3. Combined Slow-Visit Weight:
   *      W_spot = ln(1 + visits) * (0.35 + 0.65 * W_slow) * (0.70 + 0.30 * min(D, 3.0))
   *
   *   4. "Slow-Growth" Attenuated Scaling:
   *      R_spot = R_min + (R_max - R_min) * (W_spot / W_cap)^gamma
   *      Produces progressive, smooth expansion ("slowly large").
   */
  public calculateSpotScale(spot: VisitedSpotRecord, options: SpotScalingOptions = {}): SpotScaleResult {
    const visitCount = Math.max(1, spot.visitCount || 1);
    const speed = Math.max(0, spot.avgSpeedKmH || 0);
    const dwell = Math.max(0, spot.totalDwellMinutes || 0);

    const minR = options.minRadiusPx ?? 10;
    const maxR = options.maxRadiusPx ?? 48;
    const minM = options.minRadiusMeters ?? 15;
    const maxM = options.maxRadiusMeters ?? 100;
    const v0 = options.slownessReferenceSpeed ?? 6.0; // 6 km/h pedestrian reference
    const weightCap = options.weightCap ?? 6.0;
    const gamma = options.curvatureGamma ?? 0.80;

    // 1. Compute Slowness Factor (smooth inverse sigmoidal curve)
    const slownessFactor = Math.round((1 / (1 + Math.pow(speed / v0, 1.8))) * 1000) / 1000;

    // 2. Compute Dwell Duration Boost
    const dwellBoost = dwell > 0
      ? Math.round(Math.pow(Math.min(dwell, 300) / 15, 0.35) * 100) / 100
      : 0.5;

    // 3. Composite Slow-Visit Weight
    const logVisits = Math.log(1 + visitCount);
    const slowMultiplier = 0.35 + 0.65 * slownessFactor;
    const dwellMultiplier = 0.70 + 0.30 * Math.min(dwellBoost, 3.0);
    const combinedWeight = Math.round(logVisits * slowMultiplier * dwellMultiplier * 100) / 100;

    // 4. Attenuated "Slow-Growth" Progressive Scaling
    const normWeight = Math.min(1.0, combinedWeight / weightCap);
    const growthCurve = Math.pow(normWeight, gamma);

    const spotRadiusPx = Math.round(minR + (maxR - minR) * growthCurve);
    const spotRadiusMeters = Math.round(minM + (maxM - minM) * growthCurve);
    const heatIntensity = Math.min(1.0, Math.round(normWeight * 100) / 100);

    // 5. Classification
    const isSlowLarge = slownessFactor >= 0.65 && visitCount >= 3;
    let growthClassification: SpotGrowthClassification = 'transit_corridor';

    if (isSlowLarge || (slownessFactor >= 0.60 && spotRadiusPx >= 24)) {
      growthClassification = 'slow_large_expanded';
    } else if (slownessFactor >= 0.35) {
      growthClassification = 'moderate_dwell';
    }

    const fillColor = isSlowLarge
      ? '#F59E0B' // Amber Gold for slow-large expanded stay hotspots
      : slownessFactor >= 0.35
      ? '#10B981' // Green for moderate dwell
      : '#64748B'; // Slate for fast transit corridors

    const geojsonFeature: GeoJSONFeature = {
      type: 'Feature',
      id: spot.spotId,
      geometry: {
        type: 'Point',
        coordinates: spot.coordinates,
      },
      properties: {
        spotId: spot.spotId,
        spotLabel: spot.spotLabel,
        visitCount,
        avgSpeedKmH: speed,
        totalDwellMinutes: dwell,
        slownessFactor,
        dwellBoost,
        combinedWeight,
        spotRadiusPx,
        spotRadiusMeters,
        heatIntensity,
        growthClassification,
        isSlowLarge,
        fillColor,
        growthCurveType: 'attenuated_logarithmic',
      },
    };

    return {
      spotId: spot.spotId,
      coordinates: spot.coordinates,
      visitCount,
      avgSpeedKmH: speed,
      totalDwellMinutes: dwell,
      slownessFactor,
      dwellBoost,
      combinedWeight,
      spotRadiusPx,
      spotRadiusMeters,
      heatIntensity,
      growthClassification,
      isSlowLarge,
      geojsonFeature,
    };
  }

  // ============================================================================
  // USER VISIT INGESTION & DATA MANAGEMENT
  // ============================================================================

  /**
   * Records a user location visit.
   * - If placeId is provided, updates or creates the visited place record.
   * - Automatically clusters coordinate into user's visited spots (<= 35m proximity)
   *   and updates rolling average speed and dwell time.
   */
  public async recordVisit(input: RecordVisitInput): Promise<{
    placeScale?: PlaceScaleResult;
    spotScale: SpotScaleResult;
  }> {
    const userId = input.userId || 'usr_default';
    const speed = Math.max(0, input.speedKmH ?? 1.5);
    const dwell = Math.max(0, input.dwellMinutes ?? 10);
    const nowIso = new Date().toISOString();

    let placeScale: PlaceScaleResult | undefined = undefined;

    // 1. Update Place record if placeId provided
    if (input.placeId) {
      let placeMap = this.userPlacesMap.get(userId);
      if (!placeMap) {
        placeMap = new Map<string, VisitedPlaceRecord>();
        this.userPlacesMap.set(userId, placeMap);
      }

      let existing = placeMap.get(input.placeId);
      if (existing) {
        existing.visitCount += 1;
        existing.totalDwellMinutes = (existing.totalDwellMinutes || 0) + dwell;
        existing.avgSpeedKmH = Math.round((((existing.avgSpeedKmH || speed) + speed) / 2) * 10) / 10;
        existing.lastVisitedAt = nowIso;
      } else {
        existing = {
          placeId: input.placeId,
          name: input.placeName || input.placeId,
          category: input.category || 'general_poi',
          coordinates: input.coordinates,
          visitCount: 1,
          totalDwellMinutes: dwell,
          avgSpeedKmH: speed,
          firstVisitedAt: nowIso,
          lastVisitedAt: nowIso,
        };
      }
      placeMap.set(input.placeId, existing);
      placeScale = this.calculatePlaceScale(existing);
    }

    // 2. Cluster coordinate into Visited Spots
    let spots = this.userSpotsMap.get(userId) || [];
    let matchedSpot = spots.find(
      (s) => calculateDistanceMeters(s.coordinates, input.coordinates) <= 35
    );

    if (matchedSpot) {
      matchedSpot.visitCount += 1;
      matchedSpot.totalDwellMinutes += dwell;
      // Rolling average speed
      matchedSpot.avgSpeedKmH = Math.round((((matchedSpot.avgSpeedKmH * (matchedSpot.visitCount - 1)) + speed) / matchedSpot.visitCount) * 10) / 10;
      matchedSpot.lastSeenAt = nowIso;
    } else {
      matchedSpot = {
        spotId: `spot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        coordinates: input.coordinates,
        visitCount: 1,
        totalDwellMinutes: dwell,
        avgSpeedKmH: speed,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        spotLabel: input.placeName ? `${input.placeName} Spot` : 'Custom Visited Spot',
      };
      spots.push(matchedSpot);
    }
    this.userSpotsMap.set(userId, spots);

    // 3. Persist asynchronously to MongoDB if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        if (input.placeId) {
          await UserVisitedPlaceModel.findOneAndUpdate(
            { userId, placeId: input.placeId },
            {
              userId,
              placeId: input.placeId,
              name: input.placeName || input.placeId,
              category: input.category || 'general_poi',
              location: { type: 'Point', coordinates: input.coordinates },
              $inc: { visitCount: 1, totalDwellMinutes: dwell },
              $set: { avgSpeedKmH: speed, lastVisitedAt: new Date() },
            },
            { upsert: true, new: true }
          );
        }

        await UserVisitedSpotModel.findOneAndUpdate(
          { userId, spotId: matchedSpot.spotId },
          {
            userId,
            spotId: matchedSpot.spotId,
            location: { type: 'Point', coordinates: matchedSpot.coordinates },
            visitCount: matchedSpot.visitCount,
            totalDwellMinutes: matchedSpot.totalDwellMinutes,
            avgSpeedKmH: matchedSpot.avgSpeedKmH,
            spotLabel: matchedSpot.spotLabel,
            lastSeenAt: new Date(),
          },
          { upsert: true, new: true }
        );
      } catch (err: any) {
        logger.debug(`Could not save user visited record to Mongo: ${err.message}`);
      }
    }

    const spotScale = this.calculateSpotScale(matchedSpot);
    return { placeScale, spotScale };
  }

  /**
   * Retrieves all visited places for a user, dynamically scaled so most visited are larger.
   */
  public async getUserVisitedPlaces(userId: string, options: PlaceScalingOptions = {}): Promise<PlaceScaleResult[]> {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const docs = await UserVisitedPlaceModel.find({ userId })
          .sort({ visitCount: -1 })
          .lean();
        if (docs.length > 0) {
          return docs.map((d: any) =>
            this.calculatePlaceScale(
              {
                placeId: d.placeId,
                name: d.name,
                category: d.category,
                coordinates: d.location.coordinates,
                visitCount: d.visitCount,
                totalDwellMinutes: d.totalDwellMinutes,
                avgSpeedKmH: d.avgSpeedKmH,
                tags: d.tags,
              },
              options
            )
          );
        }
      } catch (err: any) {
        logger.debug(`Could not read visited places from Mongo: ${err.message}`);
      }
    }

    const placeMap = this.userPlacesMap.get(userId);
    if (!placeMap || placeMap.size === 0) {
      // Fall back to demo user habits if user has no records yet
      const fallbackMap = this.userPlacesMap.get('usr_traveler_01') || new Map();
      return Array.from(fallbackMap.values())
        .map((p) => this.calculatePlaceScale(p, options))
        .sort((a, b) => b.visitCount - a.visitCount);
    }

    return Array.from(placeMap.values())
      .map((p) => this.calculatePlaceScale(p, options))
      .sort((a, b) => b.visitCount - a.visitCount);
  }

  /**
   * Retrieves all visited spots for a user, dynamically scaled with "slow large" algorithm.
   */
  public async getUserVisitedSpots(userId: string, options: SpotScalingOptions = {}): Promise<SpotScaleResult[]> {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const docs = await UserVisitedSpotModel.find({ userId })
          .sort({ visitCount: -1 })
          .lean();
        if (docs.length > 0) {
          return docs
            .map((d: any) =>
              this.calculateSpotScale(
                {
                  spotId: d.spotId,
                  coordinates: d.location.coordinates,
                  visitCount: d.visitCount,
                  totalDwellMinutes: d.totalDwellMinutes,
                  avgSpeedKmH: d.avgSpeedKmH,
                  spotLabel: d.spotLabel,
                },
                options
              )
            )
            .sort((a, b) => b.spotRadiusPx - a.spotRadiusPx);
        }
      } catch (err: any) {
        logger.debug(`Could not read visited spots from Mongo: ${err.message}`);
      }
    }

    let spots = this.userSpotsMap.get(userId);
    if (!spots || spots.length === 0) {
      spots = this.userSpotsMap.get('usr_traveler_01') || [];
    }

    return spots
      .map((s) => this.calculateSpotScale(s, options))
      .sort((a, b) => b.spotRadiusPx - a.spotRadiusPx);
  }

  /**
   * Generates a complete MapLibre/Mapbox-ready FeatureCollection payload
   * containing both dynamically scaled Places and "slow large" Spots.
   */
  public async getUserPersonalizedMapLayer(userId: string): Promise<PersonalizedMapLayerPayload> {
    const places = await this.getUserVisitedPlaces(userId);
    const spots = await this.getUserVisitedSpots(userId);

    const mostVisited = places.length > 0 ? places[0] : null;
    const largestSlowSpot = spots.find((s) => s.isSlowLarge) || (spots.length > 0 ? spots[0] : null);

    const avgSlowness = spots.length > 0
      ? Math.round((spots.reduce((sum, s) => sum + s.slownessFactor, 0) / spots.length) * 100) / 100
      : 0;

    return {
      userId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalPlaces: places.length,
        totalSpots: spots.length,
        mostVisitedPlace: mostVisited
          ? {
              placeId: mostVisited.placeId,
              name: mostVisited.name,
              visitCount: mostVisited.visitCount,
              markerRadiusPx: mostVisited.markerRadiusPx,
            }
          : null,
        largestSlowSpot: largestSlowSpot
          ? {
              spotId: largestSlowSpot.spotId,
              spotRadiusMeters: largestSlowSpot.spotRadiusMeters,
              visitCount: largestSlowSpot.visitCount,
              avgSpeedKmH: largestSlowSpot.avgSpeedKmH,
            }
          : null,
        averageSlownessFactor: avgSlowness,
      },
      placesLayer: {
        type: 'FeatureCollection',
        features: places.map((p) => p.geojsonFeature),
      },
      spotsLayer: {
        type: 'FeatureCollection',
        features: spots.map((s) => s.geojsonFeature),
      },
    };
  }

  /**
   * On-demand stateless batch calculator for client frontend simulation.
   */
  public evaluateBatch(
    places: VisitedPlaceRecord[] = [],
    spots: VisitedSpotRecord[] = [],
    placeOptions: PlaceScalingOptions = {},
    spotOptions: SpotScalingOptions = {}
  ): { places: PlaceScaleResult[]; spots: SpotScaleResult[] } {
    const scaledPlaces = places
      .map((p) => this.calculatePlaceScale(p, placeOptions))
      .sort((a, b) => b.visitCount - a.visitCount);

    const scaledSpots = spots
      .map((s) => this.calculateSpotScale(s, spotOptions))
      .sort((a, b) => b.spotRadiusPx - a.spotRadiusPx);

    return { places: scaledPlaces, spots: scaledSpots };
  }
}

export const visitedPlaceScalingService = new VisitedPlaceScalingService();

