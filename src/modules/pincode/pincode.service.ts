import { calculateDistance } from '../../core/utils/response';
import { PINCodeInfo, ParsedIndianAddress } from './pincode.types';

export class PINCodeService {
  private readonly directory: Record<string, PINCodeInfo> = {
    '110001': {
      pincode: '110001',
      postOffice: 'Connaught Place H.O',
      district: 'Central Delhi',
      state: 'Delhi',
      circle: 'Delhi Circle',
      center: { latitude: 28.6304, longitude: 77.2177 },
      boundingBox: [77.2, 28.61, 77.24, 28.65],
    },
    '110016': {
      pincode: '110016',
      postOffice: 'Hauz Khas S.O',
      district: 'South Delhi',
      state: 'Delhi',
      circle: 'Delhi Circle',
      center: { latitude: 28.5494, longitude: 77.2001 },
      boundingBox: [77.18, 28.53, 77.22, 28.57],
    },
    '400001': {
      pincode: '400001',
      postOffice: 'Mumbai G.P.O.',
      district: 'Mumbai',
      state: 'Maharashtra',
      circle: 'Maharashtra Circle',
      center: { latitude: 18.9401, longitude: 72.8354 },
      boundingBox: [72.82, 18.92, 72.85, 18.96],
    },
    '400050': {
      pincode: '400050',
      postOffice: 'Bandra West S.O',
      district: 'Mumbai Suburban',
      state: 'Maharashtra',
      circle: 'Maharashtra Circle',
      center: { latitude: 19.0596, longitude: 72.8295 },
      boundingBox: [72.81, 19.04, 72.85, 19.08],
    },
    '560001': {
      pincode: '560001',
      postOffice: 'Bangalore G.P.O.',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      circle: 'Karnataka Circle',
      center: { latitude: 12.9784, longitude: 77.5994 },
      boundingBox: [77.58, 12.96, 77.62, 13.0],
    },
    '560034': {
      pincode: '560034',
      postOffice: 'Koramangala S.O',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      circle: 'Karnataka Circle',
      center: { latitude: 12.9352, longitude: 77.6245 },
      boundingBox: [77.6, 12.91, 77.65, 12.96],
    },
    '500081': {
      pincode: '500081',
      postOffice: 'HITEC City S.O',
      district: 'Hyderabad',
      state: 'Telangana',
      circle: 'Telangana Circle',
      center: { latitude: 17.4435, longitude: 78.3772 },
      boundingBox: [78.35, 17.42, 78.4, 17.47],
    },
    '600001': {
      pincode: '600001',
      postOffice: 'Chennai G.P.O.',
      district: 'Chennai',
      state: 'Tamil Nadu',
      circle: 'Tamil Nadu Circle',
      center: { latitude: 13.09, longitude: 80.289 },
      boundingBox: [80.26, 13.07, 80.31, 13.11],
    },
    '700001': {
      pincode: '700001',
      postOffice: 'Kolkata G.P.O.',
      district: 'Kolkata',
      state: 'West Bengal',
      circle: 'West Bengal Circle',
      center: { latitude: 22.5726, longitude: 88.3639 },
      boundingBox: [88.34, 22.55, 88.39, 22.6],
    },
  };

  public lookupPINCode(pincode: string): PINCodeInfo | null {
    const trimmed = String(pincode).trim();
    return this.directory[trimmed] ?? null;
  }

  public parseIndianAddress(address: string): ParsedIndianAddress {
    const res: ParsedIndianAddress = {
      rawInput: address,
      landmarks: [],
      estimatedLocation: { latitude: 28.6139, longitude: 77.209 },
      confidenceScore: 0.7,
    };

    const pinRegex = /\b([1-9][0-9]{5})\b/;
    const pinMatch = pinRegex.exec(address);
    if (pinMatch) {
      const pin = pinMatch[1];
      res.pincode = pin;
      const info = this.lookupPINCode(pin);
      if (info) {
        res.bestMatchPin = info;
        res.estimatedLocation = info.center;
        res.cityDistrict = info.district;
        res.state = info.state;
        res.confidenceScore = 0.95;
      }
    }

    const pillarRegex = /(?:metro\s+pillar|pillar\s+no\.?)\s*([0-9]+[a-z]?)/i;
    const pillarMatch = pillarRegex.exec(address);
    if (pillarMatch) {
      res.metroPillar = pillarMatch[0];
    }

    const landmarkRegex = /(?:near|opp|opposite|behind|beside|adj|adjacent to)\s+([^,]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = landmarkRegex.exec(address)) !== null) {
      if (match[1]) {
        res.landmarks.push(match[1].trim());
      }
    }

    const galiRegex = /(?:gali\s+no\.?|street\s+no\.?|road\s+no\.?|marg|rasta|lane)\s*([^,]+)/i;
    const galiMatch = galiRegex.exec(address);
    if (galiMatch) {
      res.streetOrGali = galiMatch[0].trim();
    }

    return res;
  }

  public reverseLookup(lat: number, lng: number): PINCodeInfo {
    let closest: PINCodeInfo = this.directory['110001'];
    let minDist = Infinity;

    for (const info of Object.values(this.directory)) {
      const d = calculateDistance(lat, lng, info.center.latitude, info.center.longitude);
      if (d < minDist) {
        minDist = d;
        closest = info;
      }
    }

    return closest;
  }
}

export const pincodeService = new PINCodeService();
