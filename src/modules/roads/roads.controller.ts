import { Request, Response } from 'express';
import { LatLng, sendSuccess } from '../../core/utils/response';
import { roadsService } from './roads.service';

export class RoadsController {
  public async snapToRoads(req: Request, res: Response): Promise<void> {
    const rawPath = req.body.path ?? req.body.points ?? [];
    const points: LatLng[] = rawPath.map((p: any) => ({
      latitude: p.lat ?? p.latitude,
      longitude: p.lng ?? p.longitude,
    }));
    const interpolate = req.body.interpolate !== false;

    const result = roadsService.snapToRoads(points, interpolate);
    sendSuccess(res, result, 'GPS points snapped to road network');
  }

  public async getSpeedLimits(req: Request, res: Response): Promise<void> {
    const pointsQuery = req.query.points as string | undefined;
    let points: LatLng[] = [];
    if (pointsQuery) {
      points = pointsQuery.split('|').map((pair) => {
        const [latStr, lngStr] = pair.split(',');
        return {
          latitude: parseFloat(latStr),
          longitude: parseFloat(lngStr),
        };
      });
    }

    if (points.length === 0) {
      points = [{ latitude: 28.6129, longitude: 77.2295 }];
    }

    const limits = roadsService.getSpeedLimits(points);
    sendSuccess(res, limits, 'Road posted speed limits retrieved');
  }
}

export const roadsController = new RoadsController();
