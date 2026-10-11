import { Coordinate } from '../../core/types/geo.types';
import { calculateBearing } from '../../core/utils/geo.utils';
import {
  Dynamic4DAtmosphericState,
  Dynamic4DEntity,
  Dynamic4DSceneState,
  Dynamic4DTimeSliderInterpolation,
  TimeOfDayPhase,
} from './spatial-visualization.types';

export class DynamicSpace4DService {
  /**
   * Generates complete 4D dynamic scene state at coordinate and timestamp t.
   */
  generate4DSceneState(
    center: Coordinate,
    radiusMeters: number = 800,
    requestedTimestamp?: number,
    weatherOverride?: 'none' | 'monsoon_rain' | 'delhi_winter_fog' | 'summer_heat_haze'
  ): Dynamic4DSceneState {
    const timestamp = requestedTimestamp || Date.now();
    const date = new Date(timestamp);
    const hour = date.getHours() + date.getMinutes() / 60;

    // 1. Determine diurnal phase and solar parameters
    const phase = this.resolveTimeOfDayPhase(hour);
    const atmosphere = this.calculateAtmosphere(timestamp, hour, phase, weatherOverride);

    // 2. Synthesize dynamic moving entities (traffic streams, pedestrian swarms, transit)
    const dynamicEntities = this.synthesizeDynamicEntities(center, hour, atmosphere);

    // 3. Calculate building glow profiles based on ambient night lighting
    const buildingGlowProfiles = [
      { buildingId: 'bld_commercial_tower_1', emissiveMultiplier: atmosphere.streetLightingIntensity * 1.5 },
      { buildingId: 'bld_commercial_tower_2', emissiveMultiplier: atmosphere.streetLightingIntensity * 1.2 },
      { buildingId: 'bld_metro_viaduct', emissiveMultiplier: atmosphere.streetLightingIntensity * 0.8 },
    ];

    return {
      sceneId: `scene_4d_${Date.now()}`,
      timestamp,
      epochIso: date.toISOString(),
      center,
      radiusMeters,
      atmosphere,
      dynamicEntities,
      occupancyHeatFactor: this.calculateUrbanActivityFactor(hour),
      interpolatedPanoramasCount: 16,
      buildingGlowProfiles,
    };
  }

  /**
   * Evaluates time-of-day phase based on 24-hour decimal clock.
   */
  private resolveTimeOfDayPhase(hour: number): TimeOfDayPhase {
    if (hour >= 5.0 && hour < 7.0) return 'dawn';
    if (hour >= 7.0 && hour < 11.0) return 'morning_peak';
    if (hour >= 11.0 && hour < 15.0) return 'midday';
    if (hour >= 15.0 && hour < 17.5) return 'afternoon';
    if (hour >= 17.5 && hour < 19.0) return 'golden_hour';
    if (hour >= 19.0 && hour < 20.5) return 'twilight';
    return 'night_urban';
  }

  /**
   * Calculates atmospheric lighting, sun angles, skybox, road wetness, and street lighting.
   */
  private calculateAtmosphere(
    timestamp: number,
    hour: number,
    phase: TimeOfDayPhase,
    weatherOverride?: 'none' | 'monsoon_rain' | 'delhi_winter_fog' | 'summer_heat_haze'
  ): Dynamic4DAtmosphericState {
    let sunElevation = 0;
    let sunAzimuth = 180;
    let ambientColorHex = '#FFFFFF';
    let streetLightingIntensity = 0;
    let roadWetnessFactor = 0;
    let visibilityMeters = 10000;
    let skyboxHdri = 'skyboxes/clear_day_4k.hdr';

    // Solar azimuth and elevation progression
    if (hour >= 6 && hour <= 18) {
      sunElevation = Math.sin(((hour - 6) / 12) * Math.PI) * 72; // up to 72 degrees at noon
      sunAzimuth = 90 + ((hour - 6) / 12) * 180; // from east (90) to west (270)
    } else {
      sunElevation = -15; // below horizon
      sunAzimuth = 0;
    }

    switch (phase) {
      case 'dawn':
        ambientColorHex = '#FDBA74'; // warm amber
        skyboxHdri = 'skyboxes/dawn_golden_4k.hdr';
        streetLightingIntensity = 0.4;
        break;
      case 'morning_peak':
        ambientColorHex = '#FDE68A';
        skyboxHdri = 'skyboxes/morning_clear_4k.hdr';
        streetLightingIntensity = 0.0;
        break;
      case 'midday':
        ambientColorHex = '#FFFFFF';
        skyboxHdri = 'skyboxes/noon_bright_4k.hdr';
        streetLightingIntensity = 0.0;
        break;
      case 'golden_hour':
        ambientColorHex = '#F59E0B'; // deep golden amber
        skyboxHdri = 'skyboxes/golden_hour_4k.hdr';
        streetLightingIntensity = 0.2;
        break;
      case 'twilight':
        ambientColorHex = '#818CF8'; // twilight indigo
        skyboxHdri = 'skyboxes/twilight_blue_4k.hdr';
        streetLightingIntensity = 0.7;
        break;
      case 'night_urban':
        ambientColorHex = '#1E1B4B'; // midnight blue
        skyboxHdri = 'skyboxes/night_city_lights_4k.hdr';
        streetLightingIntensity = 1.0;
        break;
    }

    // Weather impact
    const precipitation = weatherOverride || 'none';
    if (precipitation === 'monsoon_rain') {
      roadWetnessFactor = 0.95; // highly reflective water puddles
      visibilityMeters = 3500;
      ambientColorHex = '#94A3B8';
      skyboxHdri = 'skyboxes/monsoon_overcast_4k.hdr';
    } else if (precipitation === 'delhi_winter_fog') {
      roadWetnessFactor = 0.3;
      visibilityMeters = 280; // dense winter smog / fog envelope
      ambientColorHex = '#CBD5E1';
      skyboxHdri = 'skyboxes/winter_fog_dense_4k.hdr';
    } else if (precipitation === 'summer_heat_haze') {
      roadWetnessFactor = 0.0;
      visibilityMeters = 8000;
      ambientColorHex = '#FEF08A';
    }

    return {
      timestamp,
      phase,
      sunElevation: Math.round(sunElevation * 10) / 10,
      sunAzimuth: Math.round(sunAzimuth * 10) / 10,
      ambientColorHex,
      skyboxHdri,
      precipitation,
      visibilityMeters,
      roadWetnessFactor,
      streetLightingIntensity,
    };
  }

