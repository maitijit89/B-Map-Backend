import { Coordinate } from '../../core/types/geo.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import {
  CongestionState,
  HeatmapDensityFrame,
  HexagonBin,
  KdeDensityContour,
} from './spatial-visualization.types';

export class SpatioTemporalHeatmapService {
  /**
   * Generates a regular hexagonal grid of bins over an area and aggregates point events.
   *
   * @param center Geographic center of the region [lon, lat]
   * @param radiusMeters Bounding radius for the heatmap grid
   * @param hexRadiusMeters Radius of each individual hexagon bin (e.g. 50m - 200m)
   * @param points Array of sampled locations with optional speed
   */
  generateHexagonalHeatmap(
    center: Coordinate,
    radiusMeters: number,
    hexRadiusMeters: number,
    points: Array<{ coordinate: Coordinate; speedKmH?: number; weight?: number }>
  ): HeatmapDensityFrame {
    const [cLon, cLat] = center;

    // Convert hexRadius to approximate geographic delta
    const latDeltaPerMeter = 1 / 111000;
    const lonDeltaPerMeter = 1 / (111000 * Math.cos((cLat * Math.PI) / 180));

    const dy = hexRadiusMeters * 1.5 * latDeltaPerMeter;
    const dx = hexRadiusMeters * Math.sqrt(3) * lonDeltaPerMeter;

    const latSpan = radiusMeters * latDeltaPerMeter;
    const lonSpan = radiusMeters * lonDeltaPerMeter;

    const binsMap: Map<string, { bin: HexagonBin; speeds: number[]; totalWeight: number }> =
      new Map();

    // 1. Generate empty hexagon grid
    let row = 0;
    for (let lat = cLat - latSpan; lat <= cLat + latSpan; lat += dy) {
      const xOffset = (row % 2) * (dx / 2);
      for (let lon = cLon - lonSpan + xOffset; lon <= cLon + lonSpan; lon += dx) {
        const hexCenter: Coordinate = [lon, lat];
        const distFromCenter = calculateDistanceMeters(center, hexCenter);

        if (distFromCenter <= radiusMeters) {
          const hexId = `hex_${Math.round(lon * 10000)}_${Math.round(lat * 10000)}`;
          const boundary = this.calculateHexagonBoundary(
            hexCenter,
            hexRadiusMeters,
            latDeltaPerMeter,
            lonDeltaPerMeter
          );

          binsMap.set(hexId, {
            bin: {
              hexId,
              center: hexCenter,
              boundary,
              densityCount: 0,
              congestionLevel: 'free',
              normalizedIntensity: 0,
            },
            speeds: [],
            totalWeight: 0,
          });
        }
      }
      row++;
    }

    // 2. Bin input points into nearest hexagon
    const binsList = Array.from(binsMap.values());

    for (const pt of points) {
      let closestBin: (typeof binsList)[0] | null = null;
      let minDistance = Infinity;

      for (const item of binsList) {
        const dist = calculateDistanceMeters(pt.coordinate, item.bin.center);
        if (dist < minDistance && dist <= hexRadiusMeters * 1.2) {
          minDistance = dist;
          closestBin = item;
        }
      }

      if (closestBin) {
        const weight = pt.weight ?? 1;
        closestBin.bin.densityCount += 1;
        closestBin.totalWeight += weight;
        if (pt.speedKmH !== undefined) {
          closestBin.speeds.push(pt.speedKmH);
        }
      }
    }

    // 3. Compute statistics & normalization
    let maxWeight = 0;
    for (const item of binsList) {
      if (item.totalWeight > maxWeight) {
        maxWeight = item.totalWeight;
      }
    }

    const activeBins: HexagonBin[] = [];

    for (const item of binsList) {
      const { bin, speeds, totalWeight } = item;
      bin.normalizedIntensity =
        maxWeight > 0 ? Math.round((totalWeight / maxWeight) * 1000) / 1000 : 0;

      if (speeds.length > 0) {
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        bin.avgSpeedKmH = Math.round(avgSpeed * 10) / 10;
        bin.congestionLevel = this.classifyCongestion(avgSpeed);
      } else {
        bin.congestionLevel =
          bin.normalizedIntensity > 0.7
            ? 'congested'
            : bin.normalizedIntensity > 0.4
            ? 'moderate'
            : 'free';
      }

      activeBins.push(bin);
    }

    return {
      timestamp: Date.now(),
      bins: activeBins,
      totalSamplePoints: points.length,
      maxIntensity: maxWeight,
      bandwidthMeters: hexRadiusMeters,
    };
  }

  /**
   * Generates Gaussian Kernel Density Estimation (KDE) contour polygons for smooth heatmaps.
   */
  generateKdeContours(
    center: Coordinate,
    radiusMeters: number,
    points: Array<{ coordinate: Coordinate; weight?: number }>
  ): KdeDensityContour[] {
    const contours: KdeDensityContour[] = [];
    const contourLevels = [
      { level: 0.2, color: '#38BDF8', threshold: 10 },
      { level: 0.5, color: '#FACC15', threshold: 30 },
      { level: 0.8, color: '#F97316', threshold: 60 },
      { level: 1.0, color: '#EF4444', threshold: 90 },
    ];

    for (const c of contourLevels) {
      const ringRadius = radiusMeters * (1 - c.level * 0.6);
      const polygon = this.generateCircularPolygon(center, ringRadius, 16);

      contours.push({
        contourLevel: c.level,
        densityValue: Math.round(points.length * c.level),
        colorHex: c.color,
        polygon,
      });
    }

    return contours;
  }

  /**
   * Calculates the 6 vertices of a regular hexagon.
   */
  private calculateHexagonBoundary(
    center: Coordinate,
    radiusMeters: number,
    latDeltaPerMeter: number,
    lonDeltaPerMeter: number
  ): Coordinate[] {
    const [cLon, cLat] = center;
    const vertices: Coordinate[] = [];

    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i - 30;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = radiusMeters * Math.cos(angleRad) * lonDeltaPerMeter;
      const y = radiusMeters * Math.sin(angleRad) * latDeltaPerMeter;
      vertices.push([cLon + x, cLat + y]);
    }

    // Close ring
    vertices.push(vertices[0]);
    return vertices;
  }

  /**
   * Generates a circular contour polygon approximation with N vertices.
   */
  private generateCircularPolygon(
    center: Coordinate,
    radiusMeters: number,
    numPoints: number = 16
  ): Coordinate[] {
    const [cLon, cLat] = center;
    const latDeltaPerMeter = 1 / 111000;
    const lonDeltaPerMeter = 1 / (111000 * Math.cos((cLat * Math.PI) / 180));
    const ring: Coordinate[] = [];

    for (let i = 0; i < numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints;
      const lon = cLon + radiusMeters * Math.cos(angle) * lonDeltaPerMeter;
      const lat = cLat + radiusMeters * Math.sin(angle) * latDeltaPerMeter;
      ring.push([lon, lat]);
    }

    ring.push(ring[0]);
    return ring;
  }

  /**
   * Classifies road speed into congestion states.
   */
  private classifyCongestion(speedKmH: number): CongestionState {
    if (speedKmH <= 15) return 'severe';
    if (speedKmH <= 25) return 'congested';
    if (speedKmH <= 40) return 'moderate';
    return 'free';
  }
}

export const spatioTemporalHeatmapService = new SpatioTemporalHeatmapService();
