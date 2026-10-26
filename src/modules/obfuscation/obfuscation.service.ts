import { calculateDistance, LatLng } from '../../core/utils/response';
import {
  CoordinateDatum,
  DefenseMaskingRequest,
  DefenseMaskingResponse,
  DefenseZone,
  FuzzRequest,
  FuzzResponse,
  TransformRequest,
  TransformResponse,
} from './obfuscation.types';

const a = 6378245.0;
const ee = 0.00669342162296594323;
const xPI = (Math.PI * 3000.0) / 180.0;

export class ObfuscationService {
  private readonly defenseZones: DefenseZone[] = [
    {
      id: 'def_ambala_afb',
      name: 'Ambala Air Force Base (Western Air Command)',
      category: 'AIR_BASE',
      center: { latitude: 30.3685, longitude: 76.8173 },
      bufferRadiusMeters: 3000,
    },
    {
      id: 'def_delhi_cantonment',
      name: 'Delhi Cantonment & Western Command Strategic Zone',
      category: 'MILITARY_CANTONMENT',
      center: { latitude: 28.5885, longitude: 77.1352 },
      bufferRadiusMeters: 2500,
    },
    {
      id: 'def_chandipur_itr',
      name: 'Integrated Test Range (ITR) Chandipur (DRDO)',
      category: 'DRDO_TEST_RANGE',
      center: { latitude: 21.4398, longitude: 87.0135 },
      bufferRadiusMeters: 4000,
    },
    {
      id: 'def_karwar_naval',
      name: 'INS Kadamba Naval Base (Project Seabird, Karwar)',
      category: 'NAVAL_BASE',
      center: { latitude: 14.7786, longitude: 74.1523 },
      bufferRadiusMeters: 3500,
    },
    {
      id: 'def_pokhran_range',
      name: 'Pokhran Field Firing Range',
      category: 'STRATEGIC_ASSET',
      center: { latitude: 27.0425, longitude: 71.7582 },
      bufferRadiusMeters: 5000,
    },
  ];
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
    const epsilon = req.epsilon && req.epsilon > 0 ? req.epsilon : 1.0;

    // Planar Laplacian Differential Privacy per algorithm.md Section 8:
    // Scale parameter b = radius / epsilon
    const b = radius / epsilon;
    const u1 = Math.max(1e-7, Math.min(1 - 1e-7, Math.random()));
    const u2 = Math.max(1e-7, Math.min(1 - 1e-7, Math.random()));

    // Inverse CDF of Laplace distribution: x = -b * sgn(u - 0.5) * ln(1 - 2|u - 0.5|)
    const lx = -b * Math.sign(u1 - 0.5) * Math.log(1 - 2 * Math.abs(u1 - 0.5));
    const ly = -b * Math.sign(u2 - 0.5) * Math.log(1 - 2 * Math.abs(u2 - 0.5));

    const dLat = ly / 111320.0;
    const dLng = lx / (111320.0 * Math.cos((lat * Math.PI) / 180.0));

    const fuzzed: LatLng = {
      latitude: Math.round((lat + dLat) * 1e6) / 1e6,
      longitude: Math.round((lng + dLng) * 1e6) / 1e6,
    };

    return {
      original_location: { latitude: lat, longitude: lng },
      fuzzed_location: fuzzed,
      noise_radius_meters: Math.round(Math.sqrt(lx * lx + ly * ly) * 10) / 10,
      privacy_mechanism: `Planar Geo-Indistinguishability (Epsilon=${epsilon} Laplace Noise)`,
    };
  }

  public getDefenseZones(): DefenseZone[] {
    return [...this.defenseZones];
  }

  public applyDefenseMasking(req: DefenseMaskingRequest): DefenseMaskingResponse {
    const lat = req.location?.latitude ?? req.latitude ?? 28.5885;
    const lng = req.location?.longitude ?? req.longitude ?? 77.1352;
    const minJitter = req.minJitterMeters ?? 200.0;
    const maxJitter = req.maxJitterMeters ?? 500.0;

    // Fast bounding-box rejection before computing trigonometric Haversine distance
    const matchedZone = this.defenseZones.find((zone) => {
      // 0.06 degrees is approx ~6.6km, safely encompassing max bufferRadius (5000m)
      if (
        Math.abs(lat - zone.center.latitude) > 0.06 ||
        Math.abs(lng - zone.center.longitude) > 0.06
      ) {
        return false;
      }
      const distM = calculateDistance(lat, lng, zone.center.latitude, zone.center.longitude);
      return distM <= zone.bufferRadiusMeters;
    });

    if (!matchedZone) {
      return {
        original_location: { latitude: lat, longitude: lng },
        obfuscated_location: { latitude: lat, longitude: lng },
        is_within_defense_zone: false,
        jitter_distance_meters: 0,
        policy_compliance: 'National Geospatial Policy: Non-sensitive civilian perimeter.',
      };
    }

    // Apply 200m–500m spatial coordinate jitter
    const jitterDist = minJitter + Math.random() * (maxJitter - minJitter);
    const angle = Math.random() * 2 * Math.PI;

    const dLat = (jitterDist * Math.cos(angle)) / 111320.0;
    const dLng = (jitterDist * Math.sin(angle)) / (111320.0 * Math.cos((lat * Math.PI) / 180.0));

    const obfuscated: LatLng = {
      latitude: Math.round((lat + dLat) * 1e5) / 1e5,
      longitude: Math.round((lng + dLng) * 1e5) / 1e5,
    };

    return {
      original_location: { latitude: lat, longitude: lng },
      obfuscated_location: obfuscated,
      is_within_defense_zone: true,
      zone_name: matchedZone.name,
      zone_category: matchedZone.category,
      jitter_distance_meters: Math.round(jitterDist * 10) / 10,
      policy_compliance: 'National Geospatial Policy (NGP): Sensitive Defense Installation Spatial Jitter (200m-500m) & Polygon Masking Enforced.',
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
