import { LatLng } from '../../core/utils/response';

export interface FleetLocationUpdatePayload {
  driver_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed_kmh?: number;
}

export interface FleetTripRequestPayload {
  rider_id?: string;
  pickup: LatLng;
  dropoff: LatLng;
  pickup_address?: string;
  dropoff_address?: string;
}

export interface FleetVehicle {
  driver_id: string;
  location: LatLng;
  heading: number;
  speed_kmh: number;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE';
  distance_km?: number;
}
