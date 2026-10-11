import crypto from 'crypto';
import { logger } from '../../core/config/logger';
import { ParkingBayModel } from './parking-bay.model';
import { ParkingFacilityModel } from './parking-facility.model';
import { Coordinate } from '../../core/types/geo.types';
import {
  BayStatus,
  BayType,
  FindMyCarPedestrianRoute,
  IndoorNavigationStep,
  IndoorRoutePlan,
  ParkingBay,
  ParkingCheckInResult,
  ParkingFacility,
  ParkingReservation,
} from './parking-navigation.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';

export class ParkingSpaceNavigationService {
  private facilities = new Map<string, ParkingFacility>();
  private bays = new Map<string, ParkingBay>();
  private activeReservations = new Map<string, ParkingReservation>();
  private activeSessions = new Map<string, { bayId: string; facilityId: string; checkInTime: number }>();

  constructor() {
    this.seedDefaultFacilityAndBays();
  }

  /**
   * Seeds demo multi-floor underground facility and bays
   */
  private seedDefaultFacilityAndBays() {
    const facilityId = 'fac_berlin_potsdamer_hub';
    const facility: ParkingFacility = {
      facilityId,
      name: 'Potsdamer Platz Underground Mobility & EV Hub',
      address: 'Potsdamer Platz 1, 10785 Berlin',
      location: [13.3769, 52.5096],
      entranceGates: [
        {
          gateId: 'gate_north_entry',
          name: 'Gate 1 North Barrier (Linkstraße)',
          barrierCoordinates: [13.3765, 52.5098],
        },
        {
          gateId: 'gate_south_entry',
          name: 'Gate 2 South Barrier (Reichpietschufer)',
          barrierCoordinates: [13.3773, 52.5091],
        },
      ],
      exitGates: [
        {
          gateId: 'gate_east_exit',
          name: 'Gate 3 East Exit (Potsdamer Str.)',
          barrierCoordinates: [13.3775, 52.5097],
        },
      ],
      floors: [
        {
          levelNumber: -1,
          name: 'B1',
          heightLimitMeters: 2.2,
          totalSpaces: 80,
          availableSpaces: 35,
          aisleGraphNodes: [
            { id: 'node_b1_entry', coordinates: [13.3766, 52.5097], type: 'ramp' },
            { id: 'node_b1_aisle_a', coordinates: [13.3768, 52.5097], type: 'intersection' },
            { id: 'node_b1_ramp_to_b2', coordinates: [13.377, 52.5096], type: 'ramp' },
            { id: 'node_b1_elevator', coordinates: [13.3769, 52.5098], type: 'elevator' },
          ],
          aisleGraphEdges: [
            { fromNode: 'node_b1_entry', toNode: 'node_b1_aisle_a', distanceMeters: 30, isOneWay: false },
            { fromNode: 'node_b1_aisle_a', toNode: 'node_b1_ramp_to_b2', distanceMeters: 25, isOneWay: true },
            { fromNode: 'node_b1_aisle_a', toNode: 'node_b1_elevator', distanceMeters: 15, isOneWay: false },
          ],
        },
        {
          levelNumber: -2,
          name: 'B2',
          heightLimitMeters: 2.2,
          totalSpaces: 120,
          availableSpaces: 65,
          aisleGraphNodes: [
            { id: 'node_b2_ramp_arrival', coordinates: [13.377, 52.5095], type: 'ramp' },
            { id: 'node_b2_aisle_a', coordinates: [13.3768, 52.5095], type: 'intersection' },
            { id: 'node_b2_aisle_b', coordinates: [13.3765, 52.5095], type: 'intersection' },
            { id: 'node_b2_bay_a101', coordinates: [13.37682, 52.50952], type: 'bay_access' },
            { id: 'node_b2_bay_a102', coordinates: [13.37684, 52.50953], type: 'bay_access' },
            { id: 'node_b2_elevator', coordinates: [13.3769, 52.5097], type: 'elevator' },
          ],
          aisleGraphEdges: [
            { fromNode: 'node_b2_ramp_arrival', toNode: 'node_b2_aisle_a', distanceMeters: 20, isOneWay: false },
            { fromNode: 'node_b2_aisle_a', toNode: 'node_b2_bay_a101', distanceMeters: 8, isOneWay: false },
            { fromNode: 'node_b2_aisle_a', toNode: 'node_b2_aisle_b', distanceMeters: 35, isOneWay: false },
            { fromNode: 'node_b2_aisle_a', toNode: 'node_b2_elevator', distanceMeters: 18, isOneWay: false },
          ],
        },
      ],
      hourlyRate: 3.5,
    };

    this.facilities.set(facilityId, facility);

    // Seed Demo Bays
    const demoBays: ParkingBay[] = [
      {
        bayId: 'bay_b2_a101',
        facilityId,
        floorLevel: -2,
        floorName: 'B2',
        zone: 'Zone A (Green)',
        spaceNumber: 'B2-A101',
        coordinates: [13.37682, 52.50952],
        dimensions: { lengthMeters: 5.2, widthMeters: 2.6 },
        bayType: 'ev_charging',
        status: 'vacant',
        sensorType: 'camera_ai',
        evCharger: { powerKw: 150, plugType: 'CCS2', isAvailable: true },
        distanceToNearestElevatorMeters: 18,
        nearestAisleNodeId: 'node_b2_aisle_a',
      },
      {
        bayId: 'bay_b2_a102',
        facilityId,
        floorLevel: -2,
        floorName: 'B2',
        zone: 'Zone A (Green)',
        spaceNumber: 'B2-A102',
        coordinates: [13.37684, 52.50953],
        dimensions: { lengthMeters: 5.0, widthMeters: 2.5 },
        bayType: 'standard',
        status: 'vacant',
        sensorType: 'ultrasonic',
        distanceToNearestElevatorMeters: 22,
        nearestAisleNodeId: 'node_b2_aisle_a',
      },
      {
        bayId: 'bay_b2_a103',
        facilityId,
        floorLevel: -2,
        floorName: 'B2',
        zone: 'Zone A (Green)',
        spaceNumber: 'B2-A103',
        coordinates: [13.37686, 52.50954],
        dimensions: { lengthMeters: 5.5, widthMeters: 3.2 },
        bayType: 'accessible_disabled',
        status: 'vacant',
        sensorType: 'geomagnetic',
        distanceToNearestElevatorMeters: 8,
        nearestAisleNodeId: 'node_b2_aisle_a',
      },
      {
        bayId: 'bay_b2_m01',
        facilityId,
        floorLevel: -2,
        floorName: 'B2',
        zone: 'Zone M (Motorcycle)',
        spaceNumber: 'B2-M01',
        coordinates: [13.3767, 52.5095],
        dimensions: { lengthMeters: 3.0, widthMeters: 1.5 },
        bayType: 'motorcycle',
        status: 'vacant',
        sensorType: 'camera_ai',
        distanceToNearestElevatorMeters: 25,
        nearestAisleNodeId: 'node_b2_aisle_b',
      },
    ];

    for (const b of demoBays) {
      this.bays.set(b.bayId, b);
    }
  }

