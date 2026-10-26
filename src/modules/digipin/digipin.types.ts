import { LatLng } from '../../core/utils/response';

export interface DIGIPINResult {
  digipin: string;
  plus_code: string;
  center_coordinate: LatLng;
  resolution: string;
  postal_circle: string;
  state: string;
  bounding_box?: {
    min_latitude: number;
    max_latitude: number;
    min_longitude: number;
    max_longitude: number;
  };
}

