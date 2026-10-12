import { LatLng } from '../../core/utils/response';

export interface PINCodeInfo {
  pincode: string;
  postOffice: string;
  district: string;
  state: string;
  circle: string;
  center: LatLng;
  boundingBox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export interface ParsedIndianAddress {
  rawInput: string;
  pincode?: string;
  landmarks: string[];
  metroPillar?: string;
  streetOrGali?: string;
  localityOrArea?: string;
  cityDistrict?: string;
  state?: string;
  bestMatchPin?: PINCodeInfo;
  estimatedLocation: LatLng;
  confidenceScore: number;
}