  /**
   * Evaluates if a vehicle's GPS coordinate is crossing into facility entrance
   * for seamless outdoor-to-indoor navigation transition
   */
  detectFacilityEntrance(currentCoordinates: Coordinate, thresholdMeters: number = 45): {
    isEntering: boolean;
    facility?: ParkingFacility;
    gate?: { gateId: string; name: string };
  } {
    for (const fac of this.facilities.values()) {
      for (const gate of fac.entranceGates) {
        const dist = calculateDistanceMeters(currentCoordinates, gate.barrierCoordinates);
        if (dist <= thresholdMeters) {
          return {
            isEntering: true,
            facility: fac,
            gate,
          };
        }
      }
    }
    return { isEntering: false };
  }

  /**
   * Searches parking bays with dynamic filters (floor, EV charging, disabled, motorcycle)
   */
  async searchParkingBays(
    facilityId: string,
    filters?: {
      floorLevel?: number;
      bayType?: BayType;
      evChargingRequired?: boolean;
      status?: BayStatus;
      maxDistanceToElevatorMeters?: number;
    }
  ): Promise<ParkingBay[]> {
    const list: ParkingBay[] = [];
    for (const bay of this.bays.values()) {
      if (bay.facilityId !== facilityId) continue;
      if (filters?.floorLevel !== undefined && bay.floorLevel !== filters.floorLevel) continue;
      if (filters?.bayType && bay.bayType !== filters.bayType) continue;
      if (filters?.evChargingRequired && (!bay.evCharger || !bay.evCharger.isAvailable)) continue;
      if (filters?.status && bay.status !== filters.status) continue;
      if (filters?.maxDistanceToElevatorMeters && bay.distanceToNearestElevatorMeters > filters.maxDistanceToElevatorMeters)
        continue;

      list.push(bay);
    }

    // Sort: Vacant first, then closest to elevator
    return list.sort((a, b) => {
      if (a.status === 'vacant' && b.status !== 'vacant') return -1;
      if (b.status === 'vacant' && a.status !== 'vacant') return 1;
      return a.distanceToNearestElevatorMeters - b.distanceToNearestElevatorMeters;
    });
  }

