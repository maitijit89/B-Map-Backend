import * as crypto from 'crypto';
import * as turf from '@turf/turf';
import { logger } from '../../core/config/logger';
import { Coordinate } from '../../core/types/geo.types';
import {
  AnomalyEvaluationResult,
  MultiDeviceCluster,
  ProjectedTelemetryVector,
  TelemetryVelocityVector,
  VehicleTelemetryType,
} from './traffic.types';

export class TrafficAnomalyClusteringService {
  // Minimum number of distinct devices required to confirm genuine congestion (Quorum)
  private readonly MIN_QUORUM_DEVICES = 3;

  // Maximum spatial radius (meters) between slow devices to be considered in the same cluster/queue
  private readonly CLUSTER_EPSILON_METERS = 120;

  // Maximum lateral offset (meters) from road centerline before classifying as roadside shoulder/curb
  private readonly ROADSIDE_LATERAL_OFFSET_THRESHOLD_METERS = 3.2;

  // Speed threshold (km/h) below which a vehicle is considered stationary or crawling
  private readonly STATIONARY_SPEED_THRESHOLD_KMH = 6.0;

  // Rotating daily salt for device ID anonymization (Differential Privacy)
  private dailySalt: string = crypto.randomBytes(16).toString('hex');
  private lastSaltRotationDay: number = new Date().getUTCDate();

  /**
   * Hashes device ID with daily rotating cryptographic salt to ensure anonymization.
   */
  public anonymizeDeviceId(rawDeviceId: string): string {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== this.lastSaltRotationDay) {
      this.dailySalt = crypto.randomBytes(16).toString('hex');
      this.lastSaltRotationDay = currentDay;
    }

