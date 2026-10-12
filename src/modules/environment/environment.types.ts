import { LatLng } from '../../core/utils/response';

export interface Pollutant {
  code: string;
  display_name: string;
  concentration: number;
  unit: string;
}

export interface AirQualityResponse {
  location: LatLng;
  aqi: number;
  category: string;
  dominant_pollutant: string;
  pollutants: Pollutant[];
  health_advice: string;
}

export interface SolarPotentialResponse {
  location: LatLng;
  max_sunshine_hours_per_year: number;
  carbon_offset_kg_per_year: number;
  max_array_panels_count: number;
  annual_energy_kwh: number;
  estimated_annual_savings_usd: number;
}

export interface PollenResponse {
  location: LatLng;
  tree_pollen_index: number;
  grass_pollen_index: number;
  weed_pollen_index: number;
  summary: string;
}
