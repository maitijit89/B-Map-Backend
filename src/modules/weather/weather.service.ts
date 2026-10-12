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
    if (override) {
      return {
        location: { latitude: lat, longitude: lng },
        highway_name: override.highway_name,
        temperature_celsius: override.temperature_celsius ?? 16.5,
        visibility_meters: override.visibility_meters ?? 1500,
        is_dense_fog_active: override.is_dense_fog_active ?? false,
        rainfall_mm_per_hour: override.rainfall_mm_per_hour ?? 0.0,
        imd_alert_level: override.imd_alert_level ?? 'GREEN',
        hazard_type: override.hazard_type,
        safety_advisory: override.safety_advisory ?? 'Manual override active',
        reported_at: override.updated_at ?? new Date().toISOString(),
        is_manual_override: true,
      };
    }

    let vis = 1500.0;
    let isFog = false;
    let alert: any = 'GREEN_NO_WARNING';
    let hazard: any = undefined;
    let advisory = 'Normal driving conditions. Maintain standard highway speeds.';

    if (
      lat >= 27.0 &&
      lat <= 31.0 &&
      (highway.includes('Yamuna') || highway.includes('NH-44') || highway.includes('NE-4'))
    ) {
      vis = 35.0; // 35m visibility
      isFog = true;
      alert = 'ORANGE_BE_PREPARED';
      hazard = 'DENSE_WINTER_FOG';
      advisory =
        'Caution: Extreme Dense Fog on Expressway. Visibility below 40 meters. Turn ON fog lamps and keep speed below 50 km/h.';
    }

    return {
      location: { latitude: lat, longitude: lng },
      highway_name: highway,
      temperature_celsius: 16.5,
      visibility_meters: vis,
      is_dense_fog_active: isFog,
      rainfall_mm_per_hour: 0.0,
      imd_alert_level: alert,
      hazard_type: hazard,
      safety_advisory: advisory,
      reported_at: new Date().toISOString(),
      is_manual_override: false,
    };
  }
}

export const weatherService = new WeatherService();
