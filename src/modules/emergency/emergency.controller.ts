import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { emergencyService } from './emergency.service';

export class EmergencyController {
  public async triggerSOS(req: Request, res: Response): Promise<void> {
    const { type, latitude, longitude, currentLocation, vehicle_number, user_phone, message } = req.body;
    const result = emergencyService.triggerSOS({
      type: type ?? 'MEDICAL',
      latitude: latitude ?? currentLocation?.latitude,
      longitude: longitude ?? currentLocation?.longitude,
      currentLocation,
      vehicleNumber: vehicle_number,
      userPhone: user_phone,
      message,
    });
    sendSuccess(res, result, 'Emergency SOS beacon dispatched with 112/1033 helpline integration');
  }

  public async getNearbyFacilities(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6129);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.2295);
    const facilities = emergencyService.getNearbyEmergencyFacilities(lat, lng);
    sendSuccess(res, facilities, 'Nearby 24x7 trauma centers and emergency units retrieved');
  }
}

export const emergencyController = new EmergencyController();
