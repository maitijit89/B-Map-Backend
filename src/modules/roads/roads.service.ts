import { calculateDistance, LatLng } from '../../core/utils/response';
import { SnappedPoint, SpeedLimitItem } from './roads.types';

export class RoadsService {
  public snapToRoads(points: LatLng[], interpolate = true): SnappedPoint[] {
    if (!points || points.length === 0) {
      return [];
    }

    const snapped: SnappedPoint[] = points.map((pt, i) => ({
      location: {
        latitude: Math.round(pt.latitude * 1e5) / 1e5,
        longitude: Math.round(pt.longitude * 1e5) / 1e5,
      },
      original_index: i,
      place_id: `road_seg_${i + 1}`,
    }));

    if (interpolate && points.length >= 2) {
      const interpolated: SnappedPoint[] = [];
      for (let i = 0; i < snapped.length - 1; i++) {
        const p1 = snapped[i];
        const p2 = snapped[i + 1];
        interpolated.push(p1);

        const dM = calculateDistance(
          p1.location.latitude,
          p1.location.longitude,
          p2.location.latitude,
          p2.location.longitude
        );

        if (dM > 50.0) {
          const midPt: LatLng = {
            latitude: (p1.location.latitude + p2.location.latitude) / 2.0,
            longitude: (p1.location.longitude + p2.location.longitude) / 2.0,
          };
          interpolated.push({
            location: midPt,
            original_index: -1,
            place_id: p1.place_id,
          });
        }
      }
      interpolated.push(snapped[snapped.length - 1]);
      return interpolated;
    }

    return snapped;
  }

  public getSpeedLimits(points: LatLng[]): SpeedLimitItem[] {
    return points.map((pt, i) => ({
      place_id: `road_seg_${i + 1}`,
      speed_limit_kmh: 50.0,
      unit: 'KPH',
      road_name: `Point ${pt.latitude.toFixed(4)}, ${pt.longitude.toFixed(4)}`,
    }));
  }
}

export const roadsService = new RoadsService();
