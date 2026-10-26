import * as turf from '@turf/turf';
import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { Coordinate } from '../../core/types/geo.types';
import { calculateBearing } from '../../core/utils/geo.utils';
import { trafficAnomalyClusteringService } from './traffic-anomaly-clustering.service';
import {
  AnomalyEvaluationResult,
  MultiDeviceCluster,
  ProjectedTelemetryVector,
  RoadSegmentEdge,
  TelemetryVelocityVector,
} from './traffic.types';

export class CrowdsourcedTelemetryService {
  // Sliding window buffer duration: 5 minutes (300,000 ms)
  private readonly ROLLING_WINDOW_MS = 5 * 60 * 1000;

  // In-memory telemetry buffer: segmentId -> ProjectedTelemetryVector[]
  private segmentTelemetryBuffer = new Map<string, ProjectedTelemetryVector[]>();

  // In-memory segment current speeds cache: segmentId -> { harmonicSpeedKmh, activeDevices, lastUpdated }
  private segmentSpeedsCache = new Map<
    string,
    {
      harmonicSpeedKmh: number;
      activeDevices: number;
      lastUpdated: number;
      clusterStatus: string;
      outliersFilteredCount: number;
    }
  >();

  /**
   * Ingests a batch of real-time velocity vectors from active mobile/telematics devices,
   * anonymizes identities, snaps to road segments, filters edge cases (e.g. roadside tea stall),
   * and recalculates harmonic average segment speeds.
   */
  public async ingestTelemetryBatch(
    telemetryBatch: TelemetryVelocityVector[],
    availableSegments: RoadSegmentEdge[]
  ): Promise<{
    processedCount: number;
    snappedCount: number;
    outliersFilteredCount: number;
    updatedSegmentIds: string[];
    anomaliesDetected: AnomalyEvaluationResult[];
    clusters: MultiDeviceCluster[];
  }> {
    const updatedSegmentsSet = new Set<string>();
    const anomaliesDetected: AnomalyEvaluationResult[] = [];
    const allClusters: MultiDeviceCluster[] = [];
    let snappedCount = 0;
    let outliersFilteredCount = 0;

    for (const raw of telemetryBatch) {
      // 1. Differential Privacy: Anonymize raw device identifier
      const anonymizedId = trafficAnomalyClusteringService.anonymizeDeviceId(raw.deviceId);
      const anonymizedVector: TelemetryVelocityVector = {
        ...raw,
        anonymizedDeviceId: anonymizedId,
        timestamp: raw.timestamp || Date.now(),
      };

      // 2. Map-snap vector to nearest active road segment
      const projected = this.snapVectorToRoadNetwork(anonymizedVector, availableSegments);
      if (!projected) {
        continue;
      }
      snappedCount++;

      // 3. Retrieve or initialize segment buffer
      const segmentId = projected.segmentId;
      const now = Date.now();
      const existingBuffer = this.getCleanSegmentBuffer(segmentId, now);

      // 4. Edge Case Check: Multi-device clustering & outlier rejection (tea stall false positive filter)
      const anomalyEvaluation = trafficAnomalyClusteringService.evaluateOutlier(
        projected,
        existingBuffer
      );

      projected.isOutlier = anomalyEvaluation.isOutlier;
      projected.anomalyReason = anomalyEvaluation.details.explanation;

      if (anomalyEvaluation.isOutlier) {
        anomaliesDetected.push(anomalyEvaluation);
        outliersFilteredCount++;
      }

      // Add to segment buffer
      existingBuffer.push(projected);
      this.segmentTelemetryBuffer.set(segmentId, existingBuffer);
      updatedSegmentsSet.add(segmentId);
    }

    // 5. Recompute harmonic segment speed and clustering for updated segments
    for (const segmentId of updatedSegmentsSet) {
      const buffer = this.getCleanSegmentBuffer(segmentId, Date.now());
      const clusters = trafficAnomalyClusteringService.clusterSlowMovingDevices(
        segmentId,
        buffer
      );
      allClusters.push(...clusters);

      // If quorum confirmed congestion exists, unmark outlier status for corroborated cluster devices
      const confirmedCongestionCluster = clusters.find(
        (c) => c.classification === 'CONFIRMED_CONGESTION' && c.isQuorumReached
      );

      if (confirmedCongestionCluster) {
        for (const v of buffer) {
          if (v.speedKmh <= 15.0 && v.isDirectionValid) {
            v.isOutlier = false;
          }
        }
      }

      // Calculate Space Mean Speed using Harmonic Mean (excluding remaining isolated outliers)
      const validVectors = buffer.filter((v) => !v.isOutlier && v.isDirectionValid);

      let harmonicSpeedKmh: number;
      let clusterStatus = 'NORMAL';

      if (validVectors.length > 0) {
        // Harmonic Mean: N / sum(1 / v_i)
        const sumInvertedSpeeds = validVectors.reduce(
          (sum, v) => sum + 1.0 / Math.max(v.projectedSpeedKmh, 2.0),
          0
        );
        harmonicSpeedKmh = Math.round((validVectors.length / sumInvertedSpeeds) * 10) / 10;

        // If quorum confirmed congestion exists, enforce the congestion speed
        const confirmedCongestionCluster = clusters.find(
          (c) => c.classification === 'CONFIRMED_CONGESTION' && c.isQuorumReached
        );

        if (confirmedCongestionCluster) {
          harmonicSpeedKmh = Math.min(harmonicSpeedKmh, confirmedCongestionCluster.averageSpeedKmh);
          clusterStatus = 'CONFIRMED_CONGESTION';
        }
      } else {
        // Fallback to free flow or historical if only outliers were present
        const segment = availableSegments.find((s) => s.segmentId === segmentId);
        harmonicSpeedKmh = segment ? segment.freeFlowSpeedKmh : 50.0;
        clusterStatus = buffer.some((v) => v.isOutlier) ? 'OUTLIER_SUPPRESSED' : 'NO_DATA';
      }

      // Update segment speeds cache
      const segmentMetrics = {
        harmonicSpeedKmh,
        activeDevices: validVectors.length,
        lastUpdated: Date.now(),
        clusterStatus,
        outliersFilteredCount: buffer.filter((v) => v.isOutlier).length,
      };

      this.segmentSpeedsCache.set(segmentId, segmentMetrics);

      // Persist to Redis if available for sub-millisecond edge queries
      await this.saveSegmentSpeedToRedis(segmentId, segmentMetrics);
    }

    return {
      processedCount: telemetryBatch.length,
      snappedCount,
      outliersFilteredCount,
      updatedSegmentIds: Array.from(updatedSegmentsSet),
      anomaliesDetected,
      clusters: allClusters,
    };
  }

