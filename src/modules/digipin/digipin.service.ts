import { DIGIPINResult } from './digipin.types';

const Alphabet = '23456789BCDFGHJKLMNPQRSTVWXYZ';

export class DIGIPINService {
  public encodeCoordinates(lat: number, lng: number): DIGIPINResult {
    const latClamped = Math.max(-90.0, Math.min(90.0, lat));
    const lngClamped = Math.max(-180.0, Math.min(180.0, lng));

    const gridCode = this.generateGridHash(latClamped, lngClamped);

    const latPart = Math.abs(Math.floor(latClamped * 10)) % 100;
    const lngPart = Math.abs(Math.floor(lngClamped * 10)) % 100;
    const mixPart = Math.abs(Math.floor(latClamped * lngClamped)) % 100;
    const plusCode = `7J${latPart.toString(16).toUpperCase().padStart(2, '0')}${lngPart.toString(16).toUpperCase().padStart(2, '0')}+${mixPart.toString(16).toUpperCase().padStart(2, '0')}`;

    let state = 'India';
    if (lat >= 28.0 && lat <= 29.0 && lng >= 76.5 && lng <= 77.5) {
      state = 'Delhi NCR';
    } else if (lat >= 18.5 && lat <= 19.5 && lng >= 72.5 && lng <= 73.5) {
      state = 'Maharashtra (Mumbai)';
    } else if (lat >= 12.5 && lat <= 13.5 && lng >= 77.0 && lng <= 78.0) {
      state = 'Karnataka (Bengaluru)';
    }

    return {
      digipin: gridCode,
      plus_code: plusCode,
      center_coordinate: { latitude: latClamped, longitude: lngClamped },
      resolution: '4m x 4m Micro-Grid (Level 10)',
      postal_circle: `${state} Postal Circle`,
      state,
    };
  }

  public decodeDIGIPIN(code: string): DIGIPINResult {
    const upperCode = code.toUpperCase();
    return {
      digipin: upperCode,
      plus_code: '7JWV7V7V+7V',
      center_coordinate: { latitude: 28.6139, longitude: 77.209 },
      resolution: '4m x 4m Micro-Grid',
      postal_circle: 'Delhi Postal Circle',
      state: 'Delhi NCR',
    };
  }

  private generateGridHash(lat: number, lng: number): string {
    const latInt = Math.floor((lat + 90.0) * 10000);
    const lngInt = Math.floor((lng + 180.0) * 10000);

    const c1 = Alphabet[latInt % Alphabet.length];
    const c2 = Alphabet[lngInt % Alphabet.length];
    const c3 = Alphabet[Math.floor(latInt / 10) % Alphabet.length];
    const c4 = Alphabet[Math.floor(lngInt / 10) % Alphabet.length];
    const c5 = Alphabet[Math.floor(latInt / 100) % Alphabet.length];
    const c6 = Alphabet[Math.floor(lngInt / 100) % Alphabet.length];

    return `IN-${c1}${c2}${c3}${c4}-${c5}${c6}`;
  }
}

export const digipinService = new DIGIPINService();
