import { logger } from '../../core/config/logger';
import { RoadSegmentEdge } from './traffic.types';

export interface ShockwaveAnalysisResult {
  segmentId: string;
  roadName: string;
  isCongestionShockwaveActive: boolean;
  shockwaveVelocityKmh: number; // Negative indicates backward propagating queue
  direction: 'BACKWARD_FORMING' | 'FORWARD_RECOVERY' | 'STATIONARY' | 'FREE_FLOW';
  currentDensityVehPerKm: number;
  jamDensityVehPerKm: number;
  flowRateVehPerHour: number;
  capacityVehPerHour: number;
  spillbackTimeToUpstreamMinutes: number | null; // Minutes until queue hits upstream intersection
  queueLengthMeters: number;
  estimatedClearanceDurationMinutes: number;
  advisoryMessage: string;
}

/**
 * Lighthill-Whitham-Richards (LWR) Traffic Shockwave Propagation & Spillback Predictor.
 * Implements macroscopic traffic flow continuity:
 * dq/dx + dk/dt = 0
 * Shockwave Velocity: w = (q_2 - q_1) / (k_2 - k_1)
 */
export class TrafficShockwaveService {
  // Typical jam density: 135 vehicles per kilometer per lane
  private readonly DEFAULT_JAM_DENSITY_PER_LANE = 135.0;

  /**
   * Analyzes macroscopic traffic shockwave dynamics on a road segment using the
   * Greenshields fundamental diagram of traffic flow.
   */
  public analyzeSegmentShockwave(
    segment: RoadSegmentEdge,
    upstreamSegment?: RoadSegmentEdge,
    lanesCount = 3
  ): ShockwaveAnalysisResult {
    const vFree = segment.freeFlowSpeedKmh || 50.0;
    const vCurrent = Math.max(1.0, segment.effectiveSpeedKmh || segment.currentSpeedKmh || vFree);
    const kJam = this.DEFAULT_JAM_DENSITY_PER_LANE * lanesCount;

    // Greenshields density estimation: v = v_free * (1 - k / k_jam) => k = k_jam * (1 - v / v_free)
    const kCurrent = Math.min(kJam, Math.max(5.0, kJam * (1.0 - Math.min(vFree, vCurrent) / vFree)));

    // Maximum theoretical capacity: q_max = (v_free * k_jam) / 4
    const qCapacity = Math.round((vFree * kJam) / 4);
    const vCrit = vFree / 2.0;

    // Upstream traffic state (State 1: arrival flow)
    const vUpstream = upstreamSegment
      ? Math.max(1.0, upstreamSegment.effectiveSpeedKmh || upstreamSegment.freeFlowSpeedKmh)
      : vFree * 0.85;
    const kUpstream = Math.min(kJam, Math.max(5.0, kJam * (1.0 - Math.min(vFree, vUpstream) / vFree)));
    
    // In congested state (v < v_crit), bottleneck restricts throughput below arrival rate
    const isCongestedState = vCurrent < vCrit;
    const qCurrent = isCongestedState
      ? Math.round(qCapacity * (vCurrent / vCrit) * 0.75)
      : Math.round(kCurrent * vCurrent);

    const qUpstream = vUpstream >= vCrit
      ? Math.round(qCapacity * (0.8 + 0.2 * (vUpstream / vFree)))
      : Math.round(kUpstream * vUpstream);

    // Compute Shockwave Velocity w = (q_current - q_upstream) / (k_current - k_upstream)
    const deltaQ = qCurrent - qUpstream;
    const deltaK = kCurrent - kUpstream;

    let wKmh = 0;
    if (Math.abs(deltaK) > 1.0) {
      wKmh = deltaQ / deltaK;
    }

    const isCongested = segment.congestionLevel === 'congested' || segment.congestionLevel === 'severe_gridlock';
    let direction: ShockwaveAnalysisResult['direction'] = 'FREE_FLOW';
    let spillbackTimeMinutes: number | null = null;
    let queueLengthMeters = 0;
    let clearanceMinutes = 0;

    if (isCongested) {
      if (wKmh < -2.0) {
        direction = 'BACKWARD_FORMING'; // Congestion shockwave moving upstream towards preceding intersection
        const segmentLengthKm = (segment.lengthMeters || 500) / 1000;
        
        // Time for shockwave to propagate to upstream intersection: t = distance / |w|
        spillbackTimeMinutes = Math.round((segmentLengthKm / Math.abs(wKmh)) * 60 * 10) / 10;
        queueLengthMeters = Math.min(
          segment.lengthMeters,
          Math.round(((kCurrent - kUpstream) / kJam) * segment.lengthMeters)
        );
        clearanceMinutes = Math.round((queueLengthMeters / 1000 / (vFree * 0.35)) * 60 * 10) / 10;
      } else if (wKmh > 2.0) {
        direction = 'FORWARD_RECOVERY'; // Downstream clearing out
        clearanceMinutes = Math.max(1.0, Math.round(((segment.lengthMeters || 500) / 1000 / wKmh) * 60));
      } else {
        direction = 'STATIONARY'; // Standing queue
        queueLengthMeters = Math.round(segment.lengthMeters * 0.7);
        clearanceMinutes = 8.0;
      }
    }

    let advisory = 'Normal traffic flow; no backward shockwaves detected.';
    if (direction === 'BACKWARD_FORMING') {
      advisory = `⚠️ Backward shockwave traveling upstream at ${Math.abs(wKmh).toFixed(1)} km/h. Queue spillback to upstream intersection expected in ${spillbackTimeMinutes} minutes.`;
    } else if (direction === 'FORWARD_RECOVERY') {
      advisory = `🟢 Recovery wave active. Bottleneck dissipating; expected full clearance in ${clearanceMinutes} minutes.`;
    }

    return {
      segmentId: segment.segmentId,
      roadName: segment.name,
      isCongestionShockwaveActive: isCongested && direction === 'BACKWARD_FORMING',
      shockwaveVelocityKmh: Math.round(wKmh * 10) / 10,
      direction,
      currentDensityVehPerKm: Math.round(kCurrent * 10) / 10,
      jamDensityVehPerKm: Math.round(kJam),
      flowRateVehPerHour: qCurrent,
      capacityVehPerHour: qCapacity,
      spillbackTimeToUpstreamMinutes: spillbackTimeMinutes,
      queueLengthMeters,
      estimatedClearanceDurationMinutes: clearanceMinutes,
      advisoryMessage: advisory,
    };
  }
}

export const trafficShockwaveService = new TrafficShockwaveService();
export const trafficShockwaveEngineService = trafficShockwaveService;

