import { LatLng } from '../../core/utils/response';

export type ConnectorType =
  | 'CCS2'
  | 'TYPE_2'
  | 'BHARAT_DC001'
  | 'BHARAT_AC001'
  | 'ATHER_GRID'
  | 'BATTERY_SWAP'
  | string;

export interface ConnectorStatus {
  type: ConnectorType;
  power_kw: number;
  total_ports: number;
  available_ports: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
}

export interface ChargingStation {
  id: string;
  name: string;
  operator: string;
  address: string;
  location: LatLng;
  connectors: ConnectorStatus[];
  cost_per_kwh_inr: number;
  is_24x7: boolean;
  has_restroom: boolean;
  has_food_dining: boolean;
  distance_km?: number;
  last_updated: string;
}

export interface NearbyEVQuery {
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  connector_filter?: ConnectorType;
  min_power_kw?: number;
}
