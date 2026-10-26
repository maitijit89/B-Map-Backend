import { DIGIPINResult } from './digipin.types';

/**
 * 32-Character Alphanumeric Grid Alphabet per algorithm.md Section 4.1
 * Omits '0', '1', 'O', 'I' to eliminate visual transcription ambiguity.
 */
const DIGIPIN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ALPHABET_MAP = new Map<string, number>();
for (let i = 0; i < DIGIPIN_ALPHABET.length; i++) {
  ALPHABET_MAP.set(DIGIPIN_ALPHABET[i], i);
}

// Bounding Box Parameters for Indian Sovereign GIS Envelope (Lat: 6.0° - 38.0° N, Lon: 68.0° - 100.0° E)
const INDIA_LAT_MIN = 6.0;
const INDIA_LAT_MAX = 38.0;
const INDIA_LON_MIN = 68.0;
const INDIA_LON_MAX = 100.0;
const TIER_COUNT = 10;

export class DIGIPINService {
  private encodeCache = new Map<string, DIGIPINResult>();
  private decodeCache = new Map<string, DIGIPINResult>();

  /**
   * Encodes geographic coordinates into a 10-character hierarchical DigiPIN (4m x 4m resolution).
   */
  public encodeCoordinates(lat: number, lng: number): DIGIPINResult {
    // Clamp to Indian sovereign spatial boundary
    const clampedLat = Math.max(INDIA_LAT_MIN, Math.min(INDIA_LAT_MAX, lat));
    const clampedLng = Math.max(INDIA_LON_MIN, Math.min(INDIA_LON_MAX, lng));

    const cacheKey = `${clampedLat.toFixed(6)}_${clampedLng.toFixed(6)}`;
    const cached = this.encodeCache.get(cacheKey);
    if (cached) return cached;

    let curLatMin = INDIA_LAT_MIN;
    let curLatMax = INDIA_LAT_MAX;
    let curLonMin = INDIA_LON_MIN;
    let curLonMax = INDIA_LON_MAX;

    const codeChars: string[] = [];

    // Hierarchical recursive subdivision across 10 tiers
    for (let tier = 0; tier < TIER_COUNT; tier++) {
      // Alternate aspect ratio: even tiers 4 rows x 8 cols, odd tiers 8 rows x 4 cols (32 subcells)
      const rows = tier % 2 === 0 ? 4 : 8;
      const cols = tier % 2 === 0 ? 8 : 4;

      const latStep = (curLatMax - curLatMin) / rows;
      const lonStep = (curLonMax - curLonMin) / cols;

      let r = Math.floor((clampedLat - curLatMin) / latStep);
      let c = Math.floor((clampedLng - curLonMin) / lonStep);

      // Boundary clamp
      if (r >= rows) r = rows - 1;
      if (r < 0) r = 0;
      if (c >= cols) c = cols - 1;
      if (c < 0) c = 0;

      const symbolIndex = r * cols + c;
      codeChars.push(DIGIPIN_ALPHABET[symbolIndex]);

      // Refine bounding box for the next tier
      curLatMin = curLatMin + r * latStep;
      curLatMax = curLatMin + latStep;
      curLonMin = curLonMin + c * lonStep;
      curLonMax = curLonMin + lonStep;
    }

    // Formatted standard 10-character code with hyphen grouping: e.g. 28-J4-K8-M2-9P
    const rawCode = codeChars.join('');
    const formattedCode = `${rawCode.slice(0, 2)}-${rawCode.slice(2, 4)}-${rawCode.slice(4, 6)}-${rawCode.slice(6, 8)}-${rawCode.slice(8, 10)}`;

    const { state, postalCircle } = this.resolveIndianStateAndCircle(clampedLat, clampedLng);
    const plusCode = this.generatePlusCode(clampedLat, clampedLng);

    const result: DIGIPINResult = {
      digipin: formattedCode,
      plus_code: plusCode,
      center_coordinate: {
        latitude: Math.round(((curLatMin + curLatMax) / 2) * 1e6) / 1e6,
        longitude: Math.round(((curLonMin + curLonMax) / 2) * 1e6) / 1e6,
      },
      resolution: '4m x 4m Micro-Grid (Tier 10)',
      postal_circle: postalCircle,
      state,
      bounding_box: {
        min_latitude: Math.round(curLatMin * 1e6) / 1e6,
        max_latitude: Math.round(curLatMax * 1e6) / 1e6,
        min_longitude: Math.round(curLonMin * 1e6) / 1e6,
        max_longitude: Math.round(curLonMax * 1e6) / 1e6,
      },
    };

    if (this.encodeCache.size > 2000) {
      const oldestKey = this.encodeCache.keys().next().value;
      if (oldestKey) this.encodeCache.delete(oldestKey);
    }
    this.encodeCache.set(cacheKey, result);

    return result;
  }

