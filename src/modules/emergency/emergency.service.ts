import { calculateDistance, LatLng } from '../../core/utils/response';
import {
  EmergencyFacility,
  SOSAlertRequest,
  SOSAlertResponse,
  SOSIncidentRecord,
} from './emergency.types';

export class EmergencyService {
  private readonly incidents: SOSIncidentRecord[] = [
    {
      incident_id: 'sos_delhi_nh48_01',
      type: 'ACCIDENT_CRITICAL',
      location: { latitude: 28.41, longitude: 76.99 },
      vehicleNumber: 'DL 01 AB 1234',
      userPhone: '+91 9811002233',
      message: 'Vehicle rollover on NH-48 Km 34. Ambulance urgently required.',
      status: 'DISPATCHED',
      national_helpline: '112',
      highway_helpline: '1033 (NHAI Emergency)',
      notes: 'NHAI Patrol Unit dispatched. ETA 6 mins.',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
    {
      incident_id: 'sos_dadar_water_02',
      type: 'VEHICLE_BREAKDOWN',
      location: { latitude: 19.0178, longitude: 72.8478 },
      vehicleNumber: 'MH 02 CZ 5678',
      userPhone: '+91 9820011223',
      message: 'Engine stalled due to waterlogging at Hindmata Dadar.',
      status: 'ACKNOWLEDGED',
      national_helpline: '112',
      highway_helpline: '1033 (NHAI Emergency)',
      notes: 'Towing crane alerted.',
      timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    },
  ];

  private readonly facilities: EmergencyFacility[] = [
    {
      id: 'em_aiims_trauma',
      name: 'AIIMS Apex Trauma Center (Level-1)',
      type: 'TRAUMA_CENTER',
      phone: '+91-11-26188000',
      location: { latitude: 28.5672, longitude: 77.21 },
      is24x7: true,
      hasAmbulance: true,
    },
    {
      id: 'em_nhai_patrol_nh48',
      name: 'NHAI Highway Patrol Unit - NH-48 Km 34',
      type: 'HIGHWAY_PATROL_1033',
      phone: '1033',
      location: { latitude: 28.41, longitude: 76.99 },
      is24x7: true,
      hasAmbulance: true,
    },
    {
      id: 'em_police_cybercity',
      name: 'Gurugram Traffic Police Station',
      type: 'POLICE_STATION',
      phone: '112',
      location: { latitude: 28.498, longitude: 77.087 },
      is24x7: true,
      hasAmbulance: false,
    },
    {
      id: 'em_tow_highway',
      name: '24x7 National Highway Crane & Puncture Towing',
      type: '24X7_PUNCTURE_TOWING',
      phone: '+91-9811002233',
      location: { latitude: 28.42, longitude: 77.01 },
      is24x7: true,
      hasAmbulance: false,
    },
  ];

  public triggerSOS(req: SOSAlertRequest): SOSAlertResponse {
    const lat = req.currentLocation?.latitude ?? req.latitude ?? 28.6129;
    const lng = req.currentLocation?.longitude ?? req.longitude ?? 77.2295;

    const facilities = this.getNearbyEmergencyFacilities(lat, lng);
    const incidentId = `sos_${Math.random().toString(36).substring(2, 10)}`;

    const record: SOSIncidentRecord = {
      incident_id: incidentId,
      type: req.type,
      location: { latitude: lat, longitude: lng },
      vehicleNumber: req.vehicleNumber,
      userPhone: req.userPhone,
      message: req.message,
      status: 'DISPATCHED',
      national_helpline: '112',
      highway_helpline: '1033 (NHAI Emergency)',
      timestamp: new Date().toISOString(),
    };
    this.incidents.unshift(record);

    return {
      incident_id: incidentId,
      status: 'DISPATCHED',
      national_helpline: '112',
      highway_helpline: '1033 (NHAI Emergency)',
      timestamp: record.timestamp,
      nearby_facilities: facilities,
    };
  }

  public listIncidents(limit = 50): SOSIncidentRecord[] {
    return this.incidents.slice(0, limit);
  }

  public updateIncidentStatus(
    id: string,
    status: string,
    notes?: string
  ): SOSIncidentRecord | null {
    const found = this.incidents.find((i) => i.incident_id === id);
    if (!found) return null;
    found.status = status;
    if (notes) found.notes = notes;
    found.updated_at = new Date().toISOString();
    return found;
  }

  public getNearbyEmergencyFacilities(lat: number, lng: number): EmergencyFacility[] {
    return this.facilities.map((f) => {
      const distKm =
        calculateDistance(lat, lng, f.location.latitude, f.location.longitude) /
        1000.0;
      return {
        ...f,
        distanceKm: Math.round(distKm * 10) / 10,
      };
    });
  }
}

export const emergencyService = new EmergencyService();
