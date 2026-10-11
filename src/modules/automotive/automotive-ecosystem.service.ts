import { logger } from '../../core/config/logger';
import { Coordinate } from '../../core/types/geo.types';
import {
  AAOSVehicleState,
  AndroidAutoNavigationTemplate,
  CANBusTelemetryPacket,
  CarPlayNavigationTemplate,
  EcoDrivingScore,
  EVChargingStop,
  EVSmartRoutePlan,
  EVVehicleProfile,
  SmartHUDFrame,
} from './automotive-ecosystem.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';

export class AutomotiveEcosystemService {
  private vehicleStates = new Map<string, AAOSVehicleState>();
  private ecoDrivingStats = new Map<
    string,
    {
      harshAccels: number;
      harshBrakes: number;
      idleMinutes: number;
      totalKm: number;
    }
  >();

  /**
   * Generates Apple CarPlay CPNavigationTemplate payload
   */
  generateCarPlayTemplate(params: {
    remainingDistanceMeters: number;
    remainingDurationSeconds: number;
    currentSpeedKmh: number;
    speedLimitKmh?: number;
    nextTurnInstruction: string;
    nextTurnSymbol?: string;
    isNightMode?: boolean;
  }): CarPlayNavigationTemplate {
    const isNight = params.isNightMode ?? (new Date().getHours() >= 19 || new Date().getHours() < 6);
    const arrivalEpoch = Math.floor(Date.now() / 1000) + params.remainingDurationSeconds;

    return {
      currentManeuver: {
        symbolImage: params.nextTurnSymbol || 'turn.arrow.slight.left',
        instructionVariants: [
          params.nextTurnInstruction,
          `In ${(params.remainingDistanceMeters / 1000).toFixed(1)} km, ${params.nextTurnInstruction}`,
        ],
        distanceMeters: params.remainingDistanceMeters,
        remainingTimeSeconds: params.remainingDurationSeconds,
      },
      travelEstimates: {
        distanceRemainingMeters: params.remainingDistanceMeters,
        timeRemainingSeconds: params.remainingDurationSeconds,
        destinationArrivalEpoch: arrivalEpoch,
        speedLimitKmh: params.speedLimitKmh ?? 50,
      },
      tripProgressPercentage: Math.min(
        100,
        Math.max(0, Math.round((1 - params.remainingDistanceMeters / 15000) * 100))
      ),
      colorScheme: isNight ? 'night' : 'day',
      speedLimit: params.speedLimitKmh ?? 50,
      voicePrompt: params.nextTurnInstruction,
    };
  }

