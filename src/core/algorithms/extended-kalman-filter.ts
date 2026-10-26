import { Coordinate } from '../types/geo.types';
import { calculateDistanceMeters } from '../utils/geo.utils';

export interface EkfState {
  x: number; // Local metric Easting (meters from origin)
  y: number; // Local metric Northing (meters from origin)
  vx: number; // Velocity X (m/s)
  vy: number; // Velocity Y (m/s)
  ax: number; // Acceleration X (m/s^2)
  ay: number; // Acceleration Y (m/s^2)
  timestamp: number;
}

export interface EkfFilteredMeasurement {
  smoothedCoordinate: Coordinate; // [lon, lat]
  smoothedSpeedKmh: number;
  smoothedHeadingDeg: number;
  estimatedAccelerationMps2: number;
  covarianceTrace: number; // Measurement uncertainty indicator Tr(P)
  isExtrapolatedDeadReckoning: boolean;
  deadReckoningDurationSeconds?: number; // Cumulative seconds in GNSS blackout
  isMaxDeadReckoningWindowExceeded?: boolean; // True if exceeds 10.0s bound
}

/**
 * Extended Kalman Filter (EKF) with Kinematic Motion Modeling for Real-Time Telematics & GPS Noise Fusion.
 * Implements a continuous-time white noise acceleration model (CWNA) projected onto local Euclidean coordinates.
 *
 * State Vector: x = [x, y, vx, vy, ax, ay]^T (6x1)
 * Measurement Vector: z = [x, y, vx, vy]^T (4x1)
 */
export class ExtendedKalmanFilter {
  // Local projection reference point [lon, lat]
  private referenceOrigin: Coordinate | null = null;