    return crypto
      .createHmac('sha256', this.dailySalt)
      .update(rawDeviceId)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Evaluates a single telemetry reading against current segment traffic to determine
   * if it is an isolated outlier (e.g., a scooter stopping at a roadside tea stall / tapri).
   */
  public evaluateOutlier(
    candidate: ProjectedTelemetryVector,
    allSegmentVectors: ProjectedTelemetryVector[]
  ): AnomalyEvaluationResult {
    const { speedKmh, lateralOffsetMeters, vehicleType, segmentId, anonymizedDeviceId } = candidate;

    // Filter active peer devices on the same segment within last 3 minutes
    const peerVectors = allSegmentVectors.filter(
      (v) =>
        v.anonymizedDeviceId !== anonymizedDeviceId &&
        Math.abs(v.timestamp - candidate.timestamp) <= 180000 &&
        v.isDirectionValid
    );

    // If no peers are present, assess purely based on lateral offset and speed
    if (peerVectors.length === 0) {
      if (speedKmh <= this.STATIONARY_SPEED_THRESHOLD_KMH) {
        const isRoadside = lateralOffsetMeters > this.ROADSIDE_LATERAL_OFFSET_THRESHOLD_METERS;
        return {
          deviceId: candidate.deviceId,
          segmentId,
          isOutlier: true,
          anomalyType: isRoadside ? 'TEA_STALL_PAUSE' : 'SINGLE_DEVICE_ROADSIDE_STOP',
          confidenceScore: isRoadside ? 0.94 : 0.82,
          details: {
            lateralOffsetMeters,
            speedKmh,
            segmentAverageSpeedKmh: speedKmh,
            activeClusterSize: 1,
            isExcludedFromAggregation: true,
            explanation: isRoadside
              ? `Vehicle (${vehicleType}) pulled over at lateral offset ${lateralOffsetMeters.toFixed(1)}m from centerline (roadside tea stall/curb stop). No other slow devices present.`
              : `Single isolated stationary vehicle (${vehicleType}) without multi-device corroboration. Excluded to prevent false traffic spike.`,
          },
        };
      }

      return {
        deviceId: candidate.deviceId,
        segmentId,
        isOutlier: false,
        anomalyType: 'NORMAL_TRAFFIC',
        confidenceScore: 0.9,
        details: {
          lateralOffsetMeters,
          speedKmh,
          segmentAverageSpeedKmh: speedKmh,
          activeClusterSize: 1,
          isExcludedFromAggregation: false,
          explanation: 'Normal movement with no corroborating traffic data.',
        },
      };
    }

    // Compute peer statistics
    const peerSpeeds = peerVectors.map((v) => v.projectedSpeedKmh);
    const peerMeanSpeed =
      peerSpeeds.reduce((acc, curr) => acc + curr, 0) / peerSpeeds.length;
    
    // Variance & StdDev
    const variance =
      peerSpeeds.reduce((acc, curr) => acc + Math.pow(curr - peerMeanSpeed, 2), 0) /
      peerSpeeds.length;
    const stdDev = Math.sqrt(variance);

    // Condition A: Surrounding traffic is flowing normally, but this vehicle is stationary or stopped
    const isTrafficFlowingFreely = peerMeanSpeed >= 20.0;
    const isVehicleStoppedOrCrawling = speedKmh <= this.STATIONARY_SPEED_THRESHOLD_KMH;
    const isRoadsideOffset = lateralOffsetMeters > this.ROADSIDE_LATERAL_OFFSET_THRESHOLD_METERS;

    if (isTrafficFlowingFreely && isVehicleStoppedOrCrawling) {
      // Classic roadside stop scenario (e.g. Scooter stopped at roadside tea stall)
      const isScooterOrBike = vehicleType === 'scooter' || vehicleType === 'motorcycle';
      const reasonType = isRoadsideOffset || isScooterOrBike
        ? 'TEA_STALL_PAUSE'
        : 'SINGLE_DEVICE_ROADSIDE_STOP';

      logger.info(
        `🛡️ [TRAFFIC OUTLIER] Filtered false positive: ${vehicleType} stopped (${speedKmh.toFixed(1)} km/h) at offset ${lateralOffsetMeters.toFixed(1)}m on ${segmentId} while peers flow at ${peerMeanSpeed.toFixed(1)} km/h`
      );

      return {
        deviceId: candidate.deviceId,
        segmentId,
        isOutlier: true,
        anomalyType: reasonType,
        confidenceScore: isRoadsideOffset ? 0.98 : 0.91,
        details: {
          lateralOffsetMeters,
          speedKmh,
          segmentAverageSpeedKmh: peerMeanSpeed,
          activeClusterSize: 1,
          isExcludedFromAggregation: true,
          explanation: `Prevented false positive: 1 ${vehicleType} stopped at roadside tea stall/shoulder while ${peerVectors.length} surrounding devices flow at ${peerMeanSpeed.toFixed(1)} km/h.`,
        },
      };
    }

    // Condition B: Statistical Z-Score Outlier Detection (for larger peer sets)
    if (peerVectors.length >= 4 && stdDev > 2.0) {
      const zScore = (speedKmh - peerMeanSpeed) / stdDev;
      if (zScore < -2.2) {
        return {
          deviceId: candidate.deviceId,
          segmentId,
          isOutlier: true,
          anomalyType: 'SINGLE_DEVICE_ROADSIDE_STOP',
          confidenceScore: 0.88,
          details: {
            lateralOffsetMeters,
            speedKmh,
            segmentAverageSpeedKmh: peerMeanSpeed,
            activeClusterSize: 1,
            isExcludedFromAggregation: true,
            explanation: `Statistical outlier (Z-Score ${zScore.toFixed(2)}) significantly lower than prevailing segment flow of ${peerMeanSpeed.toFixed(1)} km/h.`,
          },
        };
      }
    }

    return {
      deviceId: candidate.deviceId,
      segmentId,
      isOutlier: false,
      anomalyType: 'NORMAL_TRAFFIC',
      confidenceScore: 0.95,
      details: {
        lateralOffsetMeters,
        speedKmh,
        segmentAverageSpeedKmh: peerMeanSpeed,
        activeClusterSize: peerVectors.length + 1,
        isExcludedFromAggregation: false,
        explanation: 'Telemetry matches segment flow pattern.',
      },
    };
  }

