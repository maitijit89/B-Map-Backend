import { calculateDistance } from '../../core/utils/response';
import {
  FleetLocationUpdatePayload,
  FleetTripRequestPayload,
  FleetVehicle,
} from './fleet.types';

export class FleetService {
  private readonly vehicles = new Map<string, FleetVehicle>([
    [
      'DRV_DL_001',
      {
        driver_id: 'DRV_DL_001',
        location: { latitude: 28.6129, longitude: 77.2295 },
        heading: 180.0,
        speed_kmh: 45.0,
        status: 'ONLINE',
      },
    ],
    [
      'DRV_DL_002',
      {
        driver_id: 'DRV_DL_002',
        location: { latitude: 28.62, longitude: 77.21 },
        heading: 90.0,
        speed_kmh: 30.0,
        status: 'ONLINE',
      },
    ],
  ]);

  public updateDriverLocation(p: FleetLocationUpdatePayload): FleetVehicle {
    const entry: FleetVehicle = {
      driver_id: p.driver_id,
      location: { latitude: p.latitude, longitude: p.longitude },
      heading: p.heading ?? 0.0,
      speed_kmh: p.speed_kmh ?? 0.0,
      status: 'ONLINE',
    };
    this.vehicles.set(p.driver_id, entry);
    return entry;
  }

  public getNearbyDrivers(lat: number, lng: number, radiusKm = 5.0): FleetVehicle[] {
    const results: FleetVehicle[] = [];
    for (const v of this.vehicles.values()) {
      const dKm =
        calculateDistance(lat, lng, v.location.latitude, v.location.longitude) /
        1000.0;
      if (dKm <= radiusKm) {
        results.push({
          ...v,
          distance_km: Math.round(dKm * 10) / 10,
        });
      }
    }
    return results.length > 0 ? results : Array.from(this.vehicles.values());
  }

  public requestTrip(req: FleetTripRequestPayload) {
    const dKm =
      calculateDistance(
        req.pickup.latitude,
        req.pickup.longitude,
        req.dropoff.latitude,
        req.dropoff.longitude
      ) / 1000.0;
    const estFare = Math.round((2.5 + dKm * 1.25) * 100) / 100;

    return {
      trip_id: `trip_${Math.random().toString(36).substring(2, 10)}`,
      status: 'REQUESTED',
      rider_id: req.rider_id ?? 'rider_anon',
      pickup: req.pickup,
      dropoff: req.dropoff,
      distance_km: Math.round(dKm * 10) / 10,
      estimated_fare: estFare,
      created_at: new Date().toISOString(),
    };
  }
}

export const fleetService = new FleetService();
