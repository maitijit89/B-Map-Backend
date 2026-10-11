import { Coordinate, GeoJsonLineString } from './geo.types';

export interface OsrmManeuver {
  bearing_after: number;
  bearing_before: number;
  location: Coordinate;
  type: string;
  modifier?: string;
  exit?: number;
}

export interface OsrmStep {
  distance: number;
  duration: number;
  geometry: GeoJsonLineString | string;
  name: string;
  mode: string;
  maneuver: OsrmManeuver;
  weight: number;
  ref?: string;
  pronunciation?: string;
  destinations?: string;
  rotary_name?: string;
}

export interface OsrmLeg {
  distance: number;
  duration: number;
  weight: number;
  summary: string;
  steps: OsrmStep[];
}

export interface OsrmRoute {
  distance: number; // in meters
  duration: number; // in seconds
  weight: number;
  weight_name: string;
  geometry: GeoJsonLineString | string;
  legs: OsrmLeg[];
}

export interface OsrmWaypoint {
  hint: string;
  distance: number;
  name: string;
  location: Coordinate;
}

export interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes: OsrmRoute[];
  waypoints: OsrmWaypoint[];
}

export interface OsrmMatchWaypoint extends OsrmWaypoint {
  matchings_index: number;
  waypoint_index: number;
  confidence?: number;
}

export interface OsrmMatchResponse {
  code: string;
  matchings: OsrmRoute[];
  tracepoints: (OsrmMatchWaypoint | null)[];
}

export interface OsrmTripResponse {
  code: string;
  trips: OsrmRoute[];
  waypoints: OsrmWaypoint[];
}

export interface OsrmTableResponse {
  code: string;
  durations: (number | null)[][];
  distances?: (number | null)[][];
  sources: OsrmWaypoint[];
  destinations: OsrmWaypoint[];
}

export interface DirectionsQueryOptions {
  profile?: 'driving' | 'bike' | 'foot';
  coordinates: Coordinate[]; // At least 2 points: [origin, destination] or [origin, ...waypoints, destination]
  steps?: boolean;
  geometries?: 'geojson' | 'polyline' | 'polyline6';
  overview?: 'full' | 'simplified' | 'false';
  alternatives?: boolean | number;
  annotations?: boolean | string;
  language?: string;
}
