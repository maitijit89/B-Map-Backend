import {
  AirQualityResponse,
  PollenResponse,
  SolarPotentialResponse,
} from './environment.types';

export class EnvironmentService {
  public getAirQuality(lat: number, lng: number): AirQualityResponse {
    let baseAQI = Math.floor(35 + 20 * Math.sin(lat * 5.0) + 15 * Math.cos(lng * 5.0));
    if (baseAQI < 10) baseAQI = 10;
    if (baseAQI > 300) baseAQI = 300;

    let category = 'Good';
    let advice = 'Air quality is satisfactory, and air pollution poses little or no risk.';
    if (baseAQI > 50 && baseAQI <= 100) {
      category = 'Moderate';
      advice = 'Air quality is acceptable; however, sensitive individuals may experience minor irritation.';
    } else if (baseAQI > 100) {
      category = 'Unhealthy for Sensitive Groups';
      advice = 'Members of sensitive groups may experience health effects. General public is less likely to be affected.';
    }

    return {
      location: { latitude: lat, longitude: lng },
      aqi: baseAQI,
      category,
      dominant_pollutant: 'PM2.5',
      pollutants: [
        {
          code: 'pm25',
          display_name: 'PM2.5 (Fine particulate matter)',
          concentration: Math.round(baseAQI * 0.35 * 10) / 10,
          unit: 'µg/m³',
        },
        {
          code: 'pm10',
          display_name: 'PM10 (Inhalable particles)',
          concentration: Math.round(baseAQI * 0.72 * 10) / 10,
          unit: 'µg/m³',
        },
        {
          code: 'no2',
          display_name: 'Nitrogen Dioxide',
          concentration: 14.2,
          unit: 'ppb',
        },
        {
          code: 'o3',
          display_name: 'Ozone',
          concentration: 28.5,
          unit: 'ppb',
        },
      ],
      health_advice: advice,
    };
  }

  public getSolarPotential(lat: number, lng: number): SolarPotentialResponse {
    const sunHours = 1650.0 + 400.0 * Math.cos((lat * Math.PI) / 180.0);
    const maxPanels = 24;
    const energyKWh = maxPanels * 400.0 * (sunHours / 1000.0);

    return {
      location: { latitude: lat, longitude: lng },
      max_sunshine_hours_per_year: Math.round(sunHours),
      carbon_offset_kg_per_year: Math.round(energyKWh * 0.42),
      max_array_panels_count: maxPanels,
      annual_energy_kwh: Math.round(energyKWh),
      estimated_annual_savings_usd: Math.round(energyKWh * 0.18),
    };
  }

  public getPollen(lat: number, lng: number): PollenResponse {
    return {
      location: { latitude: lat, longitude: lng },
      tree_pollen_index: 2,
      grass_pollen_index: 1,
      weed_pollen_index: 0,
      summary: 'Low to moderate pollen levels detected.',
    };
  }
}

export const environmentService = new EnvironmentService();
