import * as turf from '@turf/turf';
import { Coordinate, GeoJsonLineString, OffRouteDetectionResult } from '../types/geo.types';

/**
 * Calculates the great-circle distance between two coordinates in meters.
 * @param from [longitude, latitude]
 * @param to [longitude, latitude]
 */
export const calculateDistanceMeters = (from: Coordinate, to: Coordinate): number => {
  const fromPt = turf.point(from);
  const toPt = turf.point(to);
  return turf.distance(fromPt, toPt, { units: 'meters' });
};

/**
 * Computes bearing (compass direction in degrees -180..180) from point A to point B.
 */
export const calculateBearing = (from: Coordinate, to: Coordinate): number => {
  const fromPt = turf.point(from);
  const toPt = turf.point(to);
  return turf.bearing(fromPt, toPt);
};

/**
 * Checks if a current GPS coordinate has deviated beyond a threshold from the planned route.
 * @param currentLoc [longitude, latitude]
 * @param routeGeometry GeoJsonLineString
 * @param thresholdMeters Maximum acceptable deviation before declaring off-route
 */
export const checkOffRoute = (
  currentLoc: Coordinate,
  routeGeometry: GeoJsonLineString,
  thresholdMeters: number = 40
): OffRouteDetectionResult => {
  const pt = turf.point(currentLoc);
  const line = turf.lineString(routeGeometry.coordinates);

  // Find nearest point on the line
  const snapped = turf.nearestPointOnLine(line, pt);
  const distanceKm = snapped.properties.dist ?? 0;
  const distanceMeters = distanceKm * 1000;

  const snappedCoords: Coordinate = [
    snapped.geometry.coordinates[0],
    snapped.geometry.coordinates[1],
  ];

  return {
    isOffRoute: distanceMeters > thresholdMeters,
    distanceFromRouteMeters: Math.round(distanceMeters * 10) / 10,
    nearestPointOnRoute: snappedCoords,
  };
};

/**
 * Validates coordinate pair: [longitude, latitude]
 */
export const isValidCoordinate = (coords: any): coords is Coordinate => {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lon, lat] = coords;
  return (
    typeof lon === 'number' &&
    typeof lat === 'number' &&
    !isNaN(lon) &&
    !isNaN(lat) &&
    lon >= -180 &&
    lon <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
};
