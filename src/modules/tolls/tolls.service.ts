import { calculateDistance, LatLng } from '../../core/utils/response';
import {
  TollCalculationRequest,
  TollCalculationResponse,
  TollPlaza,
} from './tolls.types';

export class TollService {
  private readonly plazas: TollPlaza[] = [
    {
      id: 'toll_kherki_daula',
      name: 'Kherki Daula Toll Plaza',
      highway: 'NH-48 (Delhi-Jaipur)',
      location: { latitude: 28.4067, longitude: 76.9854 },
      singleTripINR: 80.0,
      returnTripINR: 120.0,
      monthlyPassINR: 920.0,
      isFASTagActive: true,
      operator: 'NHAI',
    },
    {
      id: 'toll_shahjahanpur',
      name: 'Shahjahanpur Toll Plaza',
      highway: 'NH-48 (Rajasthan Border)',
      location: { latitude: 28.0264, longitude: 76.4357 },
      singleTripINR: 175.0,
      returnTripINR: 260.0,
      monthlyPassINR: 1850.0,
      isFASTagActive: true,
      operator: 'NHAI',
    },
    {
      id: 'toll_panipat_elevated',
      name: 'Panipat Elevated Toll Plaza',
      highway: 'NH-44 (Grand Trunk Road)',
      location: { latitude: 29.3872, longitude: 76.9681 },
      singleTripINR: 45.0,
      returnTripINR: 65.0,
      monthlyPassINR: 650.0,
      isFASTagActive: true,
      operator: 'NHAI',
    },
    {
      id: 'toll_jewar',
      name: 'Jewar Toll Plaza',
      highway: 'Yamuna Expressway',
      location: { latitude: 28.1287, longitude: 77.5562 },
      singleTripINR: 165.0,
      returnTripINR: 245.0,
      monthlyPassINR: 2100.0,
      isFASTagActive: true,
      operator: 'YEIDA',
    },
    {
      id: 'toll_khalapur',
      name: 'Khalapur Toll Plaza',
      highway: 'Mumbai-Pune Expressway',
      location: { latitude: 18.7915, longitude: 73.2842 },
      singleTripINR: 320.0,
      returnTripINR: 480.0,
      monthlyPassINR: 3200.0,
      isFASTagActive: true,
      operator: 'MSRDC',
    },
    {
      id: 'toll_attibele',
      name: 'Attibele Toll Plaza',
      highway: 'NH-44 (Hosur-Bangalore)',
      location: { latitude: 12.782, longitude: 77.7712 },
      singleTripINR: 35.0,
      returnTripINR: 50.0,
      monthlyPassINR: 450.0,
      isFASTagActive: true,
      operator: 'NHAI',
    },
  ];

