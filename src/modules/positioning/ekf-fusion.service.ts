import { Coordinate } from '../../core/types/geo.types';
import { ImuData } from './positioning.types';
import { deadReckoningService } from './dead-reckoning.service';

export interface EkfState {
  xEastMeters: number; // local metric coordinates relative to anchor
  yNorthMeters: number;
  vxMps: number;
  vyMps: number;
  headingRad: number;
  gyroBiasRadSec: number;
  // Covariance diagonal variances [P_x, P_y, P_vx, P_vy, P_heading, P_bias]
  pDiag: [number, number, number, number, number, number];
  anchorWgs84: Coordinate; // [lon, lat] reference point
  lastTimestamp: number;
}

export class EkfFusionService {
  /**
   * Initializes state vector around an initial GNSS coordinate
   */
  createInitialState(coord: Coordinate, headingDeg: number = 0, speedMps: number = 0, timestamp: number = Date.now()): EkfState {
    const headingRad = (headingDeg * Math.PI) / 180.0;
    return {
      xEastMeters: 0,
      yNorthMeters: 0,
      vxMps: speedMps * Math.sin(headingRad),
      vyMps: speedMps * Math.cos(headingRad),
      headingRad,
      gyroBiasRadSec: 0,
      pDiag: [1.0, 1.0, 0.5, 0.5, 0.05, 0.001],
      anchorWgs84: coord,
      lastTimestamp: timestamp,
    };
  }

  /**
   * Converts WGS84 coordinate to local metric Cartesian coordinates relative to anchor
   */
  wgs84ToLocal(coord: Coordinate, anchor: Coordinate): { x: number; y: number } {
    const [lon, lat] = coord;
    const [anchorLon, anchorLat] = anchor;
    const latRad = (anchorLat * Math.PI) / 180.0;

    const metersPerLat = 111132.92;
    const metersPerLon = (Math.PI / 180.0) * 6378137.0 * Math.cos(latRad);

    const x = (lon - anchorLon) * metersPerLon;
    const y = (lat - anchorLat) * metersPerLat;

    return { x, y };
  }

  /**
   * Converts local Cartesian coordinates back to WGS84
   */
  localToWgs84(x: number, y: number, anchor: Coordinate): Coordinate {
    return deadReckoningService.projectDisplacement(anchor, x, y);
  }

  /**
   * EKF Time Update (Prediction Step) driven by IMU / Odometry
   */
  predict(state: EkfState, imu?: ImuData, currentTimestamp: number = Date.now()): void {
    const dt = Math.max(0.01, Math.min(1.0, (currentTimestamp - state.lastTimestamp) / 1000.0));
    state.lastTimestamp = currentTimestamp;

    // Longitudinal acceleration and yaw rate
    const yawRate = (imu?.gyroscope?.z ?? 0) - state.gyroBiasRadSec;
    const forwardAcc = imu?.accelerometer?.y ?? 0;

    // Integrate heading
    state.headingRad += yawRate * dt;
    while (state.headingRad < 0) state.headingRad += 2 * Math.PI;
    while (state.headingRad >= 2 * Math.PI) state.headingRad -= 2 * Math.PI;

    // Total speed
    const currentSpeed = Math.sqrt(state.vxMps * state.vxMps + state.vyMps * state.vyMps);
    const updatedSpeed = Math.max(0, currentSpeed + forwardAcc * dt);

    // Apply Non-Holonomic constraint: velocity vector aligns with heading
    state.vxMps = updatedSpeed * Math.sin(state.headingRad);
    state.vyMps = updatedSpeed * Math.cos(state.headingRad);

    // Integrate position
    state.xEastMeters += state.vxMps * dt;
    state.yNorthMeters += state.vyMps * dt;

    // Process noise Q
    const qPos = 0.05 * dt;
    const qVel = 0.2 * dt;
    const qHeading = 0.01 * dt;
    const qBias = 0.00001 * dt;

    state.pDiag[0] += state.pDiag[2] * dt + qPos;
    state.pDiag[1] += state.pDiag[3] * dt + qPos;
    state.pDiag[2] += qVel;
    state.pDiag[3] += qVel;
    state.pDiag[4] += qHeading;
    state.pDiag[5] += qBias;
  }

  /**
   * EKF Measurement Update (Correction Step) from GNSS or Weak-Signal Beacon Fix
   */
  update(
    state: EkfState,
    measuredCoord: Coordinate,
    accuracyMeters: number,
    isOutlierGatingActive: boolean = true
  ): { innovationDistanceMeters: number; rejected: boolean } {
    const local = this.wgs84ToLocal(measuredCoord, state.anchorWgs84);

    // Innovation
    const dx = local.x - state.xEastMeters;
    const dy = local.y - state.yNorthMeters;
    const innovationDist = Math.sqrt(dx * dx + dy * dy);

    // Chi-square innovation gating: reject wild multipath spikes
    const maxAllowedInnovation = Math.max(15.0, accuracyMeters * 3.5);
    if (isOutlierGatingActive && innovationDist > maxAllowedInnovation) {
      return { innovationDistanceMeters: innovationDist, rejected: true };
    }

    // Measurement variance R
    const r = Math.max(0.01, accuracyMeters * accuracyMeters);

    // Compute Kalman gains for position states
    const kx = state.pDiag[0] / (state.pDiag[0] + r);
    const ky = state.pDiag[1] / (state.pDiag[1] + r);

    // Apply correction
    state.xEastMeters += kx * dx;
    state.yNorthMeters += ky * dy;

    // Update covariance
    state.pDiag[0] *= (1 - kx);
    state.pDiag[1] *= (1 - ky);

    // Soft velocity alignment
    const speed = Math.sqrt(state.vxMps * state.vxMps + state.vyMps * state.vyMps);
    if (speed > 1.0) {
      const headingFromPos = Math.atan2(dx, dy);
      const headingDiff = headingFromPos - state.headingRad;
      const kh = state.pDiag[4] / (state.pDiag[4] + 0.1);
      state.headingRad += kh * headingDiff;
      state.pDiag[4] *= (1 - kh);
    }

    return { innovationDistanceMeters: innovationDist, rejected: false };
  }
}

export const ekfFusionService = new EkfFusionService();
