export type NavICBand = 'L5' | 'S';

export interface SatelliteTelemetry {
  prn: number;
  constellation: 'NavIC' | 'GAGAN';
  band: NavICBand;
  elevationDeg: number;
  azimuthDeg: number;
  snrDbhz: number;
  inFix: boolean;
  healthStatus: 'HEALTHY' | 'DEGRADED';
}

export interface DilutionOfPrecision {
  gdop: number;
  pdop: number;
  hdop: number;
  vdop: number;
  tdop: number;
}

export interface NavICFixRequest {
  rawLatitude: number;
  rawLongitude: number;
  rawAltitude?: number;
  hdop?: number;
  vdop?: number;
  pseudorangeL5Meters?: number;
  pseudorangeSMeters?: number;
  satellites?: SatelliteTelemetry[];
  enableGAGAN?: boolean;
}

export interface NavICEnhancedFixResponse {
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  accuracyMeters: number;
  fixType: string;
  navicSatellitesCount: number;
  gaganSatellitesCount: number;
  ionosphericCorrectionMeters: number;
  coverageZone: 'INDIAN_MAINLAND' | 'EXTENDED_1500KM' | 'OUTSIDE_NAVIC_SERVICE_AREA';
  dop?: DilutionOfPrecision;
  timestamp: string;
}

