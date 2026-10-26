import { logger } from '../../core/config/logger';
import { SRRoadModel } from './sr-lane-boundary.model';
import { Coordinate } from '../../core/types/geo.types';
import { LaneTurnDirection, LaneType } from '../../types/lane-routing.types';
import {
  SRJunctionCard,
  SRLateralOffsetState,
  SRNavigationHUDState,
  SRPerceptionObject,
  SRRoadSurfaceMarking,
  SRBoundaryType,
  SRLaneBoundary,
} from './sr-navigation.types';
import { calculateBearing, calculateDistanceMeters } from '../../core/utils/geo.utils';

export class SRNavigationService {
  private inMemorySRRoads = new Map<string, any>();

  constructor() {
    this.seedDefaultSRModels();
  }

  /**
   * Seeds demo HD SR Road Models (Complex 4-Lane Arterial with 3D boundaries & 3D Junction Card)
   */
  private seedDefaultSRModels() {
    const demoSRArterial = {
      segmentId: 'sr_delhi_cp_inner',
      roadName: 'Connaught Circus Outer Ring Corridor (Barakhamba to Janpath)',
      boundaries: [
        {
          boundaryIndex: 0,
          boundaryType: 'double_solid_yellow' as SRBoundaryType,
          color: 'yellow' as const,
          coordinates: [
            [77.2180, 28.6320],
            [77.2240, 28.6335],
          ],
        },
        {
          boundaryIndex: 1,
          boundaryType: 'dashed_white' as SRBoundaryType,
          color: 'white' as const,
          coordinates: [
            [77.21802, 28.63202],
            [77.22402, 28.63352],
          ],
        },
        {
          boundaryIndex: 2,
          boundaryType: 'dashed_white' as SRBoundaryType,
          color: 'white' as const,
          coordinates: [
            [77.21804, 28.63204],
            [77.22404, 28.63354],
          ],
        },
        {
          boundaryIndex: 3,
          boundaryType: 'solid_white' as SRBoundaryType,
          color: 'white' as const,
          coordinates: [
            [77.21806, 28.63206],
            [77.22406, 28.63356],
          ],
        },
      ],
      markings: [
        {
          markingType: 'left_turn_arrow' as const,
          laneIndex: 0,
          location: [77.2210, 28.6328] as Coordinate,
          label: 'Turn Left Only',
        },
        {
          markingType: 'straight_arrow' as const,
          laneIndex: 1,
          location: [77.2210, 28.6328] as Coordinate,
          label: 'Straight',
        },
        {
          markingType: 'straight_arrow' as const,
          laneIndex: 2,
          location: [77.2210, 28.6328] as Coordinate,
          label: 'Straight',
        },
        {
          markingType: 'right_turn_arrow' as const,
          laneIndex: 3,
          location: [77.2210, 28.6328] as Coordinate,
          label: 'Turn Right Only',
        },
        {
          markingType: 'crosswalk' as const,
          laneIndex: 1,
          location: [77.2238, 28.6334] as Coordinate,
          label: 'Pedestrian Crossing',
        },
      ],
      junctionCard: {
        junctionId: 'junc_barakhamba_radial',
        junctionName: 'Barakhamba Road Radial 1 & Connaught Circus Interchange Fork',
        junctionType: 'complex_crossroad' as const,
        distanceMeters: 280,
        highlightedLaneIndices: [0],
        allLanes: [
          {
            laneIndex: 0,
            turnDirection: 'left' as LaneTurnDirection,
            isHighlighted: true,
            overheadSignText: 'Rajiv Chowk Metro / Palika Bazaar',
          },
          {
            laneIndex: 1,
            turnDirection: 'straight' as LaneTurnDirection,
            isHighlighted: false,
            overheadSignText: 'Outer Circle / Shivaji Stadium',
          },
          {
            laneIndex: 2,
            turnDirection: 'straight' as LaneTurnDirection,
            isHighlighted: false,
            overheadSignText: 'Mandi House / India Gate',
          },
          {
            laneIndex: 3,
            turnDirection: 'right' as LaneTurnDirection,
            isHighlighted: false,
            overheadSignText: 'Tolstoy Marg / Janpath',
          },
        ],
        overheadGantry: {
          signText: 'RADIAL 1: Connaught Circus / New Delhi Railway Station',
          destinationCities: ['New Delhi Railway Station', 'Barakhamba Road'],
          routeShields: ['ND-1', 'CP-Inner'],
        },
        schematicSvgOrModelKey: 'svg_fork_4lane_split_left',
      },
    };

    this.inMemorySRRoads.set(demoSRArterial.segmentId, demoSRArterial);
  }

