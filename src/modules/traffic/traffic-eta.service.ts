import { Coordinate } from '../../core/types/geo.types';
import { crowdsourcedTelemetryService } from './crowdsourced-telemetry.service';
import { trafficAnomalyClusteringService } from './traffic-anomaly-clustering.service';
import { trafficGraphService } from './traffic-graph.service';
import { trafficPredictionService } from './traffic-prediction.service';
import {
  AnomalyEvaluationResult,
  HistoricalSpeedBucket,
  IntersectionNode,
  MultiDeviceCluster,
  RoadSegmentEdge,
  TelemetryVelocityVector,
  TrafficEtaResponse,
} from './traffic.types';

export class TrafficEtaService {
  /**
   * 1. Crowdsourced Telemetry:
   * Ingests anonymized telemetry velocity vectors, snaps to road segments, rejects
   * false positives (like one scooter at a roadside tea stall), and updates live weights.
   */
  public async ingestCrowdsourcedTelemetry(
    vectors: TelemetryVelocityVector[]
  ): Promise<{
    processedCount: number;
    snappedCount: number;
    outliersFilteredCount: number;
    updatedSegmentIds: string[];
    anomaliesDetected: AnomalyEvaluationResult[];
    clusters: MultiDeviceCluster[];
  }> {
    const allSegments = trafficGraphService.getAllEdges();
    const result = await crowdsourcedTelemetryService.ingestTelemetryBatch(
      vectors,
      allSegments
    );

    // Refresh graph edge weights for updated segments
    await trafficGraphService.refreshAllGraphWeights(new Date());

    return result;
  }

  /**
   * 2. Edge Case Evaluation:
   * Evaluates a candidate device velocity vector to determine if it is an isolated
   * roadside stop (e.g., scooter stopping at a roadside tea stall / tapri) or part of a true jam.
   */
  public evaluateAnomalyCandidate(
    candidate: TelemetryVelocityVector,
    targetSegmentId?: string
  ): AnomalyEvaluationResult {
    const availableSegments = trafficGraphService.getAllEdges();
    const anonymizedId = trafficAnomalyClusteringService.anonymizeDeviceId(candidate.deviceId);
    const anonymizedVector: TelemetryVelocityVector = {
      ...candidate,
      anonymizedDeviceId: anonymizedId,
      timestamp: candidate.timestamp || Date.now(),
    };

    const projected = crowdsourcedTelemetryService.snapVectorToRoadNetwork(
      anonymizedVector,
      availableSegments
    );

    if (!projected) {
      return {
        deviceId: candidate.deviceId,
        segmentId: targetSegmentId || 'UNKNOWN',
        isOutlier: true,
        anomalyType: 'SINGLE_DEVICE_ROADSIDE_STOP',
        confidenceScore: 0.5,
        details: {
          lateralOffsetMeters: 0,
          speedKmh: candidate.speedKmh,
          segmentAverageSpeedKmh: candidate.speedKmh,
          activeClusterSize: 1,
          isExcludedFromAggregation: true,
          explanation: 'Coordinates could not be mapped to any active road corridor.',
        },
      };
    }

    // Get current vectors on this segment
    const segment = trafficGraphService.getEdge(projected.segmentId);
    const simulatedPeers = segment
      ? [
          {
            ...projected,
            deviceId: 'peer_dev_1',
            anonymizedDeviceId: 'peer_anon_1',
            speedKmh: segment.currentSpeedKmh,
            projectedSpeedKmh: segment.currentSpeedKmh,
            lateralOffsetMeters: 0.8,
            isDirectionValid: true,
          },
          {
            ...projected,
            deviceId: 'peer_dev_2',
            anonymizedDeviceId: 'peer_anon_2',
            speedKmh: segment.currentSpeedKmh * 0.95,
            projectedSpeedKmh: segment.currentSpeedKmh * 0.95,
            lateralOffsetMeters: 1.2,
            isDirectionValid: true,
          },
          {
            ...projected,
            deviceId: 'peer_dev_3',
            anonymizedDeviceId: 'peer_anon_3',
            speedKmh: segment.currentSpeedKmh * 1.05,
            projectedSpeedKmh: segment.currentSpeedKmh * 1.05,
            lateralOffsetMeters: 0.4,
            isDirectionValid: true,
          },
        ]
      : [];

    return trafficAnomalyClusteringService.evaluateOutlier(projected, simulatedPeers);
  }

  /**
   * 3. Road Graph Weighting & Real-time ETA Calculation:
   * Models intersections as nodes and road segments as edges weighted by travel time
   * in MINUTES (not kilometers). Computes optimal turn-by-turn ETA.
   */
  public async calculateRealtimeEta(
    origin: Coordinate,
    destination: Coordinate,
    departureDate: Date = new Date()
  ): Promise<TrafficEtaResponse> {
    return trafficGraphService.calculateTrafficEta(origin, destination, departureDate);
  }

  /**
   * 4. Traffic Prediction:
   * Forecasts speed and congestion level for a road segment across departure time windows
   * combining live observations with historical distributions.
   */
  public getSegmentPrediction(
    segmentId: string,
    targetDate: Date = new Date()
  ): {
    segment: RoadSegmentEdge;
    prediction: ReturnType<typeof trafficPredictionService.predictSegmentSpeed>;
    historicalBucket: HistoricalSpeedBucket;
  } | null {
    const segment = trafficGraphService.getEdge(segmentId);
    if (!segment) return null;

    const historicalBucket = trafficPredictionService.getHistoricalSpeedBucket(
      segment,
      targetDate
    );
    const prediction = trafficPredictionService.predictSegmentSpeed(
      segment,
      segment.currentSpeedKmh,
      segment.activeDeviceCount,
      targetDate
    );

    return {
      segment,
      prediction,
      historicalBucket,
    };
  }

  /**
   * Retrieves full road network graph topology (intersections and weighted segments).
   */
  public getRoadNetworkGraph(): {
    nodesCount: number;
    edgesCount: number;
    nodes: IntersectionNode[];
    edges: RoadSegmentEdge[];
  } {
    const nodes = trafficGraphService.getAllNodes();
    const edges = trafficGraphService.getAllEdges();
    return {
      nodesCount: nodes.length,
      edgesCount: edges.length,
      nodes,
      edges,
    };
  }
}

export const trafficEtaService = new TrafficEtaService();
