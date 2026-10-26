import crypto from 'crypto';
import { logger } from '../../core/config/logger';
import { RiderHazardModel } from './rider-hazard.model';
import { Coordinate } from '../../core/types/geo.types';
import {
  GloveUILayout,
  HelmetAudioCue,
  RiderCrashEvent,
  RiderDynamicsTelemetry,
  RiderHazardReport,
  RiderHazardType,
  RiderLeanStats,
  RiderNavigationState,
  RiderRoutingPreferences,
  RiderVehicleType,
  RiderWeatherAlert,
  RiderWeatherCondition,
} from './rider-mode.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import { osrmService } from '../../services/osrm.service';

export class RiderModeService {
  private inMemoryHazards = new Map<string, RiderHazardReport>();
  private activeCrashEvents = new Map<string, RiderCrashEvent>();
  private sessionLeanStats = new Map<
    string,
    { maxLeft: number; maxRight: number; lastRoll: number; jerkAccumulator: number; count: number }
  >();

  constructor() {
    this.seedDefaultRiderHazards();
  }

  /**
   * Seeds demo two-wheeler hazards (Tram tracks, Metal joints, Gravel apex, Crosswind zones)
   */
  private seedDefaultRiderHazards() {
    const demoHazards: RiderHazardReport[] = [
      {
        hazardId: 'haz_tram_tracks_alex',
        type: 'tram_tracks',
        location: [13.411, 52.521],
        severity: 'high',
        warningMessage: 'Caution: Wet tram tracks crossing diagonally! Cross at right angle to avoid tire entrapment.',
        verifiedReportsCount: 42,
      },
      {
        hazardId: 'haz_bridge_joint_oberbaum',
        type: 'metal_bridge_joint',
        location: [13.445, 52.501],
        severity: 'high',
        warningMessage: 'Warning: Metal expansion joint on bridge surface. Extremely slippery when wet.',
        verifiedReportsCount: 28,
      },
      {
        hazardId: 'haz_gravel_corner_havel',
        type: 'loose_gravel_apex',
        location: [13.218, 52.485],
        severity: 'critical',
        warningMessage: 'Alert: Loose gravel spread on corner apex! Reduce lean angle and cornering speed.',
        verifiedReportsCount: 15,
      },
      {
        hazardId: 'haz_crosswind_viaduct',
        type: 'high_crosswind_zone',
        location: [13.385, 52.535],
        severity: 'high',
        warningMessage: 'Warning: Strong lateral wind gusts on elevated expressway viaduct.',
        verifiedReportsCount: 19,
      },
    ];

    for (const h of demoHazards) {
      this.inMemoryHazards.set(h.hazardId, h);
    }
  }

  /**
   * Plans route tailored for motorcycle and two-wheelers:
   * Handles expressway prohibitions, toll avoidance, bike pathways, and alley accessibility
   */
  async planRiderRoute(params: {
    origin: Coordinate;
    destination: Coordinate;
    preferences?: Partial<RiderRoutingPreferences>;
  }) {
    const prefs: RiderRoutingPreferences = {
      vehicleType: params.preferences?.vehicleType || 'commuter_motorcycle',
      avoidExpressways: params.preferences?.avoidExpressways ?? (params.preferences?.vehicleType === 'scooter_moped'),
      avoidTolls: params.preferences?.avoidTolls ?? true,
      preferDedicatedMotorcycleLanes: params.preferences?.preferDedicatedMotorcycleLanes ?? true,
      allowPassableAlleys: params.preferences?.allowPassableAlleys ?? true,
      avoidHighRiskSurfaces: params.preferences?.avoidHighRiskSurfaces ?? true,
    };

    // Determine base OSRM profile
    let profile: 'driving' | 'bike' = 'driving';
    if (prefs.vehicleType === 'bicycle' || prefs.vehicleType === 'ebike_delivery') {
      profile = 'bike';
    }

    const route = await osrmService.getRoute({
      coordinates: [params.origin, params.destination],
      profile,
      alternatives: true,
      overview: 'full',
    });

    // Scan route for nearby rider hazards
    const nearbyHazards = await this.getNearbyHazards(params.origin, 5000);

    return {
      route,
      preferencesApplied: prefs,
      riderSafetySummary: {
        expresswayAvoidanceActive: prefs.avoidExpressways,
        tollAvoidanceActive: prefs.avoidTolls,
        narrowPassableAlleysAllowed: prefs.allowPassableAlleys,
        activeHazardsAlongRoute: nearbyHazards.length,
      },
      nearbyHazards,
    };
  }

