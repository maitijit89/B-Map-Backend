import { Coordinate } from '../../core/types/geo.types';
import { ImuData, OdometryData } from './positioning.types';

export interface DeadReckoningState {
  lastKnownCoordinates: Coordinate; // [lon, lat]
  headingDegrees: number; // 0..360
  speedMps: number;
  gyroZBias: number; // estimated rad/s drift
  lastTimestamp: number;
  elapsedDrDurationSeconds: number;
  confidenceRadiusMeters: number;
}

export class DeadReckoningService {
  private static readonly EARTH_RADIUS_METERS = 6378137.0;

  /**
   * Translates [longitude, latitude] by dx (meters East) and dy (meters North) in WGS84
   */
  projectDisplacement(
    origin: Coordinate,
    dxMeters: number,
    dyMeters: number
  ): Coordinate {
    const [lon, lat] = origin;
    const latRad = (lat * Math.PI) / 180.0;

    // Meters per degree latitude is approximately constant
    const metersPerLat = 111132.92 - 559.82 * Math.cos(2 * latRad);
    // Meters per degree longitude shrinks with cosine of latitude
    const metersPerLon = (Math.PI / 180.0) * DeadReckoningService.EARTH_RADIUS_METERS * Math.cos(latRad);

    const deltaLat = dyMeters / metersPerLat;
    const deltaLon = dxMeters / (metersPerLon > 0 ? metersPerLon : 1);

    return [lon + deltaLon, lat + deltaLat];
  }

  /**
   * Applies Vehicle Dead Reckoning (VDR) step given IMU frame and Odometry/Speed
   */
  propagate(
    state: DeadReckoningState,
    imu?: ImuData,
    odometry?: OdometryData,
    currentTimestamp: number = Date.now()
  ): DeadReckoningState {
    const dtSeconds = Math.max(0.01, Math.min(1.0, (currentTimestamp - state.lastTimestamp) / 1000.0));

    let updatedSpeed = state.speedMps;
    let headingRad = (state.headingDegrees * Math.PI) / 180.0;

    // 1. Heading integration using Gyroscope Z-axis (Yaw Rate) with bias compensation
    if (imu?.gyroscope) {
      const rawYawRateRadSec = imu.gyroscope.z;
      const compensatedYawRate = rawYawRateRadSec - state.gyroZBias;
      headingRad += compensatedYawRate * dtSeconds;
    }

    // Normalize heading to 0..2*PI
    while (headingRad < 0) headingRad += 2 * Math.PI;
    while (headingRad >= 2 * Math.PI) headingRad -= 2 * Math.PI;
    const updatedHeadingDeg = (headingRad * 180.0) / Math.PI;

    // 2. Speed update
    if (odometry?.speedMps !== undefined && odometry.speedMps >= 0) {
      // High-precision wheel speed sensor takes priority
      updatedSpeed = odometry.speedMps;
    } else if (imu?.accelerometer) {
      // Longitudinal acceleration integration (vehicle frame Y-axis or forward)
      const forwardAcc = imu.accelerometer.y;

      // Zero-Velocity Update (ZUPT) check
      if (Math.abs(forwardAcc) < 0.1 && Math.abs(imu.gyroscope.z) < 0.02 && updatedSpeed < 0.3) {
        updatedSpeed = 0;
        // Calibrate stationary gyro drift bias
        state.gyroZBias = state.gyroZBias * 0.95 + imu.gyroscope.z * 0.05;
      } else {
        updatedSpeed = Math.max(0, updatedSpeed + forwardAcc * dtSeconds);
      }
    }

    // 3. Forward Displacement with Non-Holonomic Constraints (lateral v = 0)
    const displacementMeters = updatedSpeed * dtSeconds;
    const dxEast = displacementMeters * Math.sin(headingRad);
    const dyNorth = displacementMeters * Math.cos(headingRad);

    const newCoordinates = this.projectDisplacement(
      state.lastKnownCoordinates,
      dxEast,
      dyNorth
    );

    const newDrDuration = state.elapsedDrDurationSeconds + dtSeconds;

    // 4. Uncertainty Growth Model during GNSS outage:
    // Uncertainty grows linearly + quadratically with time due to gyro drift integration
    const baseRadius = state.confidenceRadiusMeters;
    const driftRate = 0.4; // ~0.4 meters uncertainty per second in dead reckoning
    const updatedConfidence = baseRadius + driftRate * dtSeconds;

    return {
      lastKnownCoordinates: newCoordinates,
      headingDegrees: Math.round(updatedHeadingDeg * 10) / 10,
      speedMps: Math.round(updatedSpeed * 100) / 100,
      gyroZBias: state.gyroZBias,
      lastTimestamp: currentTimestamp,
      elapsedDrDurationSeconds: Math.round(newDrDuration * 10) / 10,
      confidenceRadiusMeters: Math.round(updatedConfidence * 10) / 10,
    };
  }
}

export const deadReckoningService = new DeadReckoningService();