  /**
   * Decodes a 10-character DigiPIN back into its exact 4m x 4m micro-grid coordinates.
   */
  public decodeDIGIPIN(code: string): DIGIPINResult {
    // Normalize code: remove hyphens, spaces, and make uppercase
    const cleaned = code.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    const cached = this.decodeCache.get(cleaned);
    if (cached) return cached;

    let curLatMin = INDIA_LAT_MIN;
    let curLatMax = INDIA_LAT_MAX;
    let curLonMin = INDIA_LON_MIN;
    let curLonMax = INDIA_LON_MAX;

    const iterations = Math.min(cleaned.length, TIER_COUNT);

    for (let tier = 0; tier < iterations; tier++) {
      const ch = cleaned[tier];
      const symbolIndex = ALPHABET_MAP.get(ch) ?? 0;

      const rows = tier % 2 === 0 ? 4 : 8;
      const cols = tier % 2 === 0 ? 8 : 4;

      const latStep = (curLatMax - curLatMin) / rows;
      const lonStep = (curLonMax - curLonMin) / cols;

      const r = Math.floor(symbolIndex / cols);
      const c = symbolIndex % cols;

      curLatMin = curLatMin + r * latStep;
      curLatMax = curLatMin + latStep;
      curLonMin = curLonMin + c * lonStep;
      curLonMax = curLonMin + lonStep;
    }

    const centerLat = Math.round(((curLatMin + curLatMax) / 2) * 1e6) / 1e6;
    const centerLng = Math.round(((curLonMin + curLonMax) / 2) * 1e6) / 1e6;

    const { state, postalCircle } = this.resolveIndianStateAndCircle(centerLat, centerLng);
    const plusCode = this.generatePlusCode(centerLat, centerLng);

    const formattedCode = cleaned.length >= 10
      ? `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8, 10)}`
      : cleaned;

    const result: DIGIPINResult = {
      digipin: formattedCode,
      plus_code: plusCode,
      center_coordinate: { latitude: centerLat, longitude: centerLng },
      resolution: `4m x 4m Micro-Grid (Tier ${iterations})`,
      postal_circle: postalCircle,
      state,
      bounding_box: {
        min_latitude: Math.round(curLatMin * 1e6) / 1e6,
        max_latitude: Math.round(curLatMax * 1e6) / 1e6,
        min_longitude: Math.round(curLonMin * 1e6) / 1e6,
        max_longitude: Math.round(curLonMax * 1e6) / 1e6,
      },
    };

    if (this.decodeCache.size > 2000) {
      const oldestKey = this.decodeCache.keys().next().value;
      if (oldestKey) this.decodeCache.delete(oldestKey);
    }
    this.decodeCache.set(cleaned, result);

    return result;
  }