  /**
   * Snaps an anonymized telemetry vector to candidate road segments using spatial proximity
   * and bearing alignment.
   */
  public snapVectorToRoadNetwork(
    vector: TelemetryVelocityVector,
    availableSegments: RoadSegmentEdge[],
    maxSearchRadiusMeters = 60
  ): ProjectedTelemetryVector | null {
    if (!availableSegments || availableSegments.length === 0) return null;

    const devicePt = turf.point(vector.coordinate);
    let bestSegment: RoadSegmentEdge | null = null;
    let minPerpendicularDistanceMeters = Infinity;
    let bestSnappedCoord: Coordinate = vector.coordinate;
    let bestAlignmentCos = 0;
    let isDirectionValid = false;

    for (const segment of availableSegments) {
      if (!segment.geometry || segment.geometry.length < 2) continue;

      // Cache Turf LineString on segment to prevent duplicate object allocations
      const segmentLine =
        (segment as any)._turfLineString ||
        ((segment as any)._turfLineString = turf.lineString(segment.geometry));

      const snapped = turf.nearestPointOnLine(segmentLine, devicePt);
      const distMeters = (snapped.properties.dist ?? 0) * 1000;

      if (distMeters <= maxSearchRadiusMeters && distMeters < minPerpendicularDistanceMeters) {
        // Cache segment direction bearing
        const segBearing =
          (segment as any)._cachedBearing !== undefined
            ? (segment as any)._cachedBearing
            : ((segment as any)._cachedBearing = calculateBearing(
                segment.geometry[0],
                segment.geometry[segment.geometry.length - 1]
              ));

        // Normalize bearings to [0, 360]
        const normSegBearing = (segBearing + 360) % 360;
        const normDeviceHeading = (vector.headingDeg + 360) % 360;

        // Angle difference (-180..180)
        let angleDiff = Math.abs(normDeviceHeading - normSegBearing);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;

        // If vehicle is moving very slowly (< 3 km/h), heading can be noisy; accept it
        const directionValid = vector.speedKmh < 3.0 || angleDiff <= 65;
        const alignmentCos = Math.cos((angleDiff * Math.PI) / 180);

        if (directionValid || !segment.oneWay) {
          minPerpendicularDistanceMeters = distMeters;
          bestSegment = segment;
          bestSnappedCoord = [
            snapped.geometry.coordinates[0],
            snapped.geometry.coordinates[1],
          ];
          bestAlignmentCos = alignmentCos;
          isDirectionValid = directionValid;
        }
      }
    }

    if (!bestSegment) {
      return null;
    }

    // Projected speed along the road segment
    const effectiveSpeed = Math.max(0, vector.speedKmh * Math.max(0.1, bestAlignmentCos));

    return {
      ...vector,
      segmentId: bestSegment.segmentId,
      projectedCoordinate: bestSnappedCoord,
      lateralOffsetMeters: Math.round(minPerpendicularDistanceMeters * 10) / 10,
      vectorAlignmentCos: Math.round(bestAlignmentCos * 100) / 100,
      projectedSpeedKmh: Math.round(effectiveSpeed * 10) / 10,
      isDirectionValid,
    };
  }

