import { LatLng } from '../../core/utils/response';

export type VehicleClass =
  | 'CLASS_4'
  | 'CLASS_5'
  | 'CLASS_6'
  | 'CLASS_7'
  | 'CLASS_8'
  | 'CLASS_9'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'CAR_JEEP_VAN'
  | 'LCV'
  | 'BUS_TRUCK_2AXLE'
  | '3AXLE_COMMERCIAL'
  | '4_6_AXLE'
  | '7_PLUS_AXLE'
  | 'TWO_WHEELER'
  | 'car'
  | 'lcv'
  | 'bus'
  | 'truck'
  | 'two_wheeler';

export interface TollPlaza {
  id: string;
  name: string;
  highway: string;
  location: LatLng;
  singleTripINR: number;
  returnTripINR: number;
  monthlyPassINR: number;
  isFASTagActive: boolean;
  operator: 'NHAI' | 'MSRDC' | 'YEIDA' | string;
  totalLanesCount?: number;
  fastagLanesCount?: number;
  dedicatedFastagLanes?: number[];
  cashlessLaneGuidance?: string;
  etcStatus?: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE';
  barrierType?: 'AUTOMATIC_ANPR_BOOM_BARRIER' | 'RFID_SINGLE_PASS';
}

export interface TollCalculationRequest {
  origin?: string;
  destination?: string;
  routeCoordinates?: LatLng[];
  vehicleType?: VehicleClass;
  vehicle_class?: VehicleClass;
  isReturnTrip?: boolean;
  is_return_trip?: boolean;
}

export interface TollCalculationResponse {
  totalTollINR: number;
  totalPlazasCount: number;
  vehicleType: string;
  vehicleClassCode: 'CLASS_4' | 'CLASS_5' | 'CLASS_6' | 'CLASS_7' | 'CLASS_8' | 'CLASS_9' | 'TWO_WHEELER_EXEMPT';
  fastagSavingsINR: number;
  plazas: TollPlaza[];
  expresswaysCrossed: string[];
  cashlessLaneGuidance: string[];
  note?: string;
}
