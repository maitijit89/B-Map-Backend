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
 * Computes Geodesic Cross-Track Error (XTD) using great-circle Haversine spherical geometry.
 * Mathematical Formulation:
 * XTD = arcsin(sin(d_13 / R) * sin(theta_13 - theta_12)) * R
 * Where:
 * - R = 6,371,000 meters (mean Earth spherical radius)
 * - d_13 = great-circle distance from segment start P1 to vehicle position P3
 * - theta_13 = forward azimuth bearing from P1 to P3
 * - theta_12 = forward azimuth bearing from P1 to segment end P2
 */
export const calculateGeodesicXtdMeters = (
  currentLoc: Coordinate, // P3 [lon, lat]
  segmentStart: Coordinate, // P1 [lon, lat]
  segmentEnd: Coordinate, // P2 [lon, lat]
  earthRadiusMeters: number = 6371000
): number => {
  const d13 = calculateDistanceMeters(segmentStart, currentLoc);
  if (d13 === 0) return 0;

  const theta13 = (calculateBearing(segmentStart, currentLoc) * Math.PI) / 180;
  const theta12 = (calculateBearing(segmentStart, segmentEnd) * Math.PI) / 180;

  const sinRatio = Math.sin(d13 / earthRadiusMeters) * Math.sin(theta13 - theta12);
  const clampedRatio = Math.max(-1.0, Math.min(1.0, sinRatio));
  const xtd = Math.asin(clampedRatio) * earthRadiusMeters;

  return Math.abs(Math.round(xtd * 10) / 10);
};

/**
 * Checks if a current GPS coordinate has deviated beyond a threshold from the planned route.
 * Evaluates geodesic Cross-Track Error (XTD) with standard 40m threshold.
 * @param currentLoc [longitude, latitude]
 * @param routeGeometry GeoJsonLineString
 * @param thresholdMeters Maximum acceptable deviation before declaring off-route (default: 40m)
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
