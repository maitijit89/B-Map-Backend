import { HighwayWeatherReport, ManualWeatherOverride } from './weather.types';

export class WeatherService {
  private readonly overrides = new Map<string, ManualWeatherOverride>();

  public setManualOverride(override: ManualWeatherOverride): ManualWeatherOverride {
    const key = override.highway_name.trim().toLowerCase();
    const entry: ManualWeatherOverride = {
      ...override,
      temperature_celsius: override.temperature_celsius ?? override.temperature ?? 16.5,
      visibility_meters: override.visibility_meters ?? 1500,
      is_dense_fog_active: override.is_dense_fog_active ?? override.is_dense_fog ?? false,
      imd_alert_level: override.imd_alert_level ?? override.alert_level ?? 'GREEN',
      hazard_type: override.hazard_type ?? (override.condition as any) ?? 'Clear',
      safety_advisory: override.safety_advisory ?? 'Weather alert manual override',
      updated_at: new Date().toISOString(),
    };
    this.overrides.set(key, entry);
    return entry;
  }

  public getActiveOverrides(): ManualWeatherOverride[] {
    return Array.from(this.overrides.values());
  }

  public deleteOverride(highwayName: string): boolean {
    const key = highwayName.trim().toLowerCase();
    return this.overrides.delete(key);
  }

  public getHighwayWeather(
    lat: number,
    lng: number,
    highway: string
  ): HighwayWeatherReport {
    const key = highway.trim().toLowerCase();
    const override = this.overrides.get(key);
    let vis = 1500.0;
    let isFog = false;
    let rainMm = 0.0;
    let alert: any = 'GREEN_NO_WARNING';
    let hazard: any = undefined;
    let advisory = 'Normal driving conditions. Maintain standard highway speeds.';
    let isRerouteRecommended = false;
    let rerouteReason: 'ZERO_VISIBILITY_WINTER_FOG' | 'MONSOON_HIGHWAY_FLOODING' | 'CYCLONIC_STORM_SURGE' | 'NONE' = 'NONE';
    let speedReductionPercent = 0;
    let safeSpeedLimitKmh = 100;

    // Northern winter dense fog corridor (< 50m visibility)
    if (
      lat >= 27.0 &&
      lat <= 31.0 &&
      (highway.includes('Yamuna') || highway.includes('NH-44') || highway.includes('NE-4') || highway.includes('NE-2'))
    ) {
      vis = 35.0; // 35m zero-visibility fog (< 50m)
      isFog = true;
      alert = 'ORANGE_BE_PREPARED';
      hazard = 'DENSE_WINTER_FOG';
      isRerouteRecommended = true;
      rerouteReason = 'ZERO_VISIBILITY_WINTER_FOG';
      speedReductionPercent = 60;
      safeSpeedLimitKmh = 40;
      advisory =
        'IMD Severe Weather Alert: Zero-visibility northern winter fog (< 50m) on expressway corridor. Proactive reroute recommended. Reduce speed to 40 km/h and turn ON fog lamps.';
    }

    if (override) {
      const oVis = override.visibility_meters ?? 1500;
      const oRain = override.rainfall_mm_per_hour ?? 0.0;
      const oReroute = oVis < 50 || oRain >= 40 || override.imd_alert_level === 'RED';
      return {
        location: { latitude: lat, longitude: lng },
        highway_name: override.highway_name,
        temperature_celsius: override.temperature_celsius ?? 16.5,
        visibility_meters: oVis,
        is_dense_fog_active: override.is_dense_fog_active ?? oVis < 200,
        rainfall_mm_per_hour: oRain,
        imd_alert_level: override.imd_alert_level ?? 'GREEN',
        hazard_type: override.hazard_type,
        safety_advisory: override.safety_advisory ?? 'Manual override active',
        reported_at: override.updated_at ?? new Date().toISOString(),
        is_manual_override: true,
        isRerouteRecommended: oReroute,
        rerouteReason: oVis < 50 ? 'ZERO_VISIBILITY_WINTER_FOG' : oRain >= 40 ? 'MONSOON_HIGHWAY_FLOODING' : 'NONE',
        speedReductionPercent: oReroute ? 50 : 0,
        safeSpeedLimitKmh: oVis < 50 ? 40 : 80,
      };
    }

    return {
      location: { latitude: lat, longitude: lng },
      highway_name: highway,
      temperature_celsius: 16.5,
      visibility_meters: vis,
      is_dense_fog_active: isFog,
      rainfall_mm_per_hour: rainMm,
      imd_alert_level: alert,
      hazard_type: hazard,
      safety_advisory: advisory,
      reported_at: new Date().toISOString(),
      is_manual_override: false,
      isRerouteRecommended,
      rerouteReason,
      speedReductionPercent,
      safeSpeedLimitKmh,
    };
  }

  /**
   * Scans a full route corridor or waypoint list for meteorological hazards.
   */
  public scanRouteCorridor(
    points: { latitude: number; longitude: number }[],
    highway = 'National Highway Corridor'
  ): HighwayWeatherReport[] {
    if (!points || points.length === 0) return [];
    // Sample every nth point to avoid excessive overhead on long polylines
    const step = Math.max(1, Math.floor(points.length / 10));
    const sampled: HighwayWeatherReport[] = [];
    for (let i = 0; i < points.length; i += step) {
      const pt = points[i];
      sampled.push(this.getHighwayWeather(pt.latitude, pt.longitude, highway));
    }
    return sampled;
  }
}

export const weatherService = new WeatherService();

