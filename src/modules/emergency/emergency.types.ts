import { LatLng } from '../../core/utils/response';

export type EmergencyType =
  | 'ACCIDENT_CRITICAL'
  | 'MEDICAL_EMERGENCY'
  | 'VEHICLE_BREAKDOWN'
  | 'WOMEN_SAFETY_SOS'
  | 'NHAI_1033_PATROL'
  | 'MEDICAL'
  | 'ACCIDENT'
  | 'POLICE';

export interface EmergencyFacility {
  id: string;
  name: string;
  type: string;
  phone: string;
  location: LatLng;
  distanceKm?: number;
  is24x7: boolean;
  hasAmbulance: boolean;
}

export interface SOSAlertRequest {
  type: EmergencyType;
  currentLocation?: LatLng;
  latitude?: number;
  longitude?: number;
  vehicleNumber?: string;
  userPhone?: string;
  message?: string;
}

export interface SOSAlertResponse {
  incident_id: string;
  status: string;
  national_helpline: string;
  highway_helpline: string;
  timestamp: string;
  nearby_facilities: EmergencyFacility[];
}

export interface SOSIncidentRecord {
  incident_id: string;
  type: EmergencyType | string;
  location: LatLng;
  vehicleNumber?: string;
  userPhone?: string;
  message?: string;
  status: 'DISPATCHED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM' | string;
  national_helpline: string;
  highway_helpline: string;
  notes?: string;
  timestamp: string;
  updated_at?: string;
}