  /**
   * Registers a new HD SR Road Model
   */
  async registerSRRoadModel(model: {
    segmentId: string;
    roadName: string;
    boundaries: SRLaneBoundary[];
    markings: SRRoadSurfaceMarking[];
    junctionCard?: SRJunctionCard;
  }) {
    this.inMemorySRRoads.set(model.segmentId, model);
    try {
      await SRRoadModel.findOneAndUpdate(
        { segmentId: model.segmentId },
        { ...model },
        { upsert: true, new: true }
      );
    } catch (err: any) {
      logger.warn(`Could not persist SRRoadModel to Mongo (using in-memory): ${err.message}`);
    }
    return model;
  }

  /**
   * Retrieves an SR Road Model by ID
   */
  async getSRRoadModel(segmentId: string) {
    let road = this.inMemorySRRoads.get(segmentId);
    if (!road) {
      try {
        road = await SRRoadModel.findOne({ segmentId }).lean();
      } catch (e) {
        // fallback to memory
      }
    }
    return road;
  }

  /**
   * Computes sub-meter lateral offset, lane matching, drift detection,
   * surrounding vehicle collision warnings, and 3D Junction Card guidance
   */
  async computeSRHUDState(params: {
    coordinates: Coordinate;
    speedKmh?: number;
    speedLimitKmh?: number;
    lateralOffsetMeters?: number; // Measured from GNSS/Vision, -0.2m = 20cm left
    currentLaneIndex?: number;
    nextTurnDirection?: LaneTurnDirection;
    distanceToTurnMeters?: number;
    blinkerState?: 'NONE' | 'LEFT' | 'RIGHT';
    surroundingObjects?: SRPerceptionObject[];
  }): Promise<SRNavigationHUDState> {
    const speed = params.speedKmh ?? 52;
    const speedLimit = params.speedLimitKmh ?? 50;
    const road = this.inMemorySRRoads.get('sr_delhi_cp_inner') || Array.from(this.inMemorySRRoads.values())[0];

    const totalLanes = 4;
    const laneWidth = 3.75;
    let currentLane = params.currentLaneIndex ?? 1; // Default to lane 1 (straight)

    // Sub-meter lateral offset calculation (positive = right of center, negative = left of center)
    const offsetFromCenter = params.lateralOffsetMeters ?? 0.15;
    const distToLeft = Math.max(0, (laneWidth / 2) + offsetFromCenter);
    const distToRight = Math.max(0, (laneWidth / 2) - offsetFromCenter);

    // Lane Departure Warning (LDW) Detection
    const isApproachingLeft = distToLeft < 0.50;
    const isApproachingRight = distToRight < 0.50;
    const blinker = params.blinkerState || 'NONE';

    let isDeparting = false;
    let departureDir: 'left' | 'right' | undefined;
    let departureWarning = false;

    if (isApproachingLeft) {
      isDeparting = true;
      departureDir = 'left';
      if (blinker !== 'LEFT') departureWarning = true;
    } else if (isApproachingRight) {
      isDeparting = true;
      departureDir = 'right';
      if (blinker !== 'RIGHT') departureWarning = true;
    }

    const lateralState: SRLateralOffsetState = {
      matchedLaneIndex: currentLane,
      lateralOffsetFromCenterMeters: Math.round(offsetFromCenter * 100) / 100,
      distanceToLeftBoundaryMeters: Math.round(distToLeft * 100) / 100,
      distanceToRightBoundaryMeters: Math.round(distToRight * 100) / 100,
      laneWidthMeters: laneWidth,
      isDepartingLane: isDeparting,
      departureDirection: departureDir,
      departureWarning,
    };

    // Surrounding Perception Fusion & Collision Detection
    const objects = params.surroundingObjects ?? [
      {
        id: 'obj_car_lead',
        classification: 'car' as const,
        relativePosition: { lateralMeters: 0.1, longitudinalMeters: 22 },
        speedKmh: 48,
        relativeSpeedKmh: -4,
        laneIndex: currentLane,
      },
      {
        id: 'obj_truck_right',
        classification: 'truck' as const,
        relativePosition: { lateralMeters: 3.6, longitudinalMeters: 12 },
        speedKmh: 45,
        relativeSpeedKmh: -7,
        laneIndex: currentLane + 1,
      },
    ];

    let forwardCollisionWarning = false;
    const processedObjects: SRPerceptionObject[] = objects.map((obj) => {
      let isCutIn = false;
      let ttc: number | undefined;

      // Check if vehicle is in same lane or cutting in
      if (Math.abs(obj.relativePosition.lateralMeters) < 1.4 && obj.relativePosition.longitudinalMeters > 0) {
        if (obj.relativeSpeedKmh < 0) {
          const closingSpeedMps = Math.abs(obj.relativeSpeedKmh) * (1000 / 3600);
          ttc = Math.round((obj.relativePosition.longitudinalMeters / closingSpeedMps) * 10) / 10;
          if (ttc < 2.8) {
            forwardCollisionWarning = true;
          }
        }
      }

      // Cut-in detection
      if (
        Math.abs(obj.relativePosition.lateralMeters) > 1.8 &&
        Math.abs(obj.relativePosition.lateralMeters) < 3.2 &&
        obj.relativePosition.longitudinalMeters > 0 &&
        obj.relativePosition.longitudinalMeters < 20
      ) {
        isCutIn = true;
      }

      return {
        ...obj,
        isCutIn,
        timeToCollisionSeconds: ttc,
      };
    });

    // Lane Guidance & Active Maneuver
    const turnDirection = params.nextTurnDirection || 'left';
    const distToTurn = params.distanceToTurnMeters ?? 280;
    const targetLane: number = turnDirection === 'left' ? 0 : turnDirection === 'right' ? 3 : 1;

    let urgency: 'none' | 'prepare' | 'execute' | 'critical' = 'none';
    if (distToTurn < 100) urgency = 'critical';
    else if (distToTurn < 300) urgency = 'execute';
    else if (distToTurn < 800) urgency = 'prepare';

    let laneManeuverPrompt;
    if (currentLane !== targetLane) {
      const diff = targetLane - currentLane;
      const directionWord = diff < 0 ? 'left' : 'right';
      const lanesToChange = Math.abs(diff);

      laneManeuverPrompt = {
        targetLaneIndex: targetLane,
        distanceMeters: distToTurn,
        voiceText: `In ${distToTurn} meters, turn ${turnDirection}. Please move ${lanesToChange} lane${
          lanesToChange > 1 ? 's' : ''
        } to the ${directionWord}.`,
        hudVisualPrompt: diff < 0 ? `<< Move Left (Lane ${targetLane})` : `Move Right >> (Lane ${targetLane})`,
      };
    }

    const activeLanes: SRNavigationHUDState['activeLanes'] = [
      {
        laneIndex: 0,
        type: 'normal',
        direction: 'left',
        isOptimal: targetLane === 0,
        statusText: targetLane === 0 ? 'Optimal' : 'Left turn only',
      },
      {
        laneIndex: 1,
        type: 'normal',
        direction: 'straight',
        isOptimal: targetLane === 1,
        statusText: targetLane === 1 ? 'Optimal' : 'Straight only',
      },
      {
        laneIndex: 2,
        type: 'normal',
        direction: 'straight',
        isOptimal: targetLane === 2,
        statusText: 'Straight only',
      },
      {
        laneIndex: 3,
        type: 'normal',
        direction: 'right',
        isOptimal: targetLane === 3,
        statusText: targetLane === 3 ? 'Optimal' : 'Right turn only',
      },
    ];

    return {
      timestamp: Date.now(),
      currentRoad: road ? road.roadName : 'Connaught Circus Outer Ring Corridor',
      speedKmh: speed,
      speedLimitKmh: speedLimit,
      lateralOffset: lateralState,
      activeLanes,
      recommendedLaneIndex: targetLane,
      laneChangeUrgency: urgency,
      laneChangeManeuver: laneManeuverPrompt,
      surroundingObjects: processedObjects,
      forwardCollisionWarning,
      activeJunctionCard: road?.junctionCard,
    };
  }
}

export const srNavigationService = new SRNavigationService();
export const srNavigationEngineService = srNavigationService;

