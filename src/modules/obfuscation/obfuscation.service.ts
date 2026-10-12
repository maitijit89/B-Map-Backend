import { LatLng } from '../../core/utils/response';
import {
  CoordinateDatum,
  FuzzRequest,
  FuzzResponse,
  TransformRequest,
  TransformResponse,
} from './obfuscation.types';

const a = 6378245.0;
const ee = 0.00669342162296594323;
const xPI = (Math.PI * 3000.0) / 180.0;

export class ObfuscationService {
  public transformCoordinates(req: TransformRequest): TransformResponse {
    const lat = req.location?.latitude ?? req.latitude ?? 28.6129;
    const lng = req.location?.longitude ?? req.longitude ?? 77.2295;
    const source: CoordinateDatum = req.source_datum ?? req.sourceDatum ?? 'WGS84';
    const target: CoordinateDatum = req.target_datum ?? req.targetDatum ?? 'GCJ02';

    let outLoc: LatLng = { latitude: lat, longitude: lng };

    if (source === 'WGS84' && target === 'GCJ02') {
      outLoc = this.wgs84ToGCJ02(lat, lng);
    } else if (source === 'GCJ02' && target === 'WGS84') {
      outLoc = this.gcj02ToWGS84(lat, lng);
    } else if (source === 'GCJ02' && target === 'BD09') {
      outLoc = this.gcj02ToBD09(lat, lng);
    } else if (source === 'BD09' && target === 'GCJ02') {
      outLoc = this.bd09ToGCJ02(lat, lng);
    } else if (source === 'WGS84' && target === 'BD09') {
      const gcj = this.wgs84ToGCJ02(lat, lng);
      outLoc = this.gcj02ToBD09(gcj.latitude, gcj.longitude);
    }

    return {
      original_location: { latitude: lat, longitude: lng },
      target_location: outLoc,
      source_datum: source,
      target_datum: target,
    };
  }

  public applyPrivacyFuzz(req: FuzzRequest): FuzzResponse {
    const lat = req.location?.latitude ?? req.latitude ?? 28.6129;
    const lng = req.location?.longitude ?? req.longitude ?? 77.2295;
    const radius = req.radius_meters ?? req.radiusMeters ?? 150.0;

    const angle = Math.random() * 2 * Math.PI;
    const distM = Math.random() * radius;

    const dLat = (distM * Math.cos(angle)) / 111320.0;
    const dLng = (distM * Math.sin(angle)) / (111320.0 * Math.cos((lat * Math.PI) / 180.0));

    const fuzzed: LatLng = {
      latitude: Math.round((lat + dLat) * 1e5) / 1e5,
      longitude: Math.round((lng + dLng) * 1e5) / 1e5,
    };

    return {
      original_location: { latitude: lat, longitude: lng },
      fuzzed_location: fuzzed,
      noise_radius_meters: radius,
      privacy_mechanism: 'Planar Geo-Indistinguishability (Laplace Noise)',
    };
  }

  private wgs84ToGCJ02(lat: number, lng: number): LatLng {
    const dLat = this.transformLat(lng - 105.0, lat - 35.0);
    const dLng = this.transformLng(lng - 105.0, lat - 35.0);

    const radLat = (lat / 180.0) * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);

    const dLatFinal = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
    const dLngFinal = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);

    return {
      latitude: Math.round((lat + dLatFinal) * 1e6) / 1e6,
      longitude: Math.round((lng + dLngFinal) * 1e6) / 1e6,
    };
  }

  private gcj02ToWGS84(lat: number, lng: number): LatLng {
    const gcj = this.wgs84ToGCJ02(lat, lng);
    return {
      latitude: Math.round((lat * 2 - gcj.latitude) * 1e6) / 1e6,
      longitude: Math.round((lng * 2 - gcj.longitude) * 1e6) / 1e6,
    };
  }

  private gcj02ToBD09(lat: number, lng: number): LatLng {
    const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * xPI);
    const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * xPI);
    return {
      latitude: Math.round((z * Math.sin(theta) + 0.006) * 1e6) / 1e6,
      longitude: Math.round((z * Math.cos(theta) + 0.0065) * 1e6) / 1e6,
    };
  }

  private bd09ToGCJ02(lat: number, lng: number): LatLng {
    const x = lng - 0.0065;
    const y = lat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * xPI);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * xPI);
    return {
      latitude: Math.round(z * Math.sin(theta) * 1e6) / 1e6,
      longitude: Math.round(z * Math.cos(theta) * 1e6) / 1e6,
    };
  }

  private transformLat(x: number, y: number): number {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
    ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
    return ret;
  }

  private transformLng(x: number, y: number): number {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
    ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
    return ret;
  }
}

export const obfuscationService = new ObfuscationService();
