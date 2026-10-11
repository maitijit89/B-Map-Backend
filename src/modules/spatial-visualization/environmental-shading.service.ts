import { Coordinate } from '../../core/types/geo.types';
import { Building3DProfile, BuildingShadowPolygon, SolarPosition, WeatherRadarLayer } from './spatial-visualization.types';

export class EnvironmentalShadingService {
  /**
   * Calculates precise solar position (elevation & azimuth angles) for a coordinate at a given timestamp.
   * Uses astronomical solar equations.
   */
  calculateSolarPosition(
    coordinate: Coordinate,
    date: Date = new Date()
  ): SolarPosition {
    const [lon, lat] = coordinate;

    // Day of the year
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor(
      (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Approximate solar declination angle in radians
    const declination =
      23.45 * Math.sin((((284 + dayOfYear) / 365) * 2 * Math.PI)) * (Math.PI / 180);

    // Solar time / hour angle
    const utcHours =
      date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const solarTime = utcHours + lon / 15;
    const hourAngle = ((solarTime - 12) * 15) * (Math.PI / 180);

    const latRad = (lat * Math.PI) / 180;

    // Solar elevation angle (altitude above horizon)
    const sinElevation =
      Math.sin(latRad) * Math.sin(declination) +
      Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle);
    const elevationRad = Math.asin(Math.max(-1, Math.min(1, sinElevation)));
    const elevationDegrees = Math.round(((elevationRad * 180) / Math.PI) * 10) / 10;

    // Solar azimuth angle (clockwise from North)
    const cosAzimuth =
      (Math.sin(declination) - Math.sin(latRad) * Math.sin(elevationRad)) /
      (Math.cos(latRad) * Math.cos(elevationRad) + 1e-6);
    let azimuthRad = Math.acos(Math.max(-1, Math.min(1, cosAzimuth)));
    if (Math.sin(hourAngle) > 0) {
      azimuthRad = 2 * Math.PI - azimuthRad;
    }
    const azimuthDegrees = Math.round(((azimuthRad * 180) / Math.PI) * 10) / 10;

    return {
      elevationDegrees,
      azimuthDegrees,
      isDaylight: elevationDegrees > 0,
      timestamp: date.getTime(),
    };
  }

  /**
   * Projects shadow polygons for a list of 3D buildings based on solar position.
   */
  projectBuildingShadows(
    buildings: Building3DProfile[],
    solar: SolarPosition
  ): BuildingShadowPolygon[] {
    // If night or sun below horizon, no ground shadows
    if (!solar.isDaylight || solar.elevationDegrees < 2) {
      return [];
    }

    // Shadow length factor = height / tan(elevation)
    const elevRad = (solar.elevationDegrees * Math.PI) / 180;
    const shadowRatio = 1 / Math.tan(elevRad);

    // Shadow points away from the sun (azimuth + 180 deg)
    const shadowDirectionRad = ((solar.azimuthDegrees + 180) * Math.PI) / 180;

    const latMeters = 111000;

    return buildings.map((b) => {
      const shadowLengthMeters = Math.min(250, b.heightMeters * shadowRatio);
      const dNorth = shadowLengthMeters * Math.cos(shadowDirectionRad);
      const dEast = shadowLengthMeters * Math.sin(shadowDirectionRad);

      const [refLon, refLat] = b.footprint[0] || [13.38, 52.51];
      const lonMeters = 111000 * Math.cos((refLat * Math.PI) / 180);

      const dLat = dNorth / latMeters;
      const dLon = dEast / lonMeters;

      // Extrude footprint vertices along shadow vector
      const shadowRing: Coordinate[] = b.footprint.map(([lon, lat]) => [
        lon + dLon,
        lat + dLat,
      ]);

      // Connect original base with projected roof polygon
      const shadowPoly = [...b.footprint, ...shadowRing.reverse(), b.footprint[0]];

      return {
        buildingId: b.buildingId,
        shadowGeometry: shadowPoly,
        shadowLengthMeters: Math.round(shadowLengthMeters * 10) / 10,
        sunAzimuthDegrees: solar.azimuthDegrees,
      };
    });
  }

  /**
   * Generates dynamic weather radar reflectivity overlay mesh.
   */
  generateWeatherRadarOverlay(
    center: Coordinate,
    radiusMeters: number = 8000,
    intensityLevel: 'light' | 'moderate' | 'heavy' = 'moderate'
  ): WeatherRadarLayer {
    const [cLon, cLat] = center;
    const latDelta = radiusMeters / 111000;
    const lonDelta = radiusMeters / (111000 * Math.cos((cLat * Math.PI) / 180));

    const maxDbz = intensityLevel === 'heavy' ? 55 : intensityLevel === 'moderate' ? 38 : 22;

    const contours = [
      {
        dbzThreshold: 20,
        colorHex: '#38BDF888', // Light blue (light precipitation)
        polygon: this.generateEllipticalStormCell(
          [cLon + lonDelta * 0.2, cLat + latDelta * 0.1],
          radiusMeters * 0.7,
          radiusMeters * 0.5,
          35
        ),
      },
      {
        dbzThreshold: 35,
        colorHex: '#FACC1599', // Yellow (moderate rain cell)
        polygon: this.generateEllipticalStormCell(
          [cLon + lonDelta * 0.22, cLat + latDelta * 0.12],
          radiusMeters * 0.45,
          radiusMeters * 0.3,
          35
        ),
      },
      {
        dbzThreshold: 50,
        colorHex: '#EF4444AA', // Red (severe convective core)
        polygon: this.generateEllipticalStormCell(
          [cLon + lonDelta * 0.25, cLat + latDelta * 0.14],
          radiusMeters * 0.2,
          radiusMeters * 0.15,
          35
        ),
      },
    ];

    return {
      radarId: `radar_${Date.now()}`,
      timestamp: Date.now(),
      precipitationType: 'rain',
      maxDbz,
      radarContours: contours,
    };
  }

  /**
   * Generates oriented storm cell contour polygon.
   */
  private generateEllipticalStormCell(
    center: Coordinate,
    semiMajorMeters: number,
    semiMinorMeters: number,
    angleDegrees: number
  ): Coordinate[] {
    const [cLon, cLat] = center;
    const latMeters = 111000;
    const lonMeters = 111000 * Math.cos((cLat * Math.PI) / 180);
    const thetaRad = (angleDegrees * Math.PI) / 180;

    const ring: Coordinate[] = [];
    const points = 16;

    for (let i = 0; i < points; i++) {
      const t = (2 * Math.PI * i) / points;
      const xLocal = semiMajorMeters * Math.cos(t);
      const yLocal = semiMinorMeters * Math.sin(t);

      // Rotate by angle
      const xRot = xLocal * Math.cos(thetaRad) - yLocal * Math.sin(thetaRad);
      const yRot = xLocal * Math.sin(thetaRad) + yLocal * Math.cos(thetaRad);

      ring.push([cLon + xRot / lonMeters, cLat + yRot / latMeters]);
    }

    ring.push(ring[0]);
    return ring;
  }
}

export const environmentalShadingService = new EnvironmentalShadingService();
