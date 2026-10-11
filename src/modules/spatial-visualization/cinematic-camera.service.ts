import { Coordinate } from '../../core/types/geo.types';
import { calculateBearing, calculateDistanceMeters } from '../../core/utils/geo.utils';
import {
  BillboardScreenAnchor,
  CameraPose,
  CinematicFlightPath,
} from './spatial-visualization.types';

export class CinematicCameraService {
  /**
   * Generates a cinematic 3D flight path along a route polyline for pre-drive preview or aerial tour.
   *
   * @param routeCoordinates Waypoint coordinates of the route
   * @param routeName Display name for the route
   * @param flightAltitudeMeters Flight elevation above ground (default 120m)
   * @param totalDurationSeconds Time length of cinematic tour (default 30s)
   */
  generateRouteFlightPath(
    routeCoordinates: Coordinate[],
    routeName: string = 'Cinematic Route Tour',
    flightAltitudeMeters: number = 120,
    totalDurationSeconds: number = 30
  ): CinematicFlightPath {
    if (routeCoordinates.length < 2) {
      throw new Error('Route coordinates must contain at least 2 points for camera flight');
    }

    const poses: CameraPose[] = [];
    const numSamples = Math.max(10, Math.min(60, routeCoordinates.length * 3));
    const timeStep = totalDurationSeconds / numSamples;

    // Resample smooth points along the route
    const sampledPoints = this.resamplePolyline(routeCoordinates, numSamples);

    for (let i = 0; i < sampledPoints.length; i++) {
      const current = sampledPoints[i];
      const next = sampledPoints[Math.min(sampledPoints.length - 1, i + 1)];
      const aheadLook = sampledPoints[Math.min(sampledPoints.length - 1, i + 3)] || next;

      // Bearing towards next route section
      const bearing = calculateBearing(current, next);

      // Camera position sits slightly trailing behind and above the vehicle point
      const trailingDistance = 45; // meters behind
      const [camLon, camLat] = this.offsetPointBehind(
        current,
        bearing,
        trailingDistance
      );

      // Smooth pitch variation (higher altitude = steeper pitch)
      const pitch = -32.0;

      poses.push({
        stepIndex: i,
        position: [camLon, camLat, flightAltitudeMeters],
        lookAt: [aheadLook[0], aheadLook[1], 5.0],
        pitchDegrees: pitch,
        bearingDegrees: Math.round(bearing * 10) / 10,
        fovDegrees: 60,
        timeOffsetSeconds: Math.round(i * timeStep * 10) / 10,
      });
    }

    // Generate HUD 3D Billboard Anchors for landmarks/turns along the route
    const anchors: BillboardScreenAnchor[] = this.generateBillboardAnchors(
      sampledPoints,
      poses[0]
    );

    return {
      flightId: `flyover_${Date.now()}`,
      routeName,
      totalDurationSeconds,
      cameraPoses: poses,
      billboardAnchors: anchors,
      smoothTransition: true,
    };
  }

  /**
   * Projects 3D world coordinates [lon, lat, alt] onto 2D normalized screen coordinates [x, y]
   * for AR billboards, landmark callouts, and HUD overlays.
   */
  projectWorldToScreen(
    worldPos: [number, number, number],
    camera: CameraPose
  ): { screenX: number; screenY: number; isVisible: boolean; distanceMeters: number } {
    const [wLon, wLat, wAlt] = worldPos;
    const [cLon, cLat, cAlt] = camera.position;

    const distMeters = calculateDistanceMeters([cLon, cLat], [wLon, wLat]);
    const bearingToTarget = calculateBearing([cLon, cLat], [wLon, wLat]);

    // Relative angle relative to camera heading
    let deltaAngle = bearingToTarget - camera.bearingDegrees;
    while (deltaAngle > 180) deltaAngle -= 360;
    while (deltaAngle < -180) deltaAngle += 360;

    const fovHalf = camera.fovDegrees / 2;

    // Check if within camera horizontal field of view
    const isVisible = Math.abs(deltaAngle) <= fovHalf && distMeters > 5 && distMeters < 3000;

    // Normalized screen X [0..1]
    const screenX = 0.5 + (deltaAngle / camera.fovDegrees);

    // Normalized screen Y [0..1] based on pitch and altitude delta
    const dz = wAlt - cAlt;
    const elevationAngleDeg = (Math.atan2(dz, Math.max(1, distMeters)) * 180) / Math.PI;
    const deltaPitch = elevationAngleDeg - camera.pitchDegrees;
    const screenY = 0.5 - (deltaPitch / (camera.fovDegrees * 0.75));

    return {
      screenX: Math.max(0, Math.min(1, Math.round(screenX * 1000) / 1000)),
      screenY: Math.max(0, Math.min(1, Math.round(screenY * 1000) / 1000)),
      isVisible,
      distanceMeters: Math.round(distMeters * 10) / 10,
    };
  }

  /**
   * Evenly resamples polyline coordinates into N uniform segments.
   */
  private resamplePolyline(coords: Coordinate[], count: number): Coordinate[] {
    if (coords.length <= 1) return coords;
    const resampled: Coordinate[] = [];

    const totalPoints = coords.length;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const indexFloat = t * (totalPoints - 1);
      const idx = Math.floor(indexFloat);
      const frac = indexFloat - idx;

      const p1 = coords[idx];
      const p2 = coords[Math.min(totalPoints - 1, idx + 1)];

      const lon = p1[0] + (p2[0] - p1[0]) * frac;
      const lat = p1[1] + (p2[1] - p1[1]) * frac;

      resampled.push([lon, lat]);
    }

    return resampled;
  }

  /**
   * Offsets coordinate behind a heading by a distance.
   */
  private offsetPointBehind(
    pt: Coordinate,
    headingDeg: number,
    distMeters: number
  ): Coordinate {
    const oppHeadingRad = ((headingDeg + 180) * Math.PI) / 180;
    const latMeters = 111000;
    const lonMeters = 111000 * Math.cos((pt[1] * Math.PI) / 180);

    const dLat = (distMeters * Math.cos(oppHeadingRad)) / latMeters;
    const dLon = (distMeters * Math.sin(oppHeadingRad)) / lonMeters;

    return [pt[0] + dLon, pt[1] + dLat];
  }

  /**
   * Generates billboard anchors along the flight path.
   */
  private generateBillboardAnchors(
    sampledPoints: Coordinate[],
    initialCamera: CameraPose
  ): BillboardScreenAnchor[] {
    const anchors: BillboardScreenAnchor[] = [];

    if (sampledPoints.length > 2) {
      const mid = sampledPoints[Math.floor(sampledPoints.length / 2)];
      const end = sampledPoints[sampledPoints.length - 1];

      const midProj = this.projectWorldToScreen([mid[0], mid[1], 20], initialCamera);
      anchors.push({
        anchorId: 'anchor_scenic_overlook',
        worldPosition: [mid[0], mid[1], 20],
        screenCoordinate: [midProj.screenX, midProj.screenY],
        title: 'Tiergarten Central Corridor',
        subtitle: 'Scenic Boulevard View',
        category: 'landmark',
        isVisible: true,
      });

      const endProj = this.projectWorldToScreen([end[0], end[1], 15], initialCamera);
      anchors.push({
        anchorId: 'anchor_destination_pin',
        worldPosition: [end[0], end[1], 15],
        screenCoordinate: [endProj.screenX, endProj.screenY],
        title: 'Destination Terminal',
        subtitle: 'Arrival Point',
        category: 'destination',
        isVisible: true,
      });
    }

    return anchors;
  }
}

export const cinematicCameraService = new CinematicCameraService();
