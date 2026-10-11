import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { ILaneSegmentDocument, LaneSegmentModel } from './lane-network.model';
import { Coordinate } from '../../core/types/geo.types';
import {
  LaneChangePrompt,
  LaneDetail,
  LaneLevelGuidance,
  LaneSegment,
  LaneStatus,
  LaneTurnDirection,
} from './lane-routing.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';

export class LaneRoutingService {
  private inMemorySegments = new Map<string, LaneSegment>();

  constructor() {
    this.seedDefaultSegments();
  }

  /**
   * Seeds demo/standard lane configurations (e.g. 4-lane urban arterial and 6-lane highway)
   */
  private seedDefaultSegments() {
    // 4-Lane Primary Road approaching intersection (Left turn, Straight, Straight, Right turn)
    const demoArterial: LaneSegment = {
      segmentId: 'seg_kudamm_intersection',
      roadName: 'Kurfürstendamm Arterial',
      roadClass: 'primary',
      totalLanes: 4,
      lengthMeters: 450,
      geometry: {
        type: 'LineString',
        coordinates: [
          [13.32, 52.502],
          [13.325, 52.503],
        ],
      },
      lanes: [
        {
          laneIndex: 0,
          turnDirection: 'left',
          laneType: 'normal',
          widthMeters: 3.5,
          speedLimitKmh: 50,
        },
        {
          laneIndex: 1,
          turnDirection: 'straight',
          laneType: 'normal',
          widthMeters: 3.5,
          speedLimitKmh: 50,
        },
        {
          laneIndex: 2,
          turnDirection: 'straight',
          laneType: 'normal',
          widthMeters: 3.5,
          speedLimitKmh: 50,
        },
        {
          laneIndex: 3,
          turnDirection: 'right',
          laneType: 'bus_only',
          widthMeters: 3.5,
          speedLimitKmh: 50,
          restrictions: [
            {
              startHour: 7,
              endHour: 9,
              daysOfWeek: [1, 2, 3, 4, 5],
              allowedVehicleTypes: ['bus', 'taxi'],
            },
            {
              startHour: 16,
              endHour: 19,
              daysOfWeek: [1, 2, 3, 4, 5],
              allowedVehicleTypes: ['bus', 'taxi'],
            },
          ],
        },
      ],
    };

    this.inMemorySegments.set(demoArterial.segmentId, demoArterial);
  }

  /**
   * Checks whether a lane's time-based restriction is active right now
   */
  isRestrictionActive(lane: LaneDetail, now: Date = new Date()): { active: boolean; reason?: string } {
    if (!lane.restrictions || lane.restrictions.length === 0) {
      return { active: false };
    }

    const currentHour = now.getHours();
    const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon..7=Sun

    for (const r of lane.restrictions) {
      const dayMatches = r.daysOfWeek.includes(currentDay);
      const hourMatches = currentHour >= r.startHour && currentHour < r.endHour;

      if (dayMatches && hourMatches) {
        return {
          active: true,
          reason: `Bus/HOV restriction active between ${r.startHour}:00 and ${r.endHour}:00`,
        };
      }
    }

    return { active: false };
  }

