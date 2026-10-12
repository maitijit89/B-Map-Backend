import { LatLng } from '../../core/utils/response';

export type VehicleClass =
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
  fastagSavingsINR: number;
  plazas: TollPlaza[];
  expresswaysCrossed: string[];
  note?: string;
}
