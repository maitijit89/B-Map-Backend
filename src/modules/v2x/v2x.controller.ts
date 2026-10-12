import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { v2xService } from './v2x.service';

export class V2XController {
  public async getSignal(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const signal = v2xService.getIntersectionSPaT(id);
    sendSuccess(res, signal, 'Traffic signal SPaT telemetry retrieved');
  }

  public async getNearbySignals(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6304);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.2177);
    const radius = Number(req.query.radius_meters ?? req.query.radius ?? 500.0);
    const signals = v2xService.getNearbySignals(lat, lng, radius);
    sendSuccess(res, signals, 'Nearby municipal V2X connected signals retrieved');
  }

  public async calculateGLOSA(req: Request, res: Response): Promise<void> {
    const { vehicle_location, vehicleLocation, speed_kmh, speedKmh, intersection_id, intersectionId } = req.body;
    const loc = vehicleLocation ?? vehicle_location ?? { lat: 28.6129, lng: 77.2295 };
    const speed = Number(speedKmh ?? speed_kmh ?? 40.0);
    const id = String(intersectionId ?? intersection_id ?? 'INT_DEL_CP_01');

    const lat = loc.latitude ?? loc.lat;
    const lng = loc.longitude ?? loc.lng;

    const advisory = v2xService.calculateGLOSA({ latitude: lat, longitude: lng }, speed, id);
    sendSuccess(res, advisory, 'Green Light Optimal Speed Advisory (GLOSA) computed');
  }
}

export const v2xController = new V2XController();
