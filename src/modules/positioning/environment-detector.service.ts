import { EnvironmentType, RawGnssData, EnvironmentalSignals, ImuData } from './positioning.types';

export class EnvironmentDetectorService {
  /**
   * Computes a normalized GNSS Quality Score (0..100)
   */
  calculateGnssQualityScore(gnss?: RawGnssData): number {
    if (!gnss) return 0;
    if (gnss.fixType === 'none') return 0;

    let score = 50;

    // 1. Fix Type bonus
    if (gnss.fixType === 'rtk_fixed') score += 40;
    else if (gnss.fixType === 'rtk_float') score += 30;
    else if (gnss.fixType === 'dgps') score += 20;
    else if (gnss.fixType === '3d') score += 10;

    // 2. Satellites in use
    const sats = gnss.satellitesUsed ?? gnss.satellitesInView ?? 0;
    if (sats >= 12) score += 10;
    else if (sats >= 8) score += 5;
    else if (sats < 4) score -= 30;

    // 3. HDOP penalty
    const hdop = gnss.hdop ?? 2.0;
    if (hdop <= 1.0) score += 10;
    else if (hdop > 2.5) score -= 15;
    else if (hdop > 5.0) score -= 35;

    // 4. Carrier-to-Noise ratio (C/N0) analysis
    if (gnss.cnoRatios && gnss.cnoRatios.length > 0) {
      const avgCno =
        gnss.cnoRatios.reduce((acc, val) => acc + val, 0) / gnss.cnoRatios.length;
      if (avgCno >= 40) score += 10;
      else if (avgCno < 30) score -= 20;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Detects the operating environment based on multi-sensor telemetry
   */
  detectEnvironment(
    gnss?: RawGnssData,
    signals?: EnvironmentalSignals,
    imu?: ImuData,
    previousEnvironment: EnvironmentType = 'open_sky'
  ): { environment: EnvironmentType; qualityScore: number } {
    const qualityScore = this.calculateGnssQualityScore(gnss);
    const hasBeacons = (signals?.beacons && signals.beacons.length >= 2) || false;
    const hasWifi = (signals?.wifi && signals.wifi.length >= 3) || false;

    // Case 1: Complete GNSS blackout
    if (!gnss || qualityScore < 15 || gnss.accuracy > 40) {
      // If we observe BLE parking beacons or indoor Wi-Fi networks
      if (hasBeacons) {
        return { environment: 'underground_parking', qualityScore };
      }
      if (hasWifi && (!gnss || gnss.speed === undefined || gnss.speed < 4)) {
        return { environment: 'indoor', qualityScore };
      }
      // If previous was road/driving and speed was high before blackout -> Tunnel
      if (previousEnvironment === 'open_sky' || previousEnvironment === 'urban_canyon' || previousEnvironment === 'tunnel') {
        return { environment: 'tunnel', qualityScore };
      }
      return { environment: 'indoor', qualityScore };
    }

    // Case 2: Degraded GNSS (Multipath & Shadowing)
    if (qualityScore < 50 || (gnss.hdop && gnss.hdop > 2.5)) {
      if (hasBeacons) {
        return { environment: 'underground_parking', qualityScore };
      }
      return { environment: 'urban_canyon', qualityScore };
    }

    // Case 3: High quality GNSS
    return { environment: 'open_sky', qualityScore };
  }
}

export const environmentDetectorService = new EnvironmentDetectorService();