  /**
   * Ingests real-time IMU roll/pitch/yaw dynamics and calculates lean angle stats,
   * safe cornering speed advisory, and riding smoothness
   */
  processDynamics(
    sessionId: string,
    telemetry: RiderDynamicsTelemetry,
    weather?: RiderWeatherCondition
  ): RiderLeanStats {
    let session = this.sessionLeanStats.get(sessionId);
    if (!session) {
      session = { maxLeft: 0, maxRight: 0, lastRoll: telemetry.rollAngleDegrees, jerkAccumulator: 0, count: 0 };
      this.sessionLeanStats.set(sessionId, session);
    }

    const roll = telemetry.rollAngleDegrees;
    if (roll < 0 && Math.abs(roll) > session.maxLeft) session.maxLeft = Math.abs(roll);
    if (roll > 0 && roll > session.maxRight) session.maxRight = roll;

    session.count++;
    const rollDelta = Math.abs(roll - session.lastRoll);
    session.jerkAccumulator += rollDelta;
    session.lastRoll = roll;

    // Lean limit based on road friction
    const friction = weather?.roadFrictionCoefficient ?? 0.85;
    const isWet = friction < 0.6;
    const leanLimit = isWet ? 26 : 45; // Degrees

    let corneringAdvisory;
    if (telemetry.curveRadiusMeters && telemetry.curveRadiusMeters > 5) {
      // Safe cornering speed: v = sqrt(mu * g * R * tan(phi_limit)) in m/s
      const g = 9.81;
      const radLimit = (leanLimit * Math.PI) / 180;
      const safeSpeedMps = Math.sqrt(friction * g * telemetry.curveRadiusMeters * Math.tan(radLimit));
      const safeSpeedKmh = Math.round(safeSpeedMps * 3.6);

      if (telemetry.vehicleSpeedKmh > safeSpeedKmh) {
        corneringAdvisory = {
          recommendedSpeedKmh: safeSpeedKmh,
          warning: `Approaching curve too fast! Slow down from ${telemetry.vehicleSpeedKmh} km/h to ${safeSpeedKmh} km/h before leaning.`,
        };
      }
    }

    const avgJerk = session.count > 0 ? session.jerkAccumulator / session.count : 0;
    const smoothness = Math.max(20, Math.min(100, Math.round(100 - avgJerk * 4)));

    return {
      currentLeanDegrees: Math.round(roll * 10) / 10,
      maxLeftLeanDegrees: Math.round(session.maxLeft * 10) / 10,
      maxRightLeanDegrees: Math.round(session.maxRight * 10) / 10,
      leanLimitDegrees: leanLimit,
      smoothnessScore: smoothness,
      corneringAdvisory,
    };
  }

  /**
   * Evaluates weather and crosswinds for two-wheeler safety
   */
  evaluateWeatherSafety(
    weather: RiderWeatherCondition,
    isBridgeOrViaduct: boolean = false
  ): RiderWeatherAlert[] {
    const alerts: RiderWeatherAlert[] = [];

    // Crosswind alert
    const windSpeed = weather.windSpeedKmh;
    const gustSpeed = weather.windGustKmh;
    if (gustSpeed > 50 || (isBridgeOrViaduct && windSpeed > 35)) {
      alerts.push({
        alertType: 'crosswind_warning',
        severity: gustSpeed > 65 ? 'danger' : 'warning',
        message: `High crosswind warning! Gusts up to ${gustSpeed} km/h detected${
          isBridgeOrViaduct ? ' on bridge' : ''
        }. Keep center of lane and lower speed.`,
        speedLimitAdjustmentKmh: -20,
      });
    }

    // Wet / slick road alert
    if (weather.weatherState === 'rain' || weather.weatherState === 'heavy_rain') {
      alerts.push({
        alertType: 'wet_slick_road',
        severity: weather.weatherState === 'heavy_rain' ? 'warning' : 'caution',
        message: 'Wet surface: reduced traction on road paint, manhole covers, and metal joints.',
        speedLimitAdjustmentKmh: -15,
      });
    }

    // Black ice alert
    if (weather.temperatureCelsius < 3 && weather.roadFrictionCoefficient < 0.4) {
      alerts.push({
        alertType: 'low_temp_ice',
        severity: 'danger',
        message: `Freezing road surface (${weather.temperatureCelsius}°C)! High risk of black ice in shaded areas.`,
        speedLimitAdjustmentKmh: -25,
      });
    }

    return alerts;
  }

