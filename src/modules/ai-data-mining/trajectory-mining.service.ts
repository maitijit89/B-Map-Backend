import crypto from 'crypto';
import { Coordinate } from '../../core/types/geo.types';
import {
  StayPoint,
  StayPointCluster,
  TrajectoryPoint,
} from './data-mining.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';

export class TrajectoryMiningService {
  /**
   * Extracts stay points from a sequential GPS trajectory.
   * A stay point occurs when distance traveled < maxDistanceMeters for duration >= minDurationSeconds.
   */
  extractStayPoints(
    points: TrajectoryPoint[],
    minDurationSeconds: number = 300, // 5 minutes
    maxDistanceMeters: number = 50 // 50 meters
  ): StayPoint[] {
    const stayPoints: StayPoint[] = [];
    const n = points.length;
    let i = 0;

    while (i < n) {
      let j = i + 1;
      while (j < n) {
        const fromCoord: Coordinate = [points[i].longitude, points[i].latitude];
        const toCoord: Coordinate = [points[j].longitude, points[j].latitude];
        const dist = calculateDistanceMeters(fromCoord, toCoord);

        if (dist > maxDistanceMeters) {
          const duration = (points[j - 1].timestamp - points[i].timestamp) / 1000.0;
          if (duration >= minDurationSeconds) {
            // Compute centroid
            let sumLon = 0;
            let sumLat = 0;
            let sumSpeed = 0;
            const count = j - i;

            for (let k = i; k < j; k++) {
              sumLon += points[k].longitude;
              sumLat += points[k].latitude;
              sumSpeed += points[k].speedMps;
            }

            const centroid: Coordinate = [
              Math.round((sumLon / count) * 1000000) / 1000000,
              Math.round((sumLat / count) * 1000000) / 1000000,
            ];

            stayPoints.push({
              stayPointId: `stay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              coordinates: centroid,
              startTime: points[i].timestamp,
              endTime: points[j - 1].timestamp,
              durationSeconds: Math.round(duration),
              averageSpeedMps: Math.round((sumSpeed / count) * 10) / 10,
              rawPointCount: count,
            });

            i = j;
            break;
          } else {
            i++;
            break;
          }
        }
        j++;
      }

      if (j >= n) {
        const duration = (points[n - 1].timestamp - points[i].timestamp) / 1000.0;
        if (duration >= minDurationSeconds) {
          let sumLon = 0;
          let sumLat = 0;
          const count = n - i;
          for (let k = i; k < n; k++) {
            sumLon += points[k].longitude;
            sumLat += points[k].latitude;
          }
          stayPoints.push({
            stayPointId: `stay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            coordinates: [
              Math.round((sumLon / count) * 1000000) / 1000000,
              Math.round((sumLat / count) * 1000000) / 1000000,
            ],
            startTime: points[i].timestamp,
            endTime: points[n - 1].timestamp,
            durationSeconds: Math.round(duration),
            averageSpeedMps: 0,
            rawPointCount: count,
          });
        }
        break;
      }
    }

    return stayPoints;
  }

  /**
   * Spatio-Temporal Clustering (DBSCAN) over multi-user stay points:
   * Groups stay points within epsDistanceMeters to identify frequent visit hotspots & candidate POIs.
   */
  clusterStayPoints(
    stayPoints: StayPoint[],
    epsDistanceMeters: number = 40,
    minPoints: number = 2
  ): StayPointCluster[] {
    const clusters: StayPointCluster[] = [];
    const visited = new Set<string>();

    for (let i = 0; i < stayPoints.length; i++) {
      const p = stayPoints[i];
      if (visited.has(p.stayPointId)) continue;

      // Find neighbors
      const neighbors: StayPoint[] = [p];
      for (let j = 0; j < stayPoints.length; j++) {
        if (i === j) continue;
        const q = stayPoints[j];
        if (calculateDistanceMeters(p.coordinates, q.coordinates) <= epsDistanceMeters) {
          neighbors.push(q);
        }
      }

      if (neighbors.length >= minPoints) {
        neighbors.forEach((n) => visited.add(n.stayPointId));

        let sumLon = 0;
        let sumLat = 0;
        let totalDuration = 0;
        const hourHistogram: Record<number, number> = {};

        for (const n of neighbors) {
          sumLon += n.coordinates[0];
          sumLat += n.coordinates[1];
          totalDuration += n.durationSeconds;

          const hour = new Date(n.startTime).getHours();
          hourHistogram[hour] = (hourHistogram[hour] || 0) + 1;
        }

        const count = neighbors.length;
        const centroid: Coordinate = [
          Math.round((sumLon / count) * 1000000) / 1000000,
          Math.round((sumLat / count) * 1000000) / 1000000,
        ];

        // Find peak hour
        let peakHour = 12;
        let maxHourCount = 0;
        for (const [h, cnt] of Object.entries(hourHistogram)) {
          if (cnt > maxHourCount) {
            maxHourCount = cnt;
            peakHour = parseInt(h, 10);
          }
        }

        // Infer Category from dwell time and hour
        const avgDwellHours = totalDuration / count / 3600.0;
        let estimatedCategory = 'restaurant';
        if (avgDwellHours < 0.3) estimatedCategory = 'fuel';
        else if (avgDwellHours >= 0.5 && avgDwellHours <= 2.0) estimatedCategory = 'restaurant';
        else if (avgDwellHours > 2.0 && avgDwellHours <= 4.0) estimatedCategory = 'shopping';
        else if (avgDwellHours > 5.0 && peakHour >= 9 && peakHour <= 18) estimatedCategory = 'workplace';
        else if (avgDwellHours > 5.0) estimatedCategory = 'residence';

        clusters.push({
          clusterId: `cluster_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          centroid,
          stayPointCount: count,
          totalDwellHours: Math.round(totalDuration / 3600 * 10) / 10,
          estimatedCategory,
          confidence: Math.min(0.98, 0.6 + count * 0.08),
          peakHourOfDay: peakHour,
        });
      }
    }

    return clusters;
  }

  /**
   * Identifies candidate pick-up / drop-off (PUDO) curbside points from short stops (45s..180s)
   */
  mineEntrances(stayPoints: StayPoint[]): { coordinates: Coordinate; confidence: number }[] {
    const curbsideStops = stayPoints.filter(
      (s) => s.durationSeconds >= 45 && s.durationSeconds <= 240
    );

    return curbsideStops.map((s) => ({
      coordinates: s.coordinates,
      confidence: Math.min(0.95, 0.7 + (s.durationSeconds / 240) * 0.25),
    }));
  }
}

export const trajectoryMiningService = new TrajectoryMiningService();
