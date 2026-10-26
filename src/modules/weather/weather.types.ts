import { LatLng } from '../../core/utils/response';

export type IMDAlertLevel =
  | 'GREEN_NO_WARNING'
  | 'YELLOW_BE_AWARE'
  | 'ORANGE_BE_PREPARED'
  | 'RED_TAKE_ACTION'
  | 'GREEN'
  | 'YELLOW'
  | 'ORANGE'
  | 'RED';

export type WeatherHazardType =
  | 'DENSE_WINTER_FOG'
  | 'HEAVY_MONSOON_RAINFALL'
  | 'EXTREME_HEATWAVE'
  | 'SEVERE_AQI_SMOG'
  | 'Dense Fog'
  | 'Rain'
  | 'Clear';

export interface HighwayWeatherReport {
  location: LatLng;
  highway_name: string;
  temperature_celsius: number;
  visibility_meters: number;
  is_dense_fog_active: boolean;
  rainfall_mm_per_hour: number;
  imd_alert_level: IMDAlertLevel;
  hazard_type?: WeatherHazardType;
  safety_advisory: string;
  reported_at: string;
  is_manual_override?: boolean;
  isRerouteRecommended?: boolean;
  rerouteReason?: 'ZERO_VISIBILITY_WINTER_FOG' | 'MONSOON_HIGHWAY_FLOODING' | 'CYCLONIC_STORM_SURGE' | 'NONE';
  speedReductionPercent?: number;
  safeSpeedLimitKmh?: number;
}

export interface ManualWeatherOverride {
  highway_name: string;
  temperature_celsius?: number;
  temperature?: number;
  visibility_meters?: number;
  is_dense_fog_active?: boolean;
  is_dense_fog?: boolean;
  rainfall_mm_per_hour?: number;
  imd_alert_level?: IMDAlertLevel;
  alert_level?: IMDAlertLevel;
  hazard_type?: WeatherHazardType;
  condition?: string;
  safety_advisory?: string;
  updated_by?: string;
  updated_at?: string;
}