  /**
   * Synthesizes dynamic moving entities for 4D simulation (vehicles, crowds).
   */
  private synthesizeDynamicEntities(
    center: Coordinate,
    hour: number,
    atmosphere: Dynamic4DAtmosphericState
  ): Dynamic4DEntity[] {
    const isPeak = (hour >= 8 && hour <= 10.5) || (hour >= 17.5 && hour <= 20.5);
    const trafficDensity = isPeak ? 0.92 : 0.45;

    return [
      {
        entityId: 'ent_traffic_flow_main',
        type: 'vehicle_stream',
        currentPosition: [center[0] + 0.001, center[1] + 0.0005, 0],
        velocityVector: [12.5, 0, 0], // ~45 km/h
        densityFactor: trafficDensity,
      },
      {
        entityId: 'ent_pedestrian_hub',
        type: 'pedestrian_swarm',
        currentPosition: [center[0] - 0.0005, center[1] - 0.0008, 0],
        velocityVector: [1.2, 0.4, 0],
        densityFactor: isPeak ? 0.88 : 0.35,
      },
      {
        entityId: 'ent_metro_transit_active',
        type: 'transit_vehicle',
        currentPosition: [center[0] + 0.002, center[1] + 0.0018, 14.5], // on elevated metro deck
        velocityVector: [20.0, 0, 0], // ~72 km/h
        densityFactor: 1.0,
      },
    ];
  }

  /**
   * Calculates overall urban activity factor based on time of day (0.0 to 1.0).
   */
  private calculateUrbanActivityFactor(hour: number): number {
    if (hour >= 9 && hour <= 11) return 0.95;
    if (hour >= 17 && hour <= 20) return 0.98;
    if (hour >= 12 && hour <= 16) return 0.75;
    if (hour >= 23 || hour <= 5) return 0.15;
    return 0.55;
  }

  /**
   * Interpolates 4D temporal changes between two timestamps or capture epochs.
   * Enables continuous time-slider scrubbing for infrastructure changes and diurnal lighting.
   */
  interpolateTemporalSlider(
    startEpochTimestamp: number,
    targetEpochTimestamp: number,
    sliderFactor: number // 0.0 to 1.0
  ): Dynamic4DTimeSliderInterpolation {
    const clampedFactor = Math.max(0, Math.min(1, sliderFactor));
    const interpolatedTimestamp = Math.round(
      startEpochTimestamp + clampedFactor * (targetEpochTimestamp - startEpochTimestamp)
    );

    const date = new Date(interpolatedTimestamp);
    const hour = date.getHours() + date.getMinutes() / 60;
    const phase = this.resolveTimeOfDayPhase(hour);
    const blendedAtmosphere = this.calculateAtmosphere(interpolatedTimestamp, hour, phase);

    // Spatial divergences (infrastructure expansions between epochs)
    const spatialDivergences: Dynamic4DTimeSliderInterpolation['spatialDivergences'] = [
      {
        areaName: 'Cyber City Rapid Metro Flyover Expansion',
        description: 'Completed 6-lane elevated flyover connector with dedicated Rapid Metro portal',
        divergenceType: 'infrastructure_addition',
        coordinate: [77.0875, 28.4955],
      },
      {
        areaName: 'Connaught Circus Pedestrian Plaza Underpass',
        description: 'New pedestrian underpass connecting Inner Circle to Palika Bazaar',
        divergenceType: 'lane_widening',
        coordinate: [77.2215, 28.6310],
      },
      {
        areaName: 'Tech Pinnacle Tower 4',
        description: '38-storey commercial glass tower erected between 2024 and 2026',
        divergenceType: 'commercial_tower_erection',
        coordinate: [77.0890, 28.4960],
      },
    ];

    return {
      startEpochTimestamp,
      targetEpochTimestamp,
      interpolatedTimestamp,
      sliderFactor: clampedFactor,
      blendedAtmosphere,
      spatialDivergences,
    };
  }
}

export const dynamicSpace4DService = new DynamicSpace4DService();
