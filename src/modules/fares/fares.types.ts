export type IndianCity =
  | 'DELHI'
  | 'MUMBAI'
  | 'BENGALURU'
  | 'KOLKATA'
  | 'CHENNAI'
  | 'HYDERABAD'
  | string;

export interface FareEstimateRequest {
  city?: IndianCity;
  distance_km?: number;
  distanceKm?: number;
  duration_minutes?: number;
  durationMinutes?: number;
  vehicle_type?: string;
  is_night_time?: boolean;
  isNightTime?: boolean;
}

export interface FareBreakdown {
  vehicle_category: string;
  base_fare_inr: number;
  per_km_rate_inr: number;
  night_surcharge_inr: number;
  total_estimated_inr: number;
  notes?: string;
}

export interface FareEstimateResponse {
  city: string;
  distance_km: number;
  duration_minutes: number;
  is_night_surcharge_active: boolean;
  fare_options: FareBreakdown[];
}