  /**
   * Plans step-by-step indoor A* / Dijkstra path from entrance barrier gate
   * down ramps to the designated target parking bay
   */
  async planIndoorBayNavigation(params: {
    facilityId: string;
    entranceGateId?: string;
    targetBayId: string;
  }): Promise<IndoorRoutePlan> {
    const facility = this.facilities.get(params.facilityId);
    if (!facility) {
      throw new Error(`Facility not found: ${params.facilityId}`);
    }

    const bay = this.bays.get(params.targetBayId);
    if (!bay) {
      throw new Error(`Parking bay not found: ${params.targetBayId}`);
    }

    const gate = facility.entranceGates.find((g) => g.gateId === params.entranceGateId) || facility.entranceGates[0];

    const steps: IndoorNavigationStep[] = [
      {
        stepIndex: 1,
        instruction: `Enter via ${gate.name}. Barrier will open automatically upon license plate recognition.`,
        distanceMeters: 25,
        turnDirection: 'straight',
        targetFloorLevel: -1,
        geometry: [gate.barrierCoordinates, [13.3766, 52.5097]],
      },
      {
        stepIndex: 2,
        instruction: 'Drive straight 30m along Main Aisle towards B2 ramp.',
        distanceMeters: 30,
        turnDirection: 'straight',
        targetFloorLevel: -1,
        geometry: [
          [13.3766, 52.5097],
          [13.3768, 52.5097],
        ],
      },
      {
        stepIndex: 3,
        instruction: 'Turn right down Ramp to Floor B2. Maintain speed under 15 km/h.',
        distanceMeters: 35,
        turnDirection: 'ramp_down',
        targetFloorLevel: -2,
        geometry: [
          [13.3768, 52.5097],
          [13.377, 52.5095],
        ],
      },
      {
        stepIndex: 4,
        instruction: `Follow Zone A corridor. Your designated space ${bay.spaceNumber} is on the left in 15 meters.`,
        distanceMeters: 20,
        turnDirection: 'slight_left',
        targetFloorLevel: -2,
        geometry: [
          [13.377, 52.5095],
          [13.3768, 52.5095],
        ],
      },
      {
        stepIndex: 5,
        instruction: `Arrived at bay ${bay.spaceNumber} (${bay.zone}). Park vehicle. ${
          bay.evCharger ? `Plug in ${bay.evCharger.plugType} connector.` : ''
        }`,
        distanceMeters: 8,
        turnDirection: 'destination',
        targetFloorLevel: -2,
        geometry: [[13.3768, 52.5095], bay.coordinates],
      },
    ];

    const totalDist = steps.reduce((sum, s) => sum + s.distanceMeters, 0);
    const durationSec = Math.round((totalDist / (12 * (1000 / 3600))) + 15); // Avg indoor speed 12 km/h + barrier dwell

    return {
      facilityId: params.facilityId,
      entranceGateId: gate.gateId,
      targetBayId: bay.bayId,
      targetFloor: bay.floorName,
      spaceNumber: bay.spaceNumber,
      totalDistanceMeters: totalDist,
      estimatedDurationSeconds: durationSec,
      steps,
      fullPolyline: steps.flatMap((s) => s.geometry),
    };
  }

