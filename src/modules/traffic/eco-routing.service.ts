import { RoadSegmentEdge } from './traffic.types';

export interface VehicleEnergyProfile {
  propulsion: 'ice_petrol' | 'ice_diesel' | 'ev_battery';
  curbMassKg: number;
  aerodynamicDragCoefficientCd: number;
  frontalAreaM2: number;
  rollingResistanceCoefficientCrr: number;
  powertrainEfficiency: number; // e.g. 0.28-0.32 for ICE, 0.88 for EV
  regenerativeBrakingEfficiency?: number; // e.g. 0.70 for EV
  idleFuelRateLitersPerHour?: number;
}

export interface SegmentEnergyConsumption {
  segmentId: string;
  roadName: string;
  energyJoules: number;
  regeneratedEnergyJoules?: number;
  equivalentFuelLitersOrKwh: number;
  co2EmissionsGrams: number;
  stopAndGoPenaltyPercent: number;
  gradeEffectPercent: number;
}

export interface EcoRouteComparison {
  routeCategory: 'FASTEST' | 'ECO_FRIENDLY' | 'BALANCED';
  totalDurationMinutes: number;
  totalDistanceKm: number;
  totalEnergyKwh: number;
  totalFuelLitersOrKwh: number;
  totalCo2Kg: number;
  energySavingsPercentVsBaseline: number;
  co2SavingsPercentVsBaseline: number;
  segments: SegmentEnergyConsumption[];
}

/**
 * Physics-Based Eco-Routing & Powertrain Telematics Engine
 * Implements rolling resistance, aerodynamic drag, road grade/incline slope,
 * stop-and-go congestion kinetic dissipation, and EV regenerative braking per algorithm.md Section 11.
 */
export class EcoRoutingService {
  private readonly AIR_DENSITY_RHO = 1.225; // kg/m^3
  private readonly GRAVITY_G = 9.81; // m/s^2

  // Standard Vehicle Profiles
  public static readonly DEFAULT_PETROL_CAR: VehicleEnergyProfile = {
    propulsion: 'ice_petrol',
    curbMassKg: 1400,
    aerodynamicDragCoefficientCd: 0.31,
    frontalAreaM2: 2.2,
    rollingResistanceCoefficientCrr: 0.012,
    powertrainEfficiency: 0.30,
    idleFuelRateLitersPerHour: 0.8,
  };

  public static readonly DEFAULT_EV_CAR: VehicleEnergyProfile = {
    propulsion: 'ev_battery',
    curbMassKg: 1650,
    aerodynamicDragCoefficientCd: 0.27,
    frontalAreaM2: 2.25,
    rollingResistanceCoefficientCrr: 0.010,
    powertrainEfficiency: 0.88,
    regenerativeBrakingEfficiency: 0.70,
  };

  public static readonly DEFAULT_COMMERCIAL_DIESEL: VehicleEnergyProfile = {
    propulsion: 'ice_diesel',
    curbMassKg: 4500,
    aerodynamicDragCoefficientCd: 0.55,
    frontalAreaM2: 4.5,
    rollingResistanceCoefficientCrr: 0.015,
    powertrainEfficiency: 0.38,
    idleFuelRateLitersPerHour: 1.8,
  };

  public static readonly DEFAULT_EV_SCOOTER: VehicleEnergyProfile = {
    propulsion: 'ev_battery',
    curbMassKg: 180, // Scooter + Rider
    aerodynamicDragCoefficientCd: 0.45,
    frontalAreaM2: 0.75,
    rollingResistanceCoefficientCrr: 0.018,
    powertrainEfficiency: 0.82,
    regenerativeBrakingEfficiency: 0.55,
  };

