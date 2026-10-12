import { LatLng } from '../../core/utils/response';

export interface TerritorialBorderGeoJSON {
  type: string; // 'FeatureCollection'
  features: Array<{
    type: string;
    properties: Record<string, any>;
    geometry: {
      type: string;
      coordinates: number[][] | number[][][];
    };
  }>;
}

export interface RegionHighlight {
  id: string;
  name: string;
  admin_level: number;
  country_code: string;
  bounding_box: [number, number, number, number];
  center: LatLng;
  area_sq_km: number;
  boundary_geojson: Record<string, any>;
  mask_polygon_json: Record<string, any>;
  stroke_color: string;
  stroke_width: number;
  fill_color: string;
  fill_opacity: number;
  is_disputed_border: boolean;
}
