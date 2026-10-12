import { calculateDistance, LatLng } from '../../core/utils/response';
import {
  GLOSARecommendation,
  SignalPhase,
  TrafficSignalSPaT,
} from './v2x.types';

export class V2XService {
  public getIntersectionSPaT(intersectionId: string): TrafficSignalSPaT {
    const now = Math.floor(Date.now() / 1000);
    const cycle = 60; // 60s total cycle (30s Green, 5s Yellow, 25s Red)
    const offset = now % cycle;

    let phase: SignalPhase = 'GREEN';
    let remaining = 30;

    if (offset < 30) {
      phase = 'GREEN';
      remaining = 30 - offset;
    } else if (offset < 35) {
      phase = 'YELLOW';
      remaining = 35 - offset;
    } else {
      phase = 'RED';
      remaining = 60 - offset;
    }

    return {
      intersection_id: intersectionId,
      name: 'Connaught Place & Barakhamba Road Municipal Signal',
      location: { latitude: 28.6304, longitude: 77.2177 },
      current_phase: phase,
      time_remaining_sec: remaining,
      cycle_duration_sec: 60.0,
      lane_movements: [
        { lane_index: 0, direction: 'left', phase, time_remaining_sec: remaining },
        { lane_index: 1, direction: 'through', phase, time_remaining_sec: remaining },
        { lane_index: 2, direction: 'right', phase: 'GREEN', time_remaining_sec: 15.0 },
      ],
      last_updated_at: new Date().toISOString(),
    };
  }

  public getNearbySignals(lat: number, lng: number, radiusMeters = 500.0): TrafficSignalSPaT[] {
    const s1 = this.getIntersectionSPaT('INT_DEL_CP_01');
    const s2 = this.getIntersectionSPaT('INT_DEL_KG_02');
    s2.name = 'Kasturba Gandhi Marg & Tolstoy Rd Municipal Signal';
    s2.location = { latitude: 28.625, longitude: 77.221 };

    return [s1, s2];
  }

  public calculateGLOSA(
    vehicleLoc: LatLng,
    currentSpeedKmh: number,
    intersectionId: string
  ): GLOSARecommendation {
    const spat = this.getIntersectionSPaT(intersectionId);
    const distM = calculateDistance(
      vehicleLoc.latitude,
      vehicleLoc.longitude,
      spat.location.latitude,
      spat.location.longitude
    );

    const minSpeedKmh = 20.0;
    const maxSpeedKmh = 55.0;

    let recommendedSpeed = currentSpeedKmh;
    let willCatchGreen = false;
    let msg = '';

    if (spat.current_phase === 'GREEN') {
      const timeToArrivalSec = distM / ((currentSpeedKmh * 1000.0) / 3600.0);
      if (timeToArrivalSec <= spat.time_remaining_sec) {
        recommendedSpeed = currentSpeedKmh;
        willCatchGreen = true;
        msg = `Maintain ${currentSpeedKmh.toFixed(0)} km/h to pass on green (${spat.time_remaining_sec.toFixed(1)}s remaining)`;
      } else {
        const targetSpeed = (distM / (spat.time_remaining_sec - 2.0)) * 3.6;
        if (targetSpeed <= maxSpeedKmh) {
          recommendedSpeed = Math.round(targetSpeed);
          willCatchGreen = true;
          msg = `Accelerate to ${recommendedSpeed} km/h to catch current green light`;
        } else {
          willCatchGreen = false;
          recommendedSpeed = 35.0;
          msg = `Prepare to stop: light turns red in ${spat.time_remaining_sec.toFixed(1)}s`;
        }
      }
    } else {
      const timeToGreen = spat.time_remaining_sec;
      const targetSpeed = (distM / timeToGreen) * 3.6;
      if (targetSpeed >= minSpeedKmh && targetSpeed <= maxSpeedKmh) {
        recommendedSpeed = Math.round(targetSpeed);
        willCatchGreen = true;
        msg = `Eco-Approach: Coast at ${recommendedSpeed} km/h to arrive on green without stopping`;
      } else {
        willCatchGreen = false;
        recommendedSpeed = Math.min(currentSpeedKmh, 30.0);
        msg = `Red light ahead: Green in ${timeToGreen.toFixed(1)}s`;
      }
    }

    return {
      intersection_id: intersectionId,
      distance_to_light_meters: Math.round(distM * 10) / 10,
      current_phase: spat.current_phase,
      time_remaining_sec: spat.time_remaining_sec,
      recommended_speed_kmh: recommendedSpeed,
      advisory_message: msg,
      will_catch_green: willCatchGreen,
    };
  }
}

export const v2xService = new V2XService();