  /**
   * Retrieves live harmonic speed and active device count for a road segment.
   * Leverages in-memory cache fast path first to eliminate network round-trip latency.
   */
  public async getSegmentLiveSpeed(
    segmentId: string
  ): Promise<{
    harmonicSpeedKmh: number;
    activeDevices: number;
    lastUpdated: number;
    clusterStatus: string;
    hasLiveData: boolean;
  } | null> {
    // 1. In-memory cache fast-path check: if fresh within rolling window, return directly
    const cached = this.segmentSpeedsCache.get(segmentId);
    if (cached && Date.now() - cached.lastUpdated <= this.ROLLING_WINDOW_MS) {
      return {
        ...cached,
        hasLiveData: cached.activeDevices > 0,
      };
    }

    // 2. Try Redis if connected
    if (isRedisConnected()) {
      try {
        const redis = getRedisClient();
        const data = await redis.hgetall(`traffic:segment:${segmentId}`);
        if (data && data.harmonicSpeedKmh) {
          const result = {
            harmonicSpeedKmh: parseFloat(data.harmonicSpeedKmh),
            activeDevices: parseInt(data.activeDevices, 10) || 0,
            lastUpdated: parseInt(data.lastUpdated, 10) || Date.now(),
            clusterStatus: data.clusterStatus || 'NORMAL',
            hasLiveData: true,
          };
          this.segmentSpeedsCache.set(segmentId, {
            ...result,
            outliersFilteredCount: 0,
          });
          return result;
        }
      } catch (err: any) {
        logger.warn(`Redis traffic segment read error: ${err.message}`);
      }
    }

    if (cached) {
      return {
        ...cached,
        hasLiveData: false,
      };
    }

    return null;
  }

  /**
   * Evicts expired telemetry vectors beyond the rolling window (5 mins).
   */
  private getCleanSegmentBuffer(segmentId: string, now: number): ProjectedTelemetryVector[] {
    const buffer = this.segmentTelemetryBuffer.get(segmentId) || [];
    const clean = buffer.filter((v) => now - v.timestamp <= this.ROLLING_WINDOW_MS);
    this.segmentTelemetryBuffer.set(segmentId, clean);
    return clean;
  }

  /**
   * Caches computed segment speed in Redis with 10-minute TTL.
   */
  private async saveSegmentSpeedToRedis(
    segmentId: string,
    metrics: {
      harmonicSpeedKmh: number;
      activeDevices: number;
      lastUpdated: number;
      clusterStatus: string;
    }
  ): Promise<void> {
    if (!isRedisConnected()) return;

    try {
      const redis = getRedisClient();
      const key = `traffic:segment:${segmentId}`;
      await redis.hset(key, {
        harmonicSpeedKmh: metrics.harmonicSpeedKmh.toString(),
        activeDevices: metrics.activeDevices.toString(),
        lastUpdated: metrics.lastUpdated.toString(),
        clusterStatus: metrics.clusterStatus,
      });
      await redis.expire(key, 600); // 10 minutes TTL
    } catch (err: any) {
      logger.warn(`Failed persisting segment speed to Redis: ${err.message}`);
    }
  }
}

export const crowdsourcedTelemetryService = new CrowdsourcedTelemetryService();
export const crowdsourcedTelemetryEngineService = crowdsourcedTelemetryService;
