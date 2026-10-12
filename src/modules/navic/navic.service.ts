import {
  NavICFixRequest,
  NavICEnhancedFixResponse,
  SatelliteTelemetry,
} from './navic.types';

export class NavICService {
  public processNavICFix(req: NavICFixRequest): NavICEnhancedFixResponse {
    const lat = Number(req.rawLatitude);
    const lng = Number(req.rawLongitude);
    const alt = Number(req.rawAltitude ?? 215.0);

    // 1. Determine Indian NavIC coverage zone (Bounding box: Lat 5-38°N, Lng 65-98°E mainland)
    let coverageZone: 'INDIAN_MAINLAND' | 'EXTENDED_1500KM' | 'OUTSIDE_NAVIC_SERVICE_AREA' =
      'INDIAN_MAINLAND';
    if (lat < 5.0 || lat > 38.0 || lng < 65.0 || lng > 98.0) {
      if (lat >= -10.0 && lat <= 48.0 && lng >= 50.0 && lng <= 113.0) {
        coverageZone = 'EXTENDED_1500KM';
      } else {
        coverageZone = 'OUTSIDE_NAVIC_SERVICE_AREA';
      }
    }

    // 2. Count active NavIC & GAGAN satellites
    let navicCount = 0;
    let gaganCount = 0;
    if (Array.isArray(req.satellites) && req.satellites.length > 0) {
      for (const sat of req.satellites) {
        if (sat.constellation === 'NavIC' && sat.inFix && sat.healthStatus === 'HEALTHY') {
          navicCount++;
        } else if (sat.constellation === 'GAGAN' && sat.inFix) {
          gaganCount++;
        }
      }
    } else {
      // Default standard constellation fix over Indian subcontinent
      navicCount = 6;
      gaganCount = 2;
    }

    // 3. Compute GAGAN Ionospheric Grid Delay Correction
    let ionoDelayMeters = 0.0;
    let accuracy = 4.5; // Standard baseline
    let fixType = 'NAVIC_STANDALONE';

    if (req.enableGAGAN && gaganCount > 0) {
      ionoDelayMeters = 2.45 * Math.sin((lat * Math.PI) / 180.0);
      accuracy = 0.85; // Sub-meter GAGAN accuracy
      fixType = 'GAGAN_AUGMENTED_DGPS';
    } else if (navicCount >= 6) {
      accuracy = 1.8; // High-precision NavIC L5 dual-frequency
      fixType = 'NAVIC_DUAL_FREQUENCY_L5_S';
    }

    const correctedLat = lat - ionoDelayMeters * 0.000003;
    const correctedLng = lng - ionoDelayMeters * 0.000002;

    return {
      latitude: Math.round(correctedLat * 1000000) / 1000000,
      longitude: Math.round(correctedLng * 1000000) / 1000000,
      altitudeMeters: alt,
      accuracyMeters: accuracy,
      fixType,
      navicSatellitesCount: navicCount,
      gaganSatellitesCount: gaganCount,
      ionosphericCorrectionMeters: Math.round(ionoDelayMeters * 100) / 100,
      coverageZone,
      timestamp: new Date().toISOString(),
    };
  }

  public getConstellationStatus(): SatelliteTelemetry[] {
    return [
      {
        prn: 1,
        constellation: 'NavIC',
        band: 'L5',
        elevationDeg: 62.0,
        azimuthDeg: 120.0,
        snrDbhz: 44.5,
        inFix: true,
        healthStatus: 'HEALTHY',
      },
      {
        prn: 2,
        constellation: 'NavIC',
        band: 'L5',
        elevationDeg: 54.0,
        azimuthDeg: 210.0,
        snrDbhz: 43.8,
        inFix: true,
        healthStatus: 'HEALTHY',
      },
      {
        prn: 3,
        constellation: 'NavIC',
        band: 'S',
        elevationDeg: 78.0,
        azimuthDeg: 180.0,
        snrDbhz: 46.0,
        inFix: true,
        healthStatus: 'HEALTHY',
      },
      {
        prn: 4,
        constellation: 'NavIC',
        band: 'L5',
        elevationDeg: 48.0,
        azimuthDeg: 95.0,
        snrDbhz: 42.0,
        inFix: true,
        healthStatus: 'HEALTHY',
      },
      {
        prn: 5,
        constellation: 'NavIC',
        band: 'L5',
        elevationDeg: 68.0,
        azimuthDeg: 310.0,
        snrDbhz: 45.2,
        inFix: true,
        healthStatus: 'HEALTHY',
      },
      {
        prn: 6,
        constellation: 'NavIC',
        band: 'S',
        elevationDeg: 58.0,
        azimuthDeg: 275.0,
        snrDbhz: 43.5,
        inFix: true,
        healthStatus: 'HEALTHY',
      },
      {
        prn: 7,
        constellation: 'NavIC',
        band: 'L5',
        elevationDeg: 71.0,
        azimuthDeg: 155.0,
        snrDbhz: 46.8,
        inFix: true,
        healthStatus: 'HEALTHY',
      },
      {
        prn: 127,
        constellation: 'GAGAN',
        band: 'L5',
        elevationDeg: 65.0,
        azimuthDeg: 160.0,
        snrDbhz: 47.0,
        inFix: true,
        healthStatus: 'HEALTHY',
      },
      {
        prn: 128,
        constellation: 'GAGAN',
        band: 'L5',
        elevationDeg: 59.0,
        azimuthDeg: 195.0,
        snrDbhz: 46.2,
        inFix: true,
        healthStatus: 'HEALTHY',
      },
    ];
  }
}

export const navicService = new NavICService();
