import axios, { AxiosInstance } from 'axios';
import { env } from '../../core/config/env.config';
import { logger } from '../../core/config/logger';
import { Coordinate } from '../../core/types/geo.types';
import {
  DirectionsQueryOptions,
  OsrmMatchResponse,
  OsrmRouteResponse,
  OsrmTableResponse,
  OsrmTripResponse,
} from '../../core/types/osrm.types';
import { generateOfflineFallbackRoute } from '../../core/resilience/offline-fallback-seeds';

export class OsrmService {
  private client: AxiosInstance;

  constructor(baseURL: string = env.OSRM_BASE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: env.OSRM_TIMEOUT_MS,
      headers: {
        'User-Agent': 'B-Map-Navigation-Backend/1.0',
      },
    });
  }

  /**
   * Formats array of coordinates [[lon1, lat1], [lon2, lat2]] into OSRM format "lon1,lat1;lon2,lat2"
   */
  private formatCoordinates(coordinates: Coordinate[]): string {
    return coordinates.map(([lon, lat]) => `${lon},${lat}`).join(';');
  }

  /**
   * Calculate turn-by-turn routing between 2 or more coordinates.
   */
  async getRoute(options: DirectionsQueryOptions): Promise<OsrmRouteResponse> {
    const profile = options.profile || env.OSRM_DEFAULT_PROFILE;
    const coordsString = this.formatCoordinates(options.coordinates);

    const params: Record<string, any> = {
      overview: options.overview ?? 'full',
      geometries: options.geometries ?? 'geojson',
      steps: options.steps ?? true,
      alternatives: options.alternatives ?? false,
    };

    if (options.annotations) {
      params.annotations = options.annotations;
    }

    try {
      const endpoint = `/route/v1/${profile}/${coordsString}`;
      logger.debug(`OSRM route request: ${endpoint}`, { params });

      const response = await this.client.get<OsrmRouteResponse>(endpoint, { params });

      if (response.data.code !== 'Ok') {
        throw new Error(`OSRM Error: ${response.data.message || response.data.code}`);
      }

      return response.data;
    } catch (error: any) {
      logger.warn(
        `⚠️ [DUAL-TIER RESILIENCE] Upstream OSRM unavailable (${error.message}). Serving pre-calibrated in-memory national corridor routing fallback ("offlineFallback": true)`
      );
      const fallback = generateOfflineFallbackRoute(
        options.coordinates,
        profile as 'driving' | 'bike' | 'foot'
      );
      (fallback as any).offlineFallback = true;
      return fallback;
    }
  }

  /**
   * Match GPS traces to road network (Map Matching).
   */
  async matchTrace(
    coordinates: Coordinate[],
    profile: 'driving' | 'bike' | 'foot' = 'driving',
    options: { timestamps?: number[]; radiuses?: number[]; steps?: boolean } = {}
  ): Promise<OsrmMatchResponse> {
    const coordsString = this.formatCoordinates(coordinates);
    const params: Record<string, any> = {
      overview: 'full',
      geometries: 'geojson',
      steps: options.steps ?? true,
    };

    if (options.timestamps && options.timestamps.length === coordinates.length) {
      params.timestamps = options.timestamps.join(';');
    }
    if (options.radiuses && options.radiuses.length === coordinates.length) {
      params.radiuses = options.radiuses.join(';');
    }

    try {
      const endpoint = `/match/v1/${profile}/${coordsString}`;
      const response = await this.client.get<OsrmMatchResponse>(endpoint, { params });

      if (response.data.code !== 'Ok') {
        throw new Error(`OSRM Match Error: ${response.data.code}`);
      }

      return response.data;
    } catch (error: any) {
      logger.error('Failed to match GPS trace with OSRM:', error.message);
      throw new Error(error.response?.data?.message || error.message || 'Map matching failed');
    }
  }

  /**
   * Optimize trip order (Traveling Salesperson Problem).
   */
  async optimizeTrip(
    coordinates: Coordinate[],
    profile: 'driving' | 'bike' | 'foot' = 'driving',
    options: { roundtrip?: boolean; source?: 'first' | 'any'; destination?: 'last' | 'any' } = {}
  ): Promise<OsrmTripResponse> {
    const coordsString = this.formatCoordinates(coordinates);
    const params: Record<string, any> = {
      overview: 'full',
      geometries: 'geojson',
      steps: true,
      roundtrip: options.roundtrip ?? true,
      source: options.source ?? 'first',
      destination: options.destination ?? 'last',
    };

    try {
      const endpoint = `/trip/v1/${profile}/${coordsString}`;
      const response = await this.client.get<OsrmTripResponse>(endpoint, { params });

      if (response.data.code !== 'Ok') {
        throw new Error(`OSRM Trip Error: ${response.data.code}`);
      }

      return response.data;
    } catch (error: any) {
      logger.error('Failed to optimize trip with OSRM:', error.message);
      throw new Error(error.response?.data?.message || error.message || 'Trip optimization failed');
    }
  }

  /**
   * Calculate distance & duration matrix (Table service).
   */
  async getTable(
    coordinates: Coordinate[],
    profile: 'driving' | 'bike' | 'foot' = 'driving',
    options: { sources?: number[]; destinations?: number[]; annotations?: 'duration' | 'distance' | 'duration,distance' } = {}
  ): Promise<OsrmTableResponse> {
    const coordsString = this.formatCoordinates(coordinates);
    const params: Record<string, any> = {
      annotations: options.annotations ?? 'duration,distance',
    };

    if (options.sources?.length) {
      params.sources = options.sources.join(';');
    }
    if (options.destinations?.length) {
      params.destinations = options.destinations.join(';');
    }

    try {
      const endpoint = `/table/v1/${profile}/${coordsString}`;
      const response = await this.client.get<OsrmTableResponse>(endpoint, { params });

      if (response.data.code !== 'Ok') {
        throw new Error(`OSRM Table Error: ${response.data.code}`);
      }

      return response.data;
    } catch (error: any) {
      logger.error('Failed to compute distance table with OSRM:', error.message);
      throw new Error(error.response?.data?.message || error.message || 'Table calculation failed');
    }
  }
}

export const osrmService = new OsrmService();