  public calculateTolls(req: TollCalculationRequest): TollCalculationResponse {
    const vClassRaw = String(req.vehicleType ?? req.vehicle_class ?? 'CAR_JEEP_VAN').toUpperCase();
    const isReturn = Boolean(req.isReturnTrip ?? req.is_return_trip ?? false);

    // Two-wheelers are 100% exempt from toll fees across Indian National Highways
    if (vClassRaw === 'TWO_WHEELER') {
      return {
        totalTollINR: 0,
        totalPlazasCount: 0,
        vehicleType: 'TWO_WHEELER',
        fastagSavingsINR: 0,
        plazas: [],
        expresswaysCrossed: [],
        note: 'Two-wheelers (Motorcycles/Scooters) are 100% exempt from toll fees across all NHAI National Highways in India.',
      };
    }

    const multiplier = this.getVehicleMultiplier(vClassRaw);
    const matchedPlazas: TollPlaza[] = [];
    const expresswaySet = new Set<string>();
    let totalFee = 0;

    const coords = req.routeCoordinates ?? [];

    if (coords.length > 0) {
      for (const plaza of this.plazas) {
        for (const pt of coords) {
          const dMeters = calculateDistance(
            plaza.location.latitude,
            plaza.location.longitude,
            pt.latitude,
            pt.longitude
          );
          if (dMeters <= 800) {
            const baseFee = isReturn ? plaza.returnTripINR : plaza.singleTripINR;
            totalFee += baseFee * multiplier;
            matchedPlazas.push(plaza);
            expresswaySet.add(plaza.highway);
            break;
          }
        }
      }
    }

    // Corridors lookup by origin/destination if routeCoordinates empty
    if (matchedPlazas.length === 0) {
      const orig = String(req.origin ?? '').toLowerCase();
      const dest = String(req.destination ?? '').toLowerCase();

      if (
        (orig.includes('delhi') && dest.includes('agra')) ||
        (orig.includes('agra') && dest.includes('delhi'))
      ) {
        const p = this.plazas.find((x) => x.id === 'toll_jewar')!;
        const fee = (isReturn ? p.returnTripINR : p.singleTripINR) * multiplier;
        totalFee += fee;
        matchedPlazas.push(p);
        expresswaySet.add(p.highway);
      } else if (
        (orig.includes('delhi') && dest.includes('jaipur')) ||
        (orig.includes('jaipur') && dest.includes('delhi'))
      ) {
        for (const pid of ['toll_kherki_daula', 'toll_shahjahanpur']) {
          const p = this.plazas.find((x) => x.id === pid)!;
          const fee = (isReturn ? p.returnTripINR : p.singleTripINR) * multiplier;
          totalFee += fee;
          matchedPlazas.push(p);
          expresswaySet.add(p.highway);
        }
      } else {
        const p = this.plazas[0];
        const fee = (isReturn ? p.returnTripINR : p.singleTripINR) * multiplier;
        totalFee += fee;
        matchedPlazas.push(p);
        expresswaySet.add(p.highway);
      }
    }

    return {
      totalTollINR: Math.round(totalFee * 100) / 100,
      totalPlazasCount: matchedPlazas.length,
      vehicleType: vClassRaw,
      fastagSavingsINR: Math.round(totalFee * 100) / 100,
      plazas: matchedPlazas,
      expresswaysCrossed: Array.from(expresswaySet),
    };
  }

  public getNearbyTollPlazas(lat: number, lng: number, radiusKm = 50.0): TollPlaza[] {
    const nearby: TollPlaza[] = [];
    for (const p of this.plazas) {
      const distMeters = calculateDistance(lat, lng, p.location.latitude, p.location.longitude);
      if (distMeters / 1000.0 <= radiusKm) {
        nearby.push(p);
      }
    }
    return nearby.length > 0 ? nearby : [this.plazas[0]];
  }

  private getVehicleMultiplier(vClass: string): number {
    switch (vClass) {
      case 'CAR':
      case 'CAR_JEEP_VAN':
        return 1.0;
      case 'LCV':
        return 1.6;
      case 'BUS':
      case 'TRUCK':
      case 'BUS_TRUCK_2AXLE':
        return 3.35;
      case '3AXLE_COMMERCIAL':
        return 3.65;
      case 'MULTI_AXLE':
      case '4_6_AXLE':
        return 5.25;
      case '7_PLUS_AXLE':
        return 6.4;
      default:
        return 1.0;
    }
  }

  public listAllPlazas(): TollPlaza[] {
    return [...this.plazas];
  }

  public addPlaza(plaza: TollPlaza): TollPlaza {
    const existingIdx = this.plazas.findIndex((p) => p.id === plaza.id);
    if (existingIdx !== -1) {
      this.plazas[existingIdx] = plaza;
    } else {
      this.plazas.push(plaza);
    }
    return plaza;
  }

  public updatePlaza(id: string, updates: Partial<TollPlaza>): TollPlaza | null {
    const found = this.plazas.find((p) => p.id === id);
    if (!found) return null;
    Object.assign(found, updates);
    return found;
  }

  public deletePlaza(id: string): boolean {
    const idx = this.plazas.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.plazas.splice(idx, 1);
      return true;
    }
    return false;
  }
}

export const tollService = new TollService();