  // State estimate vector (6x1)
  private state: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];

  // Error covariance matrix (6x6)
  private P: number[][] = [];

  // Process noise variance (q_accel: acceleration variance in m/s^2)
  private processNoiseVariance = 1.8;

  // Default measurement noise covariance: position ~4m variance, velocity ~0.5 m/s variance
  private measurementNoiseR = [
    [16.0, 0, 0, 0],
    [0, 16.0, 0, 0],
    [0, 0, 0.64, 0],
    [0, 0, 0, 0.64],
  ];

  private lastTimestamp = 0;
  private isInitialized = false;

  // Strict 10-second maximum extrapolation window during GNSS blackouts
  private cumulativeDeadReckoningSeconds = 0;
  public readonly MAX_DEAD_RECKONING_WINDOW_SECONDS = 10.0;

  constructor(processNoiseVariance = 1.8) {
    this.processNoiseVariance = processNoiseVariance;
    this.resetCovariance();
  }

  private resetCovariance(): void {
    // Initial high uncertainty on state
    this.P = [
      [25.0, 0, 0, 0, 0, 0],
      [0, 25.0, 0, 0, 0, 0],
      [0, 0, 9.0, 0, 0, 0],
      [0, 0, 0, 9.0, 0, 0],
      [0, 0, 0, 0, 4.0, 0],
      [0, 0, 0, 0, 0, 4.0],
    ];
  }

  /**
   * Projects WGS84 [lon, lat] to local tangent plane metric coordinates [x, y]
   * centered around reference origin using equirectangular projection.
   */
  private projectToMetric(coord: Coordinate): [number, number] {
    if (!this.referenceOrigin) {
      this.referenceOrigin = coord;
      return [0, 0];
    }

    const R = 6371000; // Earth radius in meters
    const rad = Math.PI / 180;
    const latRad = this.referenceOrigin[1] * rad;

    const x = (coord[0] - this.referenceOrigin[0]) * rad * R * Math.cos(latRad);
    const y = (coord[1] - this.referenceOrigin[1]) * rad * R;

    return [x, y];
  }

  /**
   * Converts local metric coordinates [x, y] back to WGS84 [lon, lat].
   */
  private projectToWgs84(x: number, y: number): Coordinate {
    if (!this.referenceOrigin) return [0, 0];

    const R = 6371000;
    const rad = Math.PI / 180;
    const latRad = this.referenceOrigin[1] * rad;

    const lon = this.referenceOrigin[0] + x / (rad * R * Math.cos(latRad));
    const lat = this.referenceOrigin[1] + y / (rad * R);

    return [Math.round(lon * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7];
  }

  /**
   * Predicts next state using kinematic state transition matrix:
   * x_{k|k-1} = F * x_{k-1}
   * P_{k|k-1} = F * P_{k-1} * F^T + Q
   */
  public predict(dtSeconds: number): void {
    const dt = Math.max(0.01, Math.min(dtSeconds, 10.0));
    const dt2 = 0.5 * dt * dt;

    // State extrapolation:
    // x = x + vx*dt + 0.5*ax*dt^2
    // y = y + vy*dt + 0.5*ay*dt^2
    // vx = vx + ax*dt
    // vy = vy + ay*dt
    const [x, y, vx, vy, ax, ay] = this.state;
    this.state = [
      x + vx * dt + ax * dt2,
      y + vy * dt + ay * dt2,
      vx + ax * dt,
      vy + ay * dt,
      ax,
      ay,
    ];

    // State transition matrix F (6x6)
    const F = [
      [1, 0, dt, 0, dt2, 0],
      [0, 1, 0, dt, 0, dt2],
      [0, 0, 1, 0, dt, 0],
      [0, 0, 0, 1, 0, dt],
      [0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 1],
    ];

    // Process noise covariance matrix Q (Discrete Wiener process acceleration model)
    const q = this.processNoiseVariance;
    const dt3 = (dt * dt * dt) / 6;
    const dt4 = (dt * dt * dt * dt) / 4;

    const Q = [
      [dt4 * q, 0, dt3 * q, 0, dt2 * q, 0],
      [0, dt4 * q, 0, dt3 * q, 0, dt2 * q],
      [dt3 * q, 0, (dt * dt) * q, 0, dt * q, 0],
      [0, dt3 * q, 0, (dt * dt) * q, 0, dt * q],
      [dt2 * q, 0, dt * q, 0, q, 0],
      [0, dt2 * q, 0, dt * q, 0, q],
    ];

    // P = F * P * F^T + Q
    this.P = this.matrixAdd(this.matrixMultiply(this.matrixMultiply(F, this.P), this.transpose(F)), Q);
  }

  /**
   * Updates state with a new GNSS / Telematics observation:
   * z = [meas_x, meas_y, meas_vx, meas_vy]^T
   */
  public update(
    coord: Coordinate,
    speedKmh: number,
    headingDeg: number,
    timestamp: number = Date.now(),
    accuracyMeters = 5.0
  ): EkfFilteredMeasurement {
    const [measX, measY] = this.projectToMetric(coord);
    const speedMps = (speedKmh * 1000) / 3600;
    const headingRad = (headingDeg * Math.PI) / 180;

    // Measured velocity components
    const measVx = speedMps * Math.sin(headingRad);
    const measVy = speedMps * Math.cos(headingRad);

    if (!this.isInitialized) {
      this.state = [measX, measY, measVx, measVy, 0, 0];
      this.lastTimestamp = timestamp;
      this.isInitialized = true;
      return {
        smoothedCoordinate: coord,
        smoothedSpeedKmh: speedKmh,
        smoothedHeadingDeg: headingDeg,
        estimatedAccelerationMps2: 0,
        covarianceTrace: 1.0,
        isExtrapolatedDeadReckoning: false,
      };
    }

    const dtSeconds = Math.max(0.05, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    this.cumulativeDeadReckoningSeconds = 0; // Fresh GNSS fix resets dead-reckoning window

    // 1. Prediction step
    this.predict(dtSeconds);

    // 2. Adjust measurement noise R based on reported GPS accuracy
    const posVar = Math.max(4.0, accuracyMeters * accuracyMeters);
    const R = [
      [posVar, 0, 0, 0],
      [0, posVar, 0, 0],
      [0, 0, 0.64, 0],
      [0, 0, 0, 0.64],
    ];

    // Measurement matrix H (4x6): maps state [x, y, vx, vy, ax, ay] to [x, y, vx, vy]
    const H = [
      [1, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 0],
    ];

    // Measurement residual: y = z - H * x
    const z = [measX, measY, measVx, measVy];
    const Hx = [this.state[0], this.state[1], this.state[2], this.state[3]];
    const y = [z[0] - Hx[0], z[1] - Hx[1], z[2] - Hx[2], z[3] - Hx[3]];

    // Innovation covariance: S = H * P * H^T + R (4x4)
    const H_P = this.matrixMultiply(H, this.P);
    const H_P_HT = this.matrixMultiply(H_P, this.transpose(H));
    const S = this.matrixAdd(H_P_HT, R);

    // Invert 4x4 S matrix
    const S_inv = this.invert4x4(S);

    // Kalman Gain: K = P * H^T * S^-1 (6x4)
    const P_HT = this.matrixMultiply(this.P, this.transpose(H));
    const K = this.matrixMultiply(P_HT, S_inv);

    // State update: x = x + K * y
    for (let i = 0; i < 6; i++) {
      let delta = 0;
      for (let j = 0; j < 4; j++) {
        delta += K[i][j] * y[j];
      }
      this.state[i] += delta;
    }

    // Covariance update: P = (I - K * H) * P
    const I = this.identity(6);
    const KH = this.matrixMultiply(K, H);
    const I_KH = this.matrixSubtract(I, KH);
    this.P = this.matrixMultiply(I_KH, this.P);

    // Compute smoothed outputs
    const smoothedCoord = this.projectToWgs84(this.state[0], this.state[1]);
    const smoothedSpeedMps = Math.sqrt(this.state[2] * this.state[2] + this.state[3] * this.state[3]);
    const smoothedSpeedKmh = Math.round(smoothedSpeedMps * 3.6 * 10) / 10;

    let smoothedHeading = (Math.atan2(this.state[2], this.state[3]) * 180) / Math.PI;
    if (smoothedHeading < 0) smoothedHeading += 360;

    const accelMps2 = Math.sqrt(this.state[4] * this.state[4] + this.state[5] * this.state[5]);
    const covarianceTrace = this.P[0][0] + this.P[1][1] + this.P[2][2] + this.P[3][3];

    return {
      smoothedCoordinate: smoothedCoord,
      smoothedSpeedKmh,
      smoothedHeadingDeg: Math.round(smoothedHeading * 10) / 10,
      estimatedAccelerationMps2: Math.round(accelMps2 * 100) / 100,
      covarianceTrace: Math.round(covarianceTrace * 100) / 100,
      isExtrapolatedDeadReckoning: false,
    };
  }

  /**
   * Dead-Reckoning Extrapolation:
   * During GNSS blackouts inside tunnels or under dense multi-tier flyovers,
   * the filter projects state pure-inertially (x_{k+1} = F * x_k) while monitoring
   * covariance uncertainty trace Tr(P), bounded to a strict 10-second maximum extrapolation window.
   */
  public extrapolateDeadReckoning(dtSeconds: number): EkfFilteredMeasurement {
    this.cumulativeDeadReckoningSeconds += dtSeconds;
    const isWindowExceeded = this.cumulativeDeadReckoningSeconds > this.MAX_DEAD_RECKONING_WINDOW_SECONDS;

    this.predict(dtSeconds);
    const smoothedCoord = this.projectToWgs84(this.state[0], this.state[1]);
    const smoothedSpeedMps = Math.sqrt(this.state[2] * this.state[2] + this.state[3] * this.state[3]);
    let smoothedHeading = (Math.atan2(this.state[2], this.state[3]) * 180) / Math.PI;
    if (smoothedHeading < 0) smoothedHeading += 360;

    const accelMps2 = Math.sqrt(this.state[4] * this.state[4] + this.state[5] * this.state[5]);

    // Monitoring covariance uncertainty trace Tr(P) = P_00 + P_11 + P_22 + P_33 + P_44 + P_55
    const covarianceTrace =
      this.P[0][0] + this.P[1][1] + this.P[2][2] + this.P[3][3] + this.P[4][4] + this.P[5][5];

    return {
      smoothedCoordinate: smoothedCoord,
      smoothedSpeedKmh: Math.round(smoothedSpeedMps * 3.6 * 10) / 10,
      smoothedHeadingDeg: Math.round(smoothedHeading * 10) / 10,
      estimatedAccelerationMps2: Math.round(accelMps2 * 100) / 100,
      covarianceTrace: Math.round(covarianceTrace * 100) / 100,
      isExtrapolatedDeadReckoning: true,
      deadReckoningDurationSeconds: Math.round(this.cumulativeDeadReckoningSeconds * 10) / 10,
      isMaxDeadReckoningWindowExceeded: isWindowExceeded,
    };
  }

  // --- Linear Algebra Utilities ---

  private matrixMultiply(A: number[][], B: number[][]): number[][] {
    const rowsA = A.length;
    const colsA = A[0].length;
    const colsB = B[0].length;
    const C: number[][] = Array.from({ length: rowsA }, () => Array(colsB).fill(0));

    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        let sum = 0;
        for (let k = 0; k < colsA; k++) {
          sum += A[i][k] * B[k][j];
        }
        C[i][j] = sum;
      }
    }
    return C;
  }

  private matrixAdd(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((val, j) => val + B[i][j]));
  }

  private matrixSubtract(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((val, j) => val - B[i][j]));
  }

  private transpose(A: number[][]): number[][] {
    return A[0].map((_, colIndex) => A.map((row) => row[colIndex]));
  }

  private identity(size: number): number[][] {
    return Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (__, j) => (i === j ? 1 : 0))
    );
  }

  private invert4x4(M: number[][]): number[][] {
    // Gauss-Jordan elimination for 4x4 matrix
    const n = 4;
    const A: number[][] = M.map((row) => [...row]);
    const inv: number[][] = this.identity(n);

    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }

      for (let k = i; k < n; k++) {
        const tmp = A[maxRow][k];
        A[maxRow][k] = A[i][k];
        A[i][k] = tmp;
      }
      for (let k = 0; k < n; k++) {
        const tmp = inv[maxRow][k];
        inv[maxRow][k] = inv[i][k];
        inv[i][k] = tmp;
      }

      const pivot = A[i][i] || 1e-9;
      for (let k = i; k < n; k++) A[i][k] /= pivot;
      for (let k = 0; k < n; k++) inv[i][k] /= pivot;

      for (let u = 0; u < n; u++) {
        if (u !== i) {
          const factor = A[u][i];
          for (let k = i; k < n; k++) A[u][k] -= factor * A[i][k];
          for (let k = 0; k < n; k++) inv[u][k] -= factor * inv[i][k];
        }
      }
    }
    return inv;
  }
}