  /**
   * Clusters slow-moving or stopped telemetry vectors spatially (DBSCAN-style proximity)
   * to determine whether an actual traffic jam exists or if they are isolated anomalies.
   */
  public clusterSlowMovingDevices(
    segmentId: string,
    vectors: ProjectedTelemetryVector[]
  ): MultiDeviceCluster[] {
    const slowVectors = vectors.filter(
      (v) => v.speedKmh <= 15.0 && v.isDirectionValid
    );

    if (slowVectors.length === 0) {
      return [];
    }

    const clusters: MultiDeviceCluster[] = [];
    const visited = new Set<string>();

    for (let i = 0; i < slowVectors.length; i++) {
      const seed = slowVectors[i];
      const seedId = seed.anonymizedDeviceId || seed.deviceId;
      if (visited.has(seedId)) continue;

      const currentClusterDevices: ProjectedTelemetryVector[] = [];
      const queue: ProjectedTelemetryVector[] = [seed];
      visited.add(seedId);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        currentClusterDevices.push(curr);

        for (const candidate of slowVectors) {
          const candId = candidate.anonymizedDeviceId || candidate.deviceId;
          if (visited.has(candId)) continue;

          const distanceMeters = turf.distance(
            turf.point(curr.coordinate),
            turf.point(candidate.coordinate),
            { units: 'meters' }
          );

          if (distanceMeters <= this.CLUSTER_EPSILON_METERS) {
            visited.add(candId);
            queue.push(candidate);
          }
        }
      }

      // Compute cluster centroid
      const sumLon = currentClusterDevices.reduce((sum, d) => sum + d.coordinate[0], 0);
      const sumLat = currentClusterDevices.reduce((sum, d) => sum + d.coordinate[1], 0);
      const centroid: Coordinate = [
        sumLon / currentClusterDevices.length,
        sumLat / currentClusterDevices.length,
      ];

      // Average speed inside cluster
      const avgSpeed =
        currentClusterDevices.reduce((sum, d) => sum + d.speedKmh, 0) /
        currentClusterDevices.length;

      const isQuorum = currentClusterDevices.length >= this.MIN_QUORUM_DEVICES;

      let classification: MultiDeviceCluster['classification'] = 'ISOLATED_ANOMALY';
      let confidenceScore = 0.5;

      if (isQuorum) {
        classification = 'CONFIRMED_CONGESTION';
        confidenceScore = Math.min(0.99, 0.75 + currentClusterDevices.length * 0.05);
      } else {
        // Less than quorum devices (e.g. 1 scooter at tea stall or 2 parked cars)
        const hasRoadsideStop = currentClusterDevices.some(
          (d) => d.lateralOffsetMeters > this.ROADSIDE_LATERAL_OFFSET_THRESHOLD_METERS
        );
        classification = hasRoadsideStop ? 'ROADSIDE_PAUSE' : 'ISOLATED_ANOMALY';
        confidenceScore = 0.92;
      }

      clusters.push({
        clusterId: `cluster_${segmentId}_${Date.now()}_${clusters.length + 1}`,
        segmentId,
        centroid,
        deviceCount: currentClusterDevices.length,
        averageSpeedKmh: Math.round(avgSpeed * 10) / 10,
        isQuorumReached: isQuorum,
        classification,
        confidenceScore,
        devices: currentClusterDevices.map((d) => ({
          anonymizedDeviceId: d.anonymizedDeviceId || d.deviceId,
          vehicleType: d.vehicleType,
          speedKmh: d.speedKmh,
          lateralOffsetMeters: d.lateralOffsetMeters,
        })),
      });
    }

    return clusters;
  }
}

export const trafficAnomalyClusteringService = new TrafficAnomalyClusteringService();
export const dbscanAnomalyClusteringEngineService = trafficAnomalyClusteringService;