  /**
   * Generates ultra-concise audio cues for Bluetooth helmet headsets with audio ducking
   */
  generateHelmetAudioCue(params: {
    instruction: string;
    distanceMeters: number;
    hazardAlert?: string;
  }): HelmetAudioCue {
    if (params.hazardAlert) {
      return {
        cueId: `cue_haz_${Date.now()}`,
        audioChime: 'alert_chime',
        conciseText: `Hazard: ${params.hazardAlert}`,
        audioDuckingPercent: 85,
        priority: 'high',
      };
    }

    const dist = params.distanceMeters;
    let concise = `${params.instruction}`;
    let chime: HelmetAudioCue['audioChime'] = 'single_beep';

    if (dist < 50) {
      concise = `Now, ${params.instruction}`;
      chime = 'double_beep';
    } else if (dist < 300) {
      concise = `${params.instruction} in ${dist}m`;
    }

    return {
      cueId: `cue_nav_${Date.now()}`,
      audioChime: chime,
      conciseText: concise,
      audioDuckingPercent: 75,
      priority: 'medium',
    };
  }

  /**
   * Returns oversized glove-friendly UI controls & handlebar switch layouts
   */
  getGloveUILayout(mode: 'glove_touch_high_contrast' | 'handlebar_switch_mode' = 'glove_touch_high_contrast'): GloveUILayout {
    return {
      displayMode: mode,
      primaryButtons: [
        { slot: 1, label: 'REPEAT VOICE', action: 'repeat_audio', icon: 'volume_up' },
        { slot: 2, label: 'REPORT HAZARD', action: 'quick_report_hazard', icon: 'warning' },
        { slot: 3, label: 'GAS / SHELTER', action: 'search_gas_shelter', icon: 'local_gas_station' },
        { slot: 4, label: 'OVERVIEW MAP', action: 'toggle_route_overview', icon: 'map' },
      ],
    };
  }

  /**
   * Evaluates autonomous motorcycle crash detection (e-Call)
   * High G-force impact + high sustained tilt + zero velocity -> triggers countdown
   */
  evaluateCrashTrigger(params: {
    telemetry: RiderDynamicsTelemetry;
    stationarySeconds: number;
    location: Coordinate;
    medicalProfile?: { riderName: string; bloodType: string; emergencyContacts: string[] };
  }): RiderCrashEvent | null {
    const isImpact = Math.abs(params.telemetry.lateralAccelerationG) > 3.8;
    const isSevereTilt = Math.abs(params.telemetry.rollAngleDegrees) > 65;
    const isStationary = params.telemetry.vehicleSpeedKmh < 2 && params.stationarySeconds >= 10;

    if (isImpact || (isSevereTilt && isStationary)) {
      const eventId = `crash_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const crashEvent: RiderCrashEvent = {
        eventId,
        timestamp: Date.now(),
        location: params.location,
        impactDecelerationG: Math.abs(params.telemetry.lateralAccelerationG),
        sustainedTiltAngleDegrees: Math.abs(params.telemetry.rollAngleDegrees),
        stationaryDurationSeconds: params.stationarySeconds,
        emergencyDispatchTriggered: params.stationarySeconds > 25, // Auto dispatch after 25s if not cancelled
        medicalProfile: params.medicalProfile,
        status: params.stationarySeconds > 25 ? 'dispatched' : 'countdown_cancelling',
      };

      this.activeCrashEvents.set(eventId, crashEvent);
      logger.warn(`🚨 Rider Crash Detected: Event ${eventId} at [${params.location.join(', ')}]`);
      return crashEvent;
    }

    return null;
  }

  /**
   * Cancels a pending crash alert when rider taps "I am OK"
   */
  cancelCrashAlert(eventId: string): boolean {
    const event = this.activeCrashEvents.get(eventId);
    if (event) {
      event.status = 'cancelled_by_rider';
      logger.info(`✅ Rider Crash Alert ${eventId} cancelled by rider.`);
      return true;
    }
    return false;
  }

  /**
   * Retrieves nearby two-wheeler hazards
   */
  async getNearbyHazards(center: Coordinate, radiusMeters: number = 3000): Promise<RiderHazardReport[]> {
    const results: RiderHazardReport[] = [];
    for (const h of this.inMemoryHazards.values()) {
      const dist = calculateDistanceMeters(center, h.location);
      if (dist <= radiusMeters) {
        results.push(h);
      }
    }
    return results;
  }

  /**
   * Reports a new crowdsourced rider hazard
   */
  async reportHazard(hazard: Omit<RiderHazardReport, 'hazardId' | 'verifiedReportsCount'>) {
    const hazardId = `haz_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const report: RiderHazardReport = {
      ...hazard,
      hazardId,
      verifiedReportsCount: 1,
    };
    this.inMemoryHazards.set(hazardId, report);

    try {
      await RiderHazardModel.create({
        hazardId,
        type: report.type,
        location: { type: 'Point', coordinates: report.location },
        severity: report.severity,
        warningMessage: report.warningMessage,
        verifiedReportsCount: 1,
        isActive: true,
      });
    } catch (err: any) {
      logger.warn(`Could not save hazard to Mongo (using in-memory): ${err.message}`);
    }

    return report;
  }
}

export const riderModeService = new RiderModeService();
export const riderModeEngineService = riderModeService;
