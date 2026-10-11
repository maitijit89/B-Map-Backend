export type Coordinate = [number, number]; // [longitude, latitude]

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: Coordinate;
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: Coordinate[];
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: Coordinate[][];
}

export type RoutingProfile = 'driving' | 'bike' | 'foot' | 'car';

export interface LocationPayload {
  userId: string;
  role?: 'driver' | 'rider' | 'navigator';
  longitude: number;
  latitude: number;
  heading?: number;
  speed?: number; // m/s or km/h
  accuracy?: number; // meters
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface NearbyQueryOptions {
  longitude: number;
  latitude: number;
  radiusInMeters: number;
  limit?: number;
  role?: string;
}

export interface NearbyEntityResult {
  userId: string;
  longitude: number;
  latitude: number;
  distanceInMeters: number;
  lastUpdated: number;
  role?: string;
  metadata?: Record<string, any>;
}

export interface OffRouteDetectionResult {
  isOffRoute: boolean;
  distanceFromRouteMeters: number;
  nearestPointOnRoute: Coordinate;
}