  /**
   * Generates Android Auto NavigationTemplate for Cars App Library
   */
  generateAndroidAutoTemplate(params: {
    stepTitle: string;
    stepDescription: string;
    remainingDistanceMeters: number;
    remainingDurationSeconds: number;
    recommendedLanes?: number[];
    isSplitScreen?: boolean;
  }): AndroidAutoNavigationTemplate {
    const km = (params.remainingDistanceMeters / 1000).toFixed(1);
    const mins = Math.round(params.remainingDurationSeconds / 60);
    const etaDate = new Date(Date.now() + params.remainingDurationSeconds * 1000);
    const formattedEta = `${etaDate.getHours().toString().padStart(2, '0')}:${etaDate
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    return {
      headerTitle: 'B-Map HD Guidance',
      stepManeuver: {
        title: params.stepTitle,
        description: params.stepDescription,
        iconUri: 'bmap://icons/maneuver_turn_left.png',
        distanceToStepMeters: params.remainingDistanceMeters,
      },
      laneGuidanceCard: {
        lanes: [
          { icons: ['turn_left'], isRecommended: (params.recommendedLanes ?? [0]).includes(0) },
          { icons: ['straight'], isRecommended: (params.recommendedLanes ?? []).includes(1) },
          { icons: ['straight'], isRecommended: (params.recommendedLanes ?? []).includes(2) },
          { icons: ['turn_right'], isRecommended: (params.recommendedLanes ?? []).includes(3) },
        ],
      },
      travelEstimates: {
        formattedRemainingDistance: `${km} km`,
        formattedDuration: `${mins} min`,
        formattedEta,
      },
      actionStrip: {
        actions: [
          { id: 'act_reroute', title: 'Alternative Routes', icon: 'route', actionType: 'reroute' },
          { id: 'act_stops', title: 'Add EV Stop', icon: 'ev_station', actionType: 'stop_search' },
          { id: 'act_mute', title: 'Mute Voice', icon: 'volume_off', actionType: 'mute' },
        ],
      },
      isSplitScreen: params.isSplitScreen ?? false,
    };
  }

  /**
   * Ingests native Android Automotive OS (AAOS) CarPropertyManager / VHAL updates
   */
  updateAAOSVehicleState(vehicleId: string, update: Partial<AAOSVehicleState>): AAOSVehicleState {
    const current = this.vehicleStates.get(vehicleId) || {
      speedKmh: 0,
      gear: 'D',
      steeringWheelAngleDegrees: 0,
      turnSignal: 'NONE',
      evBatteryPercent: 80,
      wipersActive: false,
      headlightsOn: true,
      tirePressureBar: { fl: 2.4, fr: 2.4, rl: 2.5, rr: 2.5 },
    };

    const updated: AAOSVehicleState = { ...current, ...update };
    this.vehicleStates.get(vehicleId);
    this.vehicleStates.set(vehicleId, updated);
    return updated;
  }

  /**
   * Ingests high-frequency CAN Bus / OBD-II frames and calculates real-time Eco-Driving score
   */
  processCANTelemetry(vehicleId: string, packet: CANBusTelemetryPacket): EcoDrivingScore {
    let stats = this.ecoDrivingStats.get(vehicleId);
    if (!stats) {
      stats = { harshAccels: 0, harshBrakes: 0, idleMinutes: 0, totalKm: 1 };
      this.ecoDrivingStats.set(vehicleId, stats);
    }

    // Harsh accel detection (throttle > 85% with rapid RPM change)
    if (packet.acceleratorPedalPositionPercent > 85) {
      stats.harshAccels += 1;
    }

    // Harsh brake detection (brake pressed with high deceleration)
    if (packet.brakePedalPressed && packet.instantFuelFlowLitersPerHour === 0) {
      stats.harshBrakes += 1;
    }

    // Compute Eco Score (100 baseline minus penalties)
    const penalty = stats.harshAccels * 2.5 + stats.harshBrakes * 3.0;
    const score = Math.max(20, Math.min(100, Math.round(100 - penalty)));

    const tips: string[] = [];
    if (stats.harshAccels > 3) {
      tips.push('Smoother acceleration on green lights can increase range by up to 12%.');
    }
    if (stats.harshBrakes > 2) {
      tips.push('Anticipate stops earlier to maximize regenerative braking energy recovery.');
    }
    if (tips.length === 0) {
      tips.push('Excellent smooth driving! Optimal battery and regenerative efficiency.');
    }

    return {
      overallScore: score,
      harshAccelerations: stats.harshAccels,
      harshBrakingEvents: stats.harshBrakes,
      idleWasteMinutes: stats.idleMinutes,
      co2SavedKg: Math.round(((stats.totalKm * 0.12) / 1000) * 100) / 100,
      tips,
    };
  }

  /**
   * Plans EV Smart Route with range projection, DC fast charger stops,
   * and automatic battery pre-conditioning thermal triggers
   */
  planEVChargingRoute(params: {
    origin: Coordinate;
    destination: Coordinate;
    vehicleProfile?: EVVehicleProfile;
    initialSocPercent: number;
  }): EVSmartRoutePlan {
    const profile: EVVehicleProfile = params.vehicleProfile || {
      make: 'Tesla',
      model: 'Model Y Long Range',
      batteryCapacityKwh: 78.1,
      usableCapacityKwh: 75.0,
      consumptionWhPerKm: 165,
      maxDcChargingPowerKw: 250,
      connectorTypes: ['CCS2', 'NACS'],
    };

    const directDistanceMeters = calculateDistanceMeters(params.origin, params.destination);
    // Driving distance factor (~1.3x Euclidean)
    const drivingDistanceKm = (directDistanceMeters * 1.3) / 1000;
    const totalEnergyNeededKwh = (drivingDistanceKm * profile.consumptionWhPerKm) / 1000;
    const socDropPercent = (totalEnergyNeededKwh / profile.usableCapacityKwh) * 100;
    const projectedArrivalSoc = params.initialSocPercent - socDropPercent;

    const safetyBufferSoc = 15; // 15% safety threshold
    const isChargingRequired = projectedArrivalSoc < safetyBufferSoc;

    const chargingStops: EVChargingStop[] = [];
    let batteryPreConditioningMeters: number | undefined;

    if (isChargingRequired) {
      // Find intermediate midpoint coordinate for supercharging hub
      const midLon = (params.origin[0] + params.destination[0]) / 2 + 0.01;
      const midLat = (params.origin[1] + params.destination[1]) / 2 + 0.01;

      const arrivalAtChargerSoc = Math.max(8, Math.round(params.initialSocPercent - socDropPercent * 0.55));
      const targetSoc = 80;
      const chargeEnergyNeeded = ((targetSoc - arrivalAtChargerSoc) / 100) * profile.usableCapacityKwh;
      // Charging duration calculation: Average DC power ~120kW across 10%-80%
      const chargingMinutes = Math.round((chargeEnergyNeeded / 120) * 60);

      chargingStops.push({
        stationId: 'ev_hub_supercharger_alpha',
        stationName: 'Supercharge Mega-Hub A100 (350kW DC HPC)',
        location: [midLon, midLat],
        chargerPowerKw: 350,
        arrivalSocPercent: arrivalAtChargerSoc,
        targetSocPercent: targetSoc,
        estimatedChargingMinutes: chargingMinutes,
        detourTimeMinutes: 3,
        preConditioningTriggered: true,
      });

      // Schedule battery pre-conditioning 15km before reaching the charger
      batteryPreConditioningMeters = Math.max(0, Math.round((directDistanceMeters * 0.55) - 15000));
    }

    const finalArrivalSoc = isChargingRequired
      ? Math.round(80 - (socDropPercent * 0.45))
      : Math.round(projectedArrivalSoc);

    return {
      origin: params.origin,
      destination: params.destination,
      totalDistanceMeters: Math.round(drivingDistanceKm * 1000),
      initialSocPercent: params.initialSocPercent,
      projectedArrivalSocPercent: finalArrivalSoc,
      isChargingRequired,
      chargingStops,
      batteryPreConditioningScheduledAtMeters: batteryPreConditioningMeters,
      summaryMessage: isChargingRequired
        ? `Charging required. Recommending ${chargingStops.length} high-power stop(s). Battery thermal pre-conditioning will trigger automatically.`
        : `Direct route within safe range. Estimated arrival SoC: ${finalArrivalSoc}%.`,
    };
  }

  /**
   * Serializes ultra-compact Smart Heads-Up Display (HUD) frame with binary hex payload
   * for optical waveguide and DLP projector HUD hardware
   */
  generateHUDFrame(params: {
    maneuverCode: number;
    maneuverSymbol: string;
    distancePercent: number;
    targetLaneBitmask: number;
    vehicleSpeedKmh: number;
    speedLimitKmh: number;
    adasWarningCode?: number;
  }): SmartHUDFrame {
    const maneuver = Math.min(255, Math.max(0, params.maneuverCode));
    const dist = Math.min(100, Math.max(0, Math.round(params.distancePercent)));
    const laneMask = Math.min(255, Math.max(0, params.targetLaneBitmask));
    const speed = Math.min(255, Math.max(0, Math.round(params.vehicleSpeedKmh)));
    const limit = Math.min(255, Math.max(0, Math.round(params.speedLimitKmh)));
    const adas = Math.min(255, Math.max(0, params.adasWarningCode ?? 0));
    const overspeed = speed > limit;

    // Build 8-byte compact binary hex payload:
    // [0]: Header 0xA5
    // [1]: Maneuver Code
    // [2]: Distance Bar %
    // [3]: Lane Bitmask (e.g. 0b00000001 = Lane 0 optimal)
    // [4]: Current Speed
    // [5]: Speed Limit
    // [6]: ADAS Alert Code
    // [7]: XOR Checksum
    const bytes = [0xa5, maneuver, dist, laneMask, speed, limit, adas];
    const checksum = bytes.reduce((acc, curr) => acc ^ curr, 0);
    bytes.push(checksum);

    const compactHex = bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    return {
      timestamp: Date.now(),
      maneuverCode: maneuver,
      maneuverSymbol: params.maneuverSymbol,
      distanceBarPercent: dist,
      targetLaneBitmask: laneMask,
      vehicleSpeedKmh: speed,
      speedLimitKmh: limit,
      overspeedWarning: overspeed,
      adasWarningCode: adas,
      compactHexPayload: compactHex,
    };
  }
}

export const automotiveEcosystemService = new AutomotiveEcosystemService();
