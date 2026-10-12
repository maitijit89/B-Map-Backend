import { calculateDistance } from '../../core/utils/response';
import { HazardQueryRequest, RoadHazard } from './hazards.types';

export class HazardService {
  private readonly hazards: RoadHazard[] = [
    {
      id: 'hz_sb_delhi_01',
      type: 'SPEED_BREAKER_UNMARKED',
      severity: 'MODERATE',
      location: { latitude: 28.615, longitude: 77.21 },
      description: 'Unmarked high speed breaker near round-about',
      voice_prompt: 'Savdhaan: Speed breaker ahead in 60 meters. Please slow down.',
      reported_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      confirmations_count: 14,
    },
    {
      id: 'hz_water_mumbai_01',
      type: 'MONSOON_WATERLOGGING',
      severity: 'CRITICAL',
      location: { latitude: 19.0178, longitude: 72.8478 }, // Hindmata, Dadar
      description: 'Monsoon waterlogging 1.5 ft water level. Low clearance vehicles avoid.',
      voice_prompt: 'Warning: Monsoon waterlogging ahead at Hindmata Dadar. Reroute recommended.',
      reported_at: new Date(Date.now() - 1800 * 1000).toISOString(),
      confirmations_count: 38,
    },
    {
      id: 'hz_pothole_blr_01',
      type: 'POTHOLE_CLUSTER',
      severity: 'MODERATE',
      location: { latitude: 12.9279, longitude: 77.6271 }, // Silk Board
      description: 'Deep potholes on outer lane near flyover ramp',
      voice_prompt: 'Caution: Severe potholes on left lane in 100 meters.',
      reported_at: new Date(Date.now() - 3600 * 1000).toISOString(),
      confirmations_count: 22,
    },
  ];

  public getAheadHazards(req: HazardQueryRequest): RoadHazard[] {
    const lat = req.currentLocation?.latitude ?? req.latitude ?? 28.6129;
    const lng = req.currentLocation?.longitude ?? req.longitude ?? 77.2295;
    const lookahead = req.lookaheadMeters ?? 1500.0;

    const matched: RoadHazard[] = [];
    for (const h of this.hazards) {
      const dMeters = calculateDistance(lat, lng, h.location.latitude, h.location.longitude);
      if (dMeters <= lookahead) {
        matched.push(h);
      }
    }

    return matched.length > 0 ? matched : [this.hazards[0]];
  }

  public reportHazard(h: Partial<RoadHazard>): RoadHazard {
    const newEntry: RoadHazard = {
      id: `hz_${Date.now()}`,
      type: (h.type ?? 'POTHOLE_CLUSTER') as any,
      severity: h.severity ?? 'MODERATE',
      location: h.location ?? { latitude: 28.6129, longitude: 77.2295 },
      description: h.description ?? 'Road hazard reported by driver',
      voice_prompt: h.voice_prompt ?? `Caution: ${h.type ?? 'Road hazard'} reported ahead.`,
      reported_at: new Date().toISOString(),
      confirmations_count: 1,
    };
    this.hazards.push(newEntry);
    return newEntry;
  }

  public listAllHazards(): RoadHazard[] {
    return [...this.hazards];
  }

  public verifyHazard(id: string): RoadHazard | null {
    const found = this.hazards.find((h) => h.id === id);
    if (!found) return null;
    found.confirmations_count += 5;
    return found;
  }

  public deleteHazard(id: string): boolean {
    const idx = this.hazards.findIndex((h) => h.id === id);
    if (idx !== -1) {
      this.hazards.splice(idx, 1);
      return true;
    }
    return false;
  }
}

export const hazardService = new HazardService();