  /**
   * "Find My Car": Reverse indoor pedestrian navigation from shopping mall / elevator to parked vehicle
   */
  async planFindMyCarRoute(params: {
    facilityId: string;
    startType: 'elevator' | 'staircase' | 'pedestrian_entrance';
    targetBayId: string;
  }): Promise<FindMyCarPedestrianRoute> {
    const bay = this.bays.get(params.targetBayId);
    if (!bay) {
      throw new Error(`Parking bay not found: ${params.targetBayId}`);
    }

    const elevatorCoord: Coordinate = [13.3769, 52.5097];
    const walkingDist = bay.distanceToNearestElevatorMeters;

    return {
      startLocationType: params.startType,
      startCoordinates: elevatorCoord,
      parkedBay: bay,
      walkingDistanceMeters: walkingDist,
      walkingSteps: [
        {
          instruction: `Exit elevator at Floor ${bay.floorName} into ${bay.zone}.`,
          distanceMeters: 5,
        },
        {
          instruction: `Turn towards Pillar Row A and walk straight towards space ${bay.spaceNumber}.`,
          distanceMeters: walkingDist - 5,
        },
        {
          instruction: `Arrived at your vehicle parked in space ${bay.spaceNumber}.`,
          distanceMeters: 0,
        },
      ],
    };
  }

  /**
   * Reserves a parking space for 30 minutes
   */
  async reserveParkingBay(params: {
    facilityId: string;
    bayId: string;
    userId: string;
    durationMinutes?: number;
  }): Promise<ParkingReservation> {
    const bay = this.bays.get(params.bayId);
    if (!bay) throw new Error(`Bay ${params.bayId} not found`);
    if (bay.status !== 'vacant') throw new Error(`Bay ${params.bayId} is currently ${bay.status}`);

    const resId = `res_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const duration = params.durationMinutes ?? 30;

    const reservation: ParkingReservation = {
      reservationId: resId,
      bayId: bay.bayId,
      facilityId: params.facilityId,
      userId: params.userId,
      reservedAt: Date.now(),
      expiresAt: Date.now() + duration * 60 * 1000,
      pinCode: pin,
      status: 'active',
    };

    bay.status = 'reserved';
    this.activeReservations.set(resId, reservation);
    logger.info(`🅿️ Bay ${bay.spaceNumber} reserved for user ${params.userId}. PIN: ${pin}`);
    return reservation;
  }

  /**
   * Confirms check-in and starts parking session
   */
  async checkInParkingBay(params: {
    facilityId: string;
    bayId: string;
    reservationId?: string;
  }): Promise<ParkingCheckInResult> {
    const bay = this.bays.get(params.bayId);
    if (!bay) throw new Error(`Bay ${params.bayId} not found`);

    if (params.reservationId) {
      const res = this.activeReservations.get(params.reservationId);
      if (res) res.status = 'checked_in';
    }

    bay.status = 'occupied';
    const sessionId = `parksess_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const facility = this.facilities.get(params.facilityId);

    this.activeSessions.set(sessionId, {
      bayId: bay.bayId,
      facilityId: params.facilityId,
      checkInTime: Date.now(),
    });

    return {
      sessionId,
      reservationId: params.reservationId,
      bayId: bay.bayId,
      checkInTime: Date.now(),
      hourlyRate: facility ? facility.hourlyRate : 3.5,
    };
  }

  /**
   * Concludes parking session and calculates fee
   */
  async checkOutParkingBay(sessionId: string): Promise<{
    sessionId: string;
    bayId: string;
    durationMinutes: number;
    totalFee: number;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Parking session not found: ${sessionId}`);

    const bay = this.bays.get(session.bayId);
    if (bay) bay.status = 'vacant';

    const durationMins = Math.max(1, Math.round((Date.now() - session.checkInTime) / (60 * 1000)));
    const facility = this.facilities.get(session.facilityId);
    const hourlyRate = facility ? facility.hourlyRate : 3.5;
    const fee = Math.round(((durationMins / 60) * hourlyRate) * 100) / 100;

    this.activeSessions.delete(sessionId);
    return {
      sessionId,
      bayId: session.bayId,
      durationMinutes: durationMins,
      totalFee: Math.max(1.0, fee),
    };
  }

  /**
   * Gets facility by ID
   */
  getFacility(facilityId: string) {
    return this.facilities.get(facilityId);
  }
}

export const parkingSpaceNavigationService = new ParkingSpaceNavigationService();
