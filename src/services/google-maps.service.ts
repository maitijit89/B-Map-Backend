import axios from 'axios';
import { env } from '../core/config/env.config';
import { logger } from '../core/config/logger';
import { Coordinate } from '../core/types/geo.types';

export interface GooglePlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  coordinate: Coordinate;
  types: string[];
  rating?: number;
}

export class GoogleMapsService {
  private mapsApiKey: string;
  private placesApiKey: string;

  constructor() {
    this.mapsApiKey = env.GOOGLE_MAPS_API_KEY;
    this.placesApiKey = env.GOOGLE_PLACES_API_KEY;
  }

  /**
   * Geocodes an address string to [longitude, latitude] using Google Geocoding API.
   */
  async geocodeAddress(address: string): Promise<Coordinate | null> {
    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address,
          key: this.mapsApiKey,
        },
        timeout: 5000,
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return [location.lng, location.lat];
      }
      return null;
    } catch (err: any) {
      logger.warn(`Google Geocode error for "${address}":`, err.message);
      return null;
    }
  }

  /**
   * Reverse geocodes [longitude, latitude] into formatted address.
   */
  async reverseGeocode(coordinate: Coordinate): Promise<string | null> {
    try {
      const [lng, lat] = coordinate;
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${lat},${lng}`,
          key: this.mapsApiKey,
        },
        timeout: 5000,
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }
      return null;
    } catch (err: any) {
      logger.warn(`Google Reverse Geocode error for [${coordinate.join(', ')}]:`, err.message);
      return null;
    }
  }

  /**
   * Google Places Autocomplete search query.
   */
  async autocompletePlaces(query: string, proximity?: Coordinate): Promise<GooglePlaceResult[]> {
    try {
      const params: Record<string, any> = {
        input: query,
        key: this.placesApiKey,
      };

      if (proximity) {
        params.location = `${proximity[1]},${proximity[0]}`;
        params.radius = 25000; // 25 km bias
      }

      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        { params, timeout: 5000 }
      );

      if (response.data.status === 'OK') {
        return response.data.predictions.map((p: any) => ({
          placeId: p.place_id,
          name: p.structured_formatting?.main_text || p.description,
          formattedAddress: p.description,
          coordinate: [0, 0],
          types: p.types || [],
        }));
      }
      return [];
    } catch (err: any) {
      logger.warn(`Google Places Autocomplete error for "${query}":`, err.message);
      return [];
    }
  }
}

export const googleMapsService = new GoogleMapsService();
