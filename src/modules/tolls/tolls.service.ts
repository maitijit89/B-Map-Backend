import { calculateDistance, LatLng } from '../../core/utils/response';
import {
  TollCalculationRequest,
  TollCalculationResponse,
  TollPlaza,
} from './tolls.types';

export class TollService {
  private readonly plazas: TollPlaza[] = [
    {
      id: 'toll_sohna_ne4',
      name: 'Sohna Toll Plaza',
      highway: 'Delhi-Mumbai Expressway (NE-4)',
      location: { latitude: 28.2435, longitude: 77.0678 },
      singleTripINR: 95.0,
      returnTripINR: 145.0,
      monthlyPassINR: 950.0,
      isFASTagActive: true,
      operator: 'NHAI',
      totalLanesCount: 14,
      fastagLanesCount: 12,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13],
      cashlessLaneGuidance: 'Lanes 1-6 & 8-13 are 100% Cashless FASTag Dedicated with high-speed 40 km/h RFID overhead gantry sensors. Lane 7 & 14 are hybrid/penalty lanes.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'AUTOMATIC_ANPR_BOOM_BARRIER',
    },
    {
      id: 'toll_bhandarej_ne4',
      name: 'Bhandarej Toll Plaza (Dausa)',
      highway: 'Delhi-Mumbai Expressway (NE-4)',
      location: { latitude: 26.8521, longitude: 76.5412 },
      singleTripINR: 395.0,
      returnTripINR: 590.0,
      monthlyPassINR: 3950.0,
      isFASTagActive: true,
      operator: 'NHAI',
      totalLanesCount: 16,
      fastagLanesCount: 14,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15],
      cashlessLaneGuidance: 'High-speed NE-4 cashless corridor: maintain speed < 30 km/h across green-marked FASTag lanes 1-7.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'AUTOMATIC_ANPR_BOOM_BARRIER',
    },
    {
      id: 'toll_dasna_ne2',
      name: 'Dasna Toll Plaza (Ghaziabad)',
      highway: 'Eastern Peripheral Expressway (NE-2)',
      location: { latitude: 28.6811, longitude: 77.5342 },
      singleTripINR: 110.0,
      returnTripINR: 165.0,
      monthlyPassINR: 1100.0,
      isFASTagActive: true,
      operator: 'NHAI',
      totalLanesCount: 12,
      fastagLanesCount: 10,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11],
      cashlessLaneGuidance: 'NE-2 Closed Toll System: FASTag scanned automatically at entry; final tariff billed at exit interchange.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'AUTOMATIC_ANPR_BOOM_BARRIER',
    },
    {
      id: 'toll_chhajju_ne2',
      name: 'Chhajju Nagar Toll Plaza (Palwal)',
      highway: 'Eastern Peripheral Expressway (NE-2)',
      location: { latitude: 28.1825, longitude: 77.3482 },
      singleTripINR: 140.0,
      returnTripINR: 210.0,
      monthlyPassINR: 1400.0,
      isFASTagActive: true,
      operator: 'NHAI',
      totalLanesCount: 12,
      fastagLanesCount: 10,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11],
      cashlessLaneGuidance: 'NE-2 automated weight-in-motion (WIM) sensors installed on commercial lanes 4, 5, 10, 11.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'AUTOMATIC_ANPR_BOOM_BARRIER',
    },
    {
      id: 'toll_kaniminike_nh275',
      name: 'Kaniminike Toll Plaza (Bidadi)',
      highway: 'Bengaluru-Mysuru Expressway (NH-275)',
      location: { latitude: 12.8214, longitude: 77.4125 },
      singleTripINR: 165.0,
      returnTripINR: 250.0,
      monthlyPassINR: 1650.0,
      isFASTagActive: true,
      operator: 'NHAI',
      totalLanesCount: 14,
      fastagLanesCount: 12,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13],
      cashlessLaneGuidance: 'NH-275 access-controlled expressway: 100% cashless. Ensure FASTag balance > 200 INR before entry gate.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'AUTOMATIC_ANPR_BOOM_BARRIER',
    },
    {
      id: 'toll_sheshagirihalli_nh275',
      name: 'Sheshagirihalli Toll Plaza (Ramanagara)',
      highway: 'Bengaluru-Mysuru Expressway (NH-275)',
      location: { latitude: 12.7245, longitude: 77.2981 },
      singleTripINR: 155.0,
      returnTripINR: 235.0,
      monthlyPassINR: 1550.0,
      isFASTagActive: true,
      operator: 'NHAI',
      totalLanesCount: 12,
      fastagLanesCount: 10,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11],
      cashlessLaneGuidance: 'Cashless electronic tolling with automated number plate recognition (ANPR) active on all through lanes.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'AUTOMATIC_ANPR_BOOM_BARRIER',
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
      totalLanesCount: 16,
      fastagLanesCount: 14,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15],
      cashlessLaneGuidance: 'FASTag and Tag-based cashless electronic lanes active across all central lanes.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'RFID_SINGLE_PASS',
    },
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
      totalLanesCount: 18,
      fastagLanesCount: 16,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17],
      cashlessLaneGuidance: 'FASTag mandatory. Non-FASTag or blacklisted tag vehicles charged double cash penalty in extreme right lane.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'RFID_SINGLE_PASS',
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
      totalLanesCount: 14,
      fastagLanesCount: 12,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13],
      cashlessLaneGuidance: 'Dedicated FASTag lanes with high-gain overhead RFID readers.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'RFID_SINGLE_PASS',
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
      totalLanesCount: 10,
      fastagLanesCount: 8,
      dedicatedFastagLanes: [1, 2, 3, 4, 6, 7, 8, 9],
      cashlessLaneGuidance: 'Keep left lanes 1-4 for seamless FASTag express crossing.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'RFID_SINGLE_PASS',
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
      totalLanesCount: 16,
      fastagLanesCount: 14,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15],
      cashlessLaneGuidance: 'FASTag electronic toll collection active across all lanes.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'AUTOMATIC_ANPR_BOOM_BARRIER',
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
      totalLanesCount: 12,
      fastagLanesCount: 10,
      dedicatedFastagLanes: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11],
      cashlessLaneGuidance: 'Dedicated FASTag lanes operational 24/7.',
      etcStatus: 'OPERATIONAL',
      barrierType: 'RFID_SINGLE_PASS',
    },
  ];

  public calculateTolls(req: TollCalculationRequest): TollCalculationResponse {
    const vClassRaw = String(req.vehicleType ?? req.vehicle_class ?? 'CLASS_4').toUpperCase();
    const isReturn = Boolean(req.isReturnTrip ?? req.is_return_trip ?? false);
    const resolvedClass = this.resolveVehicleClass(vClassRaw);

    // Two-wheelers are 100% exempt from toll fees across Indian National Highways
    if (resolvedClass.code === 'TWO_WHEELER_EXEMPT') {
      return {
        totalTollINR: 0,
        totalPlazasCount: 0,
        vehicleType: 'TWO_WHEELER',
        vehicleClassCode: 'TWO_WHEELER_EXEMPT',
        fastagSavingsINR: 0,
        plazas: [],
        expresswaysCrossed: [],
        cashlessLaneGuidance: [
          'Two-wheelers (Motorcycles, Scooters) are 100% exempt from toll fees across all NHAI National Highways in India. Use dedicated left free bypass lane.',
        ],
        note: 'Two-wheelers are 100% exempt from toll fees across all NHAI National Highways in India.',
      };
    }

    const multiplier = resolvedClass.multiplier;
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
          if (dMeters <= 1200) {
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
        (orig.includes('delhi') && dest.includes('mumbai')) ||
        (orig.includes('mumbai') && dest.includes('delhi'))
      ) {
        for (const pid of ['toll_sohna_ne4', 'toll_bhandarej_ne4']) {
          const p = this.plazas.find((x) => x.id === pid)!;
          const fee = (isReturn ? p.returnTripINR : p.singleTripINR) * multiplier;
          totalFee += fee;
          matchedPlazas.push(p);
          expresswaySet.add(p.highway);
        }
      } else if (
        (orig.includes('delhi') && dest.includes('agra')) ||
        (orig.includes('agra') && dest.includes('delhi'))
      ) {
        const p = this.plazas.find((x) => x.id === 'toll_jewar')!;
        const fee = (isReturn ? p.returnTripINR : p.singleTripINR) * multiplier;
        totalFee += fee;
        matchedPlazas.push(p);
        expresswaySet.add(p.highway);
      } else if (
        (orig.includes('bengaluru') && dest.includes('mysuru')) ||
        (orig.includes('bangalore') && dest.includes('mysore'))
      ) {
        for (const pid of ['toll_kaniminike_nh275', 'toll_sheshagirihalli_nh275']) {
          const p = this.plazas.find((x) => x.id === pid)!;
          const fee = (isReturn ? p.returnTripINR : p.singleTripINR) * multiplier;
          totalFee += fee;
          matchedPlazas.push(p);
          expresswaySet.add(p.highway);
        }
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

    const guidance = matchedPlazas.map(
      (p) => `${p.name} (${p.highway}): ${p.cashlessLaneGuidance || 'Dedicated FASTag lanes operational.'}`
    );

    return {
      totalTollINR: Math.round(totalFee * 100) / 100,
      totalPlazasCount: matchedPlazas.length,
      vehicleType: vClassRaw,
      vehicleClassCode: resolvedClass.code,
      fastagSavingsINR: Math.round(totalFee * 100) / 100,
      plazas: matchedPlazas,
      expresswaysCrossed: Array.from(expresswaySet),
      cashlessLaneGuidance: guidance,
    };
  }

  public resolveVehicleClass(vClass: string): {
    code: 'CLASS_4' | 'CLASS_5' | 'CLASS_6' | 'CLASS_7' | 'CLASS_8' | 'CLASS_9' | 'TWO_WHEELER_EXEMPT';
    multiplier: number;
    description: string;
  } {
    const raw = (vClass || '').trim().toUpperCase();
    if (raw === 'TWO_WHEELER' || raw === '2' || raw === 'BIKE' || raw === 'SCOOTER') {
      return { code: 'TWO_WHEELER_EXEMPT', multiplier: 0, description: 'Motorcycles / Scooters (100% Toll Exempt)' };
    }
    if (raw === 'CLASS_5' || raw === '5' || raw === 'LCV' || raw === 'MINI_BUS') {
      return { code: 'CLASS_5', multiplier: 1.6, description: 'Class 5: Light Commercial Vehicle (LCV) / Mini-Bus' };
    }
    if (raw === 'CLASS_6' || raw === '6' || raw === 'BUS' || raw === 'TRUCK' || raw === 'BUS_TRUCK_2AXLE') {
      return { code: 'CLASS_6', multiplier: 3.35, description: 'Class 6: 2-Axle Bus / 2-Axle Truck' };
    }
    if (raw === 'CLASS_7' || raw === '7' || raw === '3AXLE_COMMERCIAL' || raw === '3AXLE') {
      return { code: 'CLASS_7', multiplier: 3.65, description: 'Class 7: 3-Axle Commercial Vehicle' };
    }
    if (
      raw === 'CLASS_8' ||
      raw === '8' ||
      raw === '4_6_AXLE' ||
      raw === 'MULTI_AXLE' ||
      raw === 'MAV' ||
      raw === 'HCM'
    ) {
      return { code: 'CLASS_8', multiplier: 5.25, description: 'Class 8: 4 to 6-Axle Heavy Construction Machinery / Multi-Axle' };
    }
    if (raw === 'CLASS_9' || raw === '9' || raw === '7_PLUS_AXLE' || raw === 'OVERSIZED' || raw === 'OSV') {
      return { code: 'CLASS_9', multiplier: 6.4, description: 'Class 9: 7 or more Axle Oversized Vehicle' };
    }
    // Default: Class 4
    return { code: 'CLASS_4', multiplier: 1.0, description: 'Class 4: Car / Jeep / Van / Tata Ace / Light Motor Vehicle' };
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
