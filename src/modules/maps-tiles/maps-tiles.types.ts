import { LatLng } from '../../core/utils/response';

export type MapTheme =
  | 'standard'
  | 'dark'
  | 'night'
  | 'retro'
  | 'silver'
  | 'aubergine';

export interface StaticMarker {
  location: LatLng;
  color?: string;
  label?: string;
  size?: string;
}

export interface StaticMapRequest {
  center: LatLng;
  zoom?: number;
  width?: number;
  height?: number;
  markers?: StaticMarker[];
  path?: LatLng[];
  pathColor?: string;
  theme?: MapTheme;
}

export interface ClusterPoint {
  id?: string;
  is_cluster: boolean;
  point_count?: number;
  location: LatLng;
  expansion_zoom?: number;
  place?: Record<string, any>;
}

export interface MapboxStyleSpec {
  version: number;
  name: string;
  center: [number, number];
  zoom: number;
  sources: Record<string, any>;
  layers: Array<{
    id: string;
    type: string;
    source?: string;
    paint: Record<string, any>;
  }>;
}