  /**
   * Resolves Indian State / UT and Postal Circle from geographic centroid.
   */
  private resolveIndianStateAndCircle(
    lat: number,
    lng: number
  ): { state: string; postalCircle: string } {
    if (lat >= 28.35 && lat <= 28.92 && lng >= 76.82 && lng <= 77.38) {
      return { state: 'Delhi NCR', postalCircle: 'Delhi Postal Circle' };
    }
    if (lat >= 18.85 && lat <= 19.35 && lng >= 72.75 && lng <= 73.15) {
      return { state: 'Maharashtra (Mumbai)', postalCircle: 'Maharashtra Circle' };
    }
    if (lat >= 12.80 && lat <= 13.25 && lng >= 77.40 && lng <= 77.80) {
      return { state: 'Karnataka (Bengaluru)', postalCircle: 'Karnataka Circle' };
    }
    if (lat >= 17.20 && lat <= 17.60 && lng >= 78.25 && lng <= 78.65) {
      return { state: 'Telangana (Hyderabad)', postalCircle: 'Telangana Circle' };
    }
    if (lat >= 12.90 && lat <= 13.25 && lng >= 80.10 && lng <= 80.35) {
      return { state: 'Tamil Nadu (Chennai)', postalCircle: 'Tamil Nadu Circle' };
    }
    if (lat >= 22.40 && lat <= 22.70 && lng >= 88.20 && lng <= 88.50) {
      return { state: 'West Bengal (Kolkata)', postalCircle: 'West Bengal Circle' };
    }
    if (lat >= 22.95 && lat <= 23.15 && lng >= 72.45 && lng <= 72.70) {
      return { state: 'Gujarat (Ahmedabad)', postalCircle: 'Gujarat Circle' };
    }
    if (lat >= 26.80 && lat <= 27.05 && lng >= 75.70 && lng <= 75.95) {
      return { state: 'Rajasthan (Jaipur)', postalCircle: 'Rajasthan Circle' };
    }
    if (lat >= 26.75 && lat <= 27.00 && lng >= 80.85 && lng <= 81.05) {
      return { state: 'Uttar Pradesh (Lucknow)', postalCircle: 'Uttar Pradesh Circle' };
    }
    if (lat >= 8.35 && lat <= 12.85 && lng >= 74.85 && lng <= 77.45) {
      return { state: 'Kerala', postalCircle: 'Kerala Circle' };
    }
    if (lat >= 19.5 && lat <= 24.5 && lng >= 68.0 && lng <= 74.5) {
      return { state: 'Gujarat', postalCircle: 'Gujarat Circle' };
    }
    if (lat >= 15.5 && lat <= 22.1 && lng >= 72.5 && lng <= 80.9) {
      return { state: 'Maharashtra', postalCircle: 'Maharashtra Circle' };
    }
    if (lat >= 11.5 && lat <= 18.5 && lng >= 74.0 && lng <= 78.6) {
      return { state: 'Karnataka', postalCircle: 'Karnataka Circle' };
    }
    if (lat >= 8.0 && lat <= 13.5 && lng >= 76.2 && lng <= 80.4) {
      return { state: 'Tamil Nadu', postalCircle: 'Tamil Nadu Circle' };
    }
    if (lat >= 23.5 && lat <= 30.5 && lng >= 77.0 && lng <= 84.7) {
      return { state: 'Uttar Pradesh', postalCircle: 'Uttar Pradesh Circle' };
    }
    if (lat >= 23.0 && lat <= 30.2 && lng >= 69.5 && lng <= 78.3) {
      return { state: 'Rajasthan', postalCircle: 'Rajasthan Circle' };
    }
    if (lat >= 21.5 && lat <= 27.3 && lng >= 85.8 && lng <= 89.9) {
      return { state: 'West Bengal', postalCircle: 'West Bengal Circle' };
    }

    return { state: 'India', postalCircle: 'National Postal Circle' };
  }

  /**
   * Generates Open Location Code (Plus Code) style representation.
   */
  private generatePlusCode(lat: number, lng: number): string {
    const latPart = Math.abs(Math.floor(lat * 10)) % 100;
    const lngPart = Math.abs(Math.floor(lng * 10)) % 100;
    const mixPart = Math.abs(Math.floor(lat * lng)) % 100;
    return `7J${latPart.toString(16).toUpperCase().padStart(2, '0')}${lngPart
      .toString(16)
      .toUpperCase()
      .padStart(2, '0')}+${mixPart.toString(16).toUpperCase().padStart(2, '0')}`;
  }
}

export const digipinService = new DIGIPINService();