  /**
   * Calculates physics-based tractive energy consumption on a road segment:
   * P_tractive = P_roll + P_aero + P_grade + P_accel
   */
  public calculateSegmentEnergy(
    segment: RoadSegmentEdge & { gradePercent?: number },
    profile: VehicleEnergyProfile = EcoRoutingService.DEFAULT_PETROL_CAR
  ): SegmentEnergyConsumption {
    const lengthM = segment.lengthMeters || 500;
    const vKmh = Math.max(5.0, segment.effectiveSpeedKmh || segment.currentSpeedKmh || 45.0);
    const vMps = (vKmh * 1000) / 3600;

    // 1. Aerodynamic drag force: F_aero = 0.5 * rho * Cd * A * v^2
    const fAero =
      0.5 * this.AIR_DENSITY_RHO * profile.aerodynamicDragCoefficientCd * profile.frontalAreaM2 * (vMps * vMps);

    // 2. Rolling resistance force: F_roll = Crr * m * g * cos(theta)
    const gradePercent = segment.gradePercent || 0.0;
    const thetaRad = Math.atan(gradePercent / 100.0);
    const fRoll = profile.rollingResistanceCoefficientCrr * profile.curbMassKg * this.GRAVITY_G * Math.cos(thetaRad);

    // 3. Road Grade / Incline Force: F_grade = m * g * sin(theta)
    const fGrade = profile.curbMassKg * this.GRAVITY_G * Math.sin(thetaRad);

    // Steady-state mechanical energy (Joules)
    const eSteadyJoules = (fAero + fRoll + fGrade) * lengthM;

    // 4. Stop-and-Go Kinetic Acceleration Dissipation in Traffic Congestion
    let stopGoMultiplier = 1.0;
    if (segment.congestionLevel === 'congested') {
      stopGoMultiplier = 1.45;
    } else if (segment.congestionLevel === 'severe_gridlock') {
      stopGoMultiplier = 1.95;
    } else if (segment.congestionLevel === 'slow') {
      stopGoMultiplier = 1.18;
    }

    const totalMechanicalJoules = eSteadyJoules * stopGoMultiplier;

    // 5. Powertrain Efficiency & EV Regenerative Braking Recapture
    let inputEnergyJoules = 0;
    let regeneratedEnergyJoules = 0;

    if (profile.propulsion === 'ev_battery') {
      if (totalMechanicalJoules >= 0) {
        inputEnergyJoules = totalMechanicalJoules / profile.powertrainEfficiency;
      } else {
        // Downhill or decelerating: capture regenerative braking energy
        const regenEfficiency = profile.regenerativeBrakingEfficiency || 0.70;
        regeneratedEnergyJoules = Math.abs(totalMechanicalJoules) * regenEfficiency;
        inputEnergyJoules = -regeneratedEnergyJoules;
      }
    } else {
      // ICE vehicles cannot capture regenerative braking; downhill rolling is fuel-cutoff idle
      if (totalMechanicalJoules > 0) {
        inputEnergyJoules = totalMechanicalJoules / profile.powertrainEfficiency;
      } else {
        // Idling fuel consumption during downhill coasting
        const coastingDurationHours = (lengthM / vMps) / 3600;
        const idleFuelLiters = (profile.idleFuelRateLitersPerHour || 0.8) * coastingDurationHours;
        inputEnergyJoules = idleFuelLiters * 34.2e6;
      }
    }

    // Conversions
    // 1 Liter of Petrol ~ 34.2 MJ, 1 Liter of Diesel ~ 38.6 MJ, 1 kWh = 3.6 MJ
    let fuelOrKwh = 0;
    let co2Grams = 0;

    if (profile.propulsion === 'ev_battery') {
      const netKwh = inputEnergyJoules / 3.6e6;
      fuelOrKwh = Math.round(netKwh * 100) / 100;
      co2Grams = Math.round(Math.max(0, fuelOrKwh) * 420); // Indian energy grid average ~420g CO2/kWh
    } else if (profile.propulsion === 'ice_petrol') {
      fuelOrKwh = Math.round((inputEnergyJoules / 34.2e6) * 1000) / 1000;
      co2Grams = Math.round(fuelOrKwh * 2310); // Petrol produces ~2310g CO2 per liter
    } else {
      fuelOrKwh = Math.round((inputEnergyJoules / 38.6e6) * 1000) / 1000;
      co2Grams = Math.round(fuelOrKwh * 2680); // Diesel produces ~2680g CO2 per liter
    }

    const gradeEffectPercent = Math.round(((fGrade / Math.max(1, fAero + fRoll)) * 100));

    return {
      segmentId: segment.segmentId,
      roadName: segment.name,
      energyJoules: Math.round(inputEnergyJoules),
      regeneratedEnergyJoules: Math.round(regeneratedEnergyJoules),
      equivalentFuelLitersOrKwh: Math.max(0, fuelOrKwh),
      co2EmissionsGrams: Math.max(0, co2Grams),
      stopAndGoPenaltyPercent: Math.round((stopGoMultiplier - 1.0) * 100),
      gradeEffectPercent,
    };
  }

  /**
   * Evaluates overall eco and emissions comparison between routes.
   */
  public evaluateRouteEco(
    edges: (RoadSegmentEdge & { gradePercent?: number })[],
    profile: VehicleEnergyProfile = EcoRoutingService.DEFAULT_PETROL_CAR,
    category: 'FASTEST' | 'ECO_FRIENDLY' | 'BALANCED' = 'ECO_FRIENDLY'
  ): EcoRouteComparison {
    const segmentMetrics = edges.map((e) => this.calculateSegmentEnergy(e, profile));
    const totalEnergyJ = segmentMetrics.reduce((sum, s) => sum + s.energyJoules, 0);
    const totalFuelOrKwh =
      Math.round(segmentMetrics.reduce((sum, s) => sum + s.equivalentFuelLitersOrKwh, 0) * 100) / 100;
    const totalCo2Kg =
      Math.round((segmentMetrics.reduce((sum, s) => sum + s.co2EmissionsGrams, 0) / 1000) * 10) / 10;
    const totalMinutes =
      Math.round(edges.reduce((sum, e) => sum + e.travelTimeMinutes, 0) * 10) / 10;
    const totalDistanceKm =
      Math.round((edges.reduce((sum, e) => sum + e.lengthMeters, 0) / 1000) * 10) / 10;

    return {
      routeCategory: category,
      totalDurationMinutes: totalMinutes,
      totalDistanceKm,
      totalEnergyKwh: Math.round((totalEnergyJ / 3.6e6) * 100) / 100,
      totalFuelLitersOrKwh: totalFuelOrKwh,
      totalCo2Kg,
      energySavingsPercentVsBaseline: 0,
      co2SavingsPercentVsBaseline: 0,
      segments: segmentMetrics,
    };
  }
}

export const ecoRoutingService = new EcoRoutingService();
export const ecoRoutingEngineService = ecoRoutingService;