  /**
   * Computes Lane-Level Guidance and optimal lane recommendations
   */
  async computeLaneGuidance(params: {
    roadName?: string;
    currentCoordinates?: Coordinate;
    currentLaneIndex?: number;
    distanceToNextTurnMeters: number;
    nextManeuverDirection: LaneTurnDirection;
    currentSpeedMps?: number;
    timestamp?: number;
  }): Promise<LaneLevelGuidance> {
    const now = new Date(params.timestamp || Date.now());
    let segment = this.findMatchingSegment(params.roadName, params.currentCoordinates);

    // Fallback: Synthesize standard multi-lane layout if segment is not explicitly registered in HD database
    if (!segment) {
      segment = this.synthesizeDefaultSegment(params.roadName || 'Main Arterial', params.nextManeuverDirection);
    }

    const recommendedLanes: number[] = [];
    const evaluatedLanes = segment.lanes.map((lane) => {
      const restriction = this.isRestrictionActive(lane, now);

      if (restriction.active) {
        return {
          laneIndex: lane.laneIndex,
          turnDirection: lane.turnDirection,
          laneType: lane.laneType,
          status: 'forbidden' as LaneStatus,
          reason: restriction.reason,
        };
      }

      // Check maneuver compatibility
      const isDirectMatch =
        lane.turnDirection === params.nextManeuverDirection ||
        (params.nextManeuverDirection === 'left' && lane.turnDirection === 'left_straight') ||
        (params.nextManeuverDirection === 'right' && lane.turnDirection === 'right_straight') ||
        (params.nextManeuverDirection === 'straight' && (lane.turnDirection === 'left_straight' || lane.turnDirection === 'right_straight'));

      if (isDirectMatch) {
        recommendedLanes.push(lane.laneIndex);
        return {
          laneIndex: lane.laneIndex,
          turnDirection: lane.turnDirection,
          laneType: lane.laneType,
          status: 'optimal' as LaneStatus,
          reason: 'Direct lane for upcoming turn',
        };
      } else {
        return {
          laneIndex: lane.laneIndex,
          turnDirection: lane.turnDirection,
          laneType: lane.laneType,
          status: 'suboptimal' as LaneStatus,
          reason: `Must change lane before ${params.nextManeuverDirection} turn`,
        };
      }
    });

    // Compute Lane Change Prompt if vehicle is in a known lane
    let prompt: LaneChangePrompt | undefined;
    const currentLane = params.currentLaneIndex;

    if (currentLane !== undefined && recommendedLanes.length > 0) {
      const isInRecommended = recommendedLanes.includes(currentLane);

      if (!isInRecommended) {
        // Find closest target lane
        const closestTarget = recommendedLanes.reduce((prev, curr) =>
          Math.abs(curr - currentLane) < Math.abs(prev - currentLane) ? curr : prev
        );

        const lanesToCross = Math.abs(closestTarget - currentLane);
        const directionWord = closestTarget < currentLane ? 'left' : 'right';
        const dist = params.distanceToNextTurnMeters;

        // Required distance per lane shift is ~150 meters at speed
        const speedKmh = (params.currentSpeedMps ?? 14) * 3.6;
        const requiredMeters = lanesToCross * (speedKmh > 60 ? 200 : 120);

        let urgency: 'early_notice' | 'recommended' | 'urgent' | 'critical' = 'recommended';
        if (dist > requiredMeters * 2) urgency = 'early_notice';
        else if (dist > requiredMeters) urgency = 'recommended';
        else if (dist > 80) urgency = 'urgent';
        else urgency = 'critical';

        prompt = {
          fromLaneIndex: currentLane,
          targetLaneIndex: closestTarget,
          distanceToManeuverMeters: dist,
          recommendedChangeStartMeters: Math.round(requiredMeters),
          urgency,
          instructionText: `Shift ${lanesToCross} lane${lanesToCross > 1 ? 's' : ''} to the ${directionWord} for upcoming ${params.nextManeuverDirection} turn`,
        };
      }
    }

    return {
      currentRoadName: segment.roadName,
      currentLaneIndex: params.currentLaneIndex,
      totalLanes: segment.totalLanes,
      lanes: evaluatedLanes,
      recommendedLanes,
      prompt,
      distanceToNextTurnMeters: params.distanceToNextTurnMeters,
      nextManeuverDirection: params.nextManeuverDirection,
    };
  }

  /**
   * Finds matching segment from memory or MongoDB
   */
  private findMatchingSegment(roadName?: string, _coord?: Coordinate): LaneSegment | null {
    if (roadName) {
      for (const seg of this.inMemorySegments.values()) {
        if (seg.roadName.toLowerCase().includes(roadName.toLowerCase())) {
          return seg;
        }
      }
    }
    return null;
  }

  /**
   * Synthesizes standard realistic lane configurations on the fly
   */
  private synthesizeDefaultSegment(roadName: string, upcomingTurn: LaneTurnDirection): LaneSegment {
    const totalLanes = 3;
    const lanes: LaneDetail[] = [
      {
        laneIndex: 0,
        turnDirection: 'left',
        laneType: 'normal',
        widthMeters: 3.5,
        speedLimitKmh: 50,
      },
      {
        laneIndex: 1,
        turnDirection: 'straight',
        laneType: 'normal',
        widthMeters: 3.5,
        speedLimitKmh: 50,
      },
      {
        laneIndex: 2,
        turnDirection: upcomingTurn === 'right' ? 'right' : 'straight',
        laneType: 'normal',
        widthMeters: 3.5,
        speedLimitKmh: 50,
      },
    ];

    return {
      segmentId: `synth_${roadName}`,
      roadName,
      roadClass: 'primary',
      totalLanes,
      lanes,
      geometry: { type: 'LineString', coordinates: [] },
      lengthMeters: 500,
    };
  }

  /**
   * Registers an HD Lane Segment in the database
   */
  async registerLaneSegment(segment: LaneSegment): Promise<any> {
    this.inMemorySegments.set(segment.segmentId, segment);

    if (mongoose.connection.readyState === 1) {
      try {
        return await LaneSegmentModel.findOneAndUpdate(
          { segmentId: segment.segmentId },
          segment,
          { upsert: true, returnDocument: 'after' }
        );
      } catch (err: any) {
        logger.warn(`Failed persisting LaneSegment to MongoDB: ${err.message}`);
      }
    }
    return segment;
  }
}

export const laneRoutingService = new LaneRoutingService();
