import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { Coordinate } from '../../core/types/geo.types';
import { trafficEtaService } from './traffic-eta.service';
import { trafficGraphService } from './traffic-graph.service';
import { trafficShockwaveService } from './traffic-shockwave.service';
import { ecoRoutingService } from './eco-routing.service';
import { antiSpoofingGuard } from '../../core/security/anti-spoofing.guard';
import { telemetrySignerGuard } from '../../core/security/telemetry-signer.guard';
import { proofOfPresenceService } from '../../core/security/proof-of-presence';
import { TelemetryVelocityVector } from './traffic.types';

export class TrafficController {
  /**
   * POST /api/v1/traffic/telemetry
   * Ingests a batch of crowdsourced telemetry velocity vectors from active devices.
   */
  async ingestTelemetry(req: Request, res: Response): Promise<void> {
    try {
      const { vectors } = req.body;

      if (!Array.isArray(vectors) || vectors.length === 0) {
        sendError(res, 400, 'Request body must contain a non-empty "vectors" array');
        return;
      }

      // Validate coordinates in each vector [longitude, latitude]
      for (const v of vectors) {
        if (!v.coordinate || !Array.isArray(v.coordinate) || v.coordinate.length !== 2) {
          sendError(
            res,
            400,
            'Each telemetry vector must have a valid [longitude, latitude] coordinate pair'
          );
          return;
        }
        if (typeof v.speedKmh !== 'number' || typeof v.headingDeg !== 'number') {
          sendError(res, 400, 'Each telemetry vector must specify numeric speedKmh and headingDeg');
          return;
        }
      }

      const result = await trafficEtaService.ingestCrowdsourcedTelemetry(
        vectors as TelemetryVelocityVector[]
      );

      sendSuccess({
        res,
        statusCode: 200,
        message: `Successfully processed ${result.processedCount} crowdsourced telemetry vectors`,
        data: result,
      });
    } catch (err: any) {
      sendError(res, 500, err.message || 'Failed to ingest telemetry vectors');
    }
  }

  /**
   * POST /api/v1/traffic/eta
   * Calculates real-time traffic and ETAs weighted by travel time in MINUTES (not kilometers).
   */
  async calculateRealtimeEta(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, departureTime } = req.body;

      if (!origin || !Array.isArray(origin) || origin.length !== 2) {
        sendError(res, 400, 'origin must be an array of [longitude, latitude]');
        return;
      }
      if (!destination || !Array.isArray(destination) || destination.length !== 2) {
        sendError(res, 400, 'destination must be an array of [longitude, latitude]');
        return;
      }

      const departureDate = departureTime ? new Date(departureTime) : new Date();
      if (isNaN(departureDate.getTime())) {
        sendError(res, 400, 'Invalid departureTime format. Expected ISO-8601 string');
        return;
      }

      const result = await trafficEtaService.calculateRealtimeEta(
        origin as Coordinate,
        destination as Coordinate,
        departureDate
      );

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Real-time traffic ETA calculated successfully',
        data: result,
      });
    } catch (err: any) {
      sendError(res, 400, err.message || 'Failed to calculate traffic ETA');
    }
  }

  /**
   * POST /api/v1/traffic/evaluate-anomaly
   * Evaluates multi-device clustering and outlier rejection to prevent false positives
   * (e.g., verifying that one scooter stopping at a roadside tea stall does not cause a false traffic jam).
   */
  async evaluateAnomaly(req: Request, res: Response): Promise<void> {
    try {
      const { candidate, targetSegmentId } = req.body;

      if (!candidate || !candidate.coordinate || !Array.isArray(candidate.coordinate)) {
        sendError(
          res,
          400,
          'candidate object with [longitude, latitude] coordinate is required'
        );
        return;
      }

      const evaluation = trafficEtaService.evaluateAnomalyCandidate(
        candidate as TelemetryVelocityVector,
        targetSegmentId
      );

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Anomaly and multi-device clustering evaluated successfully',
        data: evaluation,
      });
    } catch (err: any) {
      sendError(res, 500, err.message || 'Failed to evaluate anomaly');
    }
  }

  /**
   * GET /api/v1/traffic/segments
   * Returns all road segments with live speeds, congestion levels, active device counts,
   * and travel times in minutes.
   */
  async getSegments(req: Request, res: Response): Promise<void> {
    try {
      await trafficGraphService.refreshAllGraphWeights(new Date());
      const segments = trafficGraphService.getAllEdges();

      sendSuccess({
        res,
        statusCode: 200,
        message: `Retrieved ${segments.length} road segments with real-time weights`,
        data: {
          totalSegments: segments.length,
          segments,
        },
      });
    } catch (err: any) {
      sendError(res, 500, err.message || 'Failed to fetch road segments');
    }
  }

  /**
   * GET /api/v1/traffic/segments/:segmentId
   * Returns real-time and historical traffic prediction for a specific segment.
   */
  async getSegmentDetails(req: Request, res: Response): Promise<void> {
    try {
      const rawSegmentId = req.params.segmentId;
      const segmentId = Array.isArray(rawSegmentId) ? rawSegmentId[0] : rawSegmentId;
      const { targetTime } = req.query;

      const targetDate = targetTime ? new Date(targetTime as string) : new Date();
      const details = trafficEtaService.getSegmentPrediction(segmentId, targetDate);

      if (!details) {
        sendError(res, 404, `Segment with ID ${segmentId} not found in road network`);
        return;
      }

      sendSuccess({
        res,
        statusCode: 200,
        message: `Traffic details for segment ${segmentId}`,
        data: details,
      });
    } catch (err: any) {
      sendError(res, 500, err.message || 'Failed to fetch segment traffic details');
    }
  }

  /**
   * GET /api/v1/traffic/predict
   * Forecasts corridor traffic across future time windows combining live telemetry with historical distributions.
   */
  async predictCorridorTraffic(req: Request, res: Response): Promise<void> {
    try {
      const { segmentId, targetTime } = req.query;

      if (!segmentId) {
        sendError(res, 400, 'segmentId query parameter is required');
        return;
      }

      const targetDate = targetTime ? new Date(targetTime as string) : new Date();
      const prediction = trafficEtaService.getSegmentPrediction(
        segmentId as string,
        targetDate
      );

      if (!prediction) {
        sendError(res, 404, `Segment with ID ${segmentId} not found`);
        return;
      }

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Traffic forecast computed successfully',
        data: prediction,
      });
    } catch (err: any) {
      sendError(res, 500, err.message || 'Failed to predict traffic');
    }
  }

  /**
   * GET /api/v1/traffic/graph
   * Retrieves directed road graph topology: intersections as nodes and road segments as edges
   * weighted by travel time in MINUTES (not kilometers).
   */
  async getRoadGraph(req: Request, res: Response): Promise<void> {
    try {
      await trafficGraphService.refreshAllGraphWeights(new Date());
      const graph = trafficEtaService.getRoadNetworkGraph();

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Road network graph topology retrieved successfully',
        data: graph,
      });
    } catch (err: any) {
      sendError(res, 500, err.message || 'Failed to fetch road graph');
    }
  }

  /**
   * GET /api/v1/traffic/shockwave/:segmentId
   * Computes Lighthill-Whitham-Richards (LWR) traffic shockwave speed and queue spillback time.
   */
  async getShockwaveAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const rawSegmentId = req.params.segmentId;
      const segmentId = Array.isArray(rawSegmentId) ? rawSegmentId[0] : rawSegmentId;
      const segment = trafficGraphService.getEdge(segmentId);

      if (!segment) {
        sendError(res, 404, `Segment with ID ${segmentId} not found`);
        return;
      }

      const upstreamSegment = trafficGraphService
        .getAllEdges()
        .find((e) => e.toNodeId === segment.fromNodeId);

      const shockwave = trafficShockwaveService.analyzeSegmentShockwave(segment, upstreamSegment);

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Traffic shockwave and queue spillback dynamics analyzed successfully',
        data: shockwave,
      });
    } catch (err: any) {
      sendError(res, 500, err.message || 'Failed to analyze traffic shockwave');
    }
  }

  /**
   * POST /api/v1/traffic/eco
   * Calculates physics-based energy consumption (kWh or Liters) and CO2 emissions for a route.
   */
  async calculateEcoRoute(req: Request, res: Response): Promise<void> {
    try {
      const { segmentIds, vehicleProfile } = req.body;

      if (!Array.isArray(segmentIds) || segmentIds.length === 0) {
        sendError(res, 400, 'segmentIds array is required');
        return;
      }

      const edges = segmentIds
        .map((id: string) => trafficGraphService.getEdge(id))
        .filter((e): e is NonNullable<typeof e> => e !== undefined);

      if (edges.length === 0) {
        sendError(res, 404, 'No matching road segments found for provided IDs');
        return;
      }

      const ecoResult = ecoRoutingService.evaluateRouteEco(edges, vehicleProfile);

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Eco-routing physics energy and emissions evaluation completed',
        data: ecoResult,
      });
    } catch (err: any) {
      sendError(res, 500, err.message || 'Failed to evaluate eco route');
    }
  }

  /**
   * POST /api/v1/traffic/security/anti-spoofing
   * Assesses incoming telematics kinematic plausibility, anti-spoofing integrity, and replay defense.
   */
  async verifyTelemetrySecurity(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, coordinate, speedKmh, headingDeg, timestamp, accuracyMeters } = req.body;

      if (!deviceId || !coordinate || !Array.isArray(coordinate) || coordinate.length !== 2) {
        sendError(res, 400, 'deviceId and valid [lon, lat] coordinate are required');
        return;
      }

      const assessment = antiSpoofingGuard.verifyTelemetryPlausibility(deviceId, {
        coordinate: coordinate as Coordinate,
        speedKmh: speedKmh ?? 0,
        headingDeg: headingDeg ?? 0,
        timestamp: timestamp ?? Date.now(),
        accuracyMeters,
      });

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Kinematic anti-spoofing plausibility assessment completed',
        data: assessment,
      });
    } catch (err: any) {
      sendError(res, 500, err.message || 'Failed to verify telemetry plausibility');
    }
  }

  /**
   * POST /api/v1/traffic/security/proof-of-presence
   * Issues a cryptographically signed Proof-of-Presence certificate for sovereign tolling & deliveries.
   */
  async createProofOfPresence(req: Request, res: Response): Promise<void> {
    try {
      const { subjectId, locationName, targetCoordinate, geofenceRadiusMeters, observedCoordinate, observedSpeedKmh } = req.body;

      if (
        !subjectId ||
        !targetCoordinate ||
        !Array.isArray(targetCoordinate) ||
        targetCoordinate.length !== 2 ||
        !observedCoordinate ||
        !Array.isArray(observedCoordinate) ||
        observedCoordinate.length !== 2
      ) {
        sendError(res, 400, 'subjectId, valid targetCoordinate [lon, lat], and observedCoordinate [lon, lat] are required');
        return;
      }

      const proof = proofOfPresenceService.generateProofOfPresence({
        subjectId,
        locationName: locationName || 'Verified Corridor',
        targetCoordinate: targetCoordinate as Coordinate,
        geofenceRadiusMeters: geofenceRadiusMeters || 100,
        observedCoordinate: observedCoordinate as Coordinate,
        observedSpeedKmh: observedSpeedKmh ?? 0,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Cryptographic Proof-of-Presence certificate issued successfully',
        data: proof,
      });
    } catch (err: any) {
      sendError(res, 400, err.message || 'Failed to generate Proof-of-Presence');
    }
  }

  /**
   * POST /api/v1/traffic/security/proof-of-presence/verify
   * Cryptographically validates a Proof-of-Presence attestation certificate.
   */
  async verifyProofOfPresenceCertificate(req: Request, res: Response): Promise<void> {
    try {
      const { attestation } = req.body;

      if (!attestation || !attestation.signature || !attestation.payload) {
        sendError(res, 400, 'Valid signed attestation object is required');
        return;
      }

      const verification = proofOfPresenceService.verifyProofOfPresence(attestation);

      sendSuccess({
        res,
        statusCode: 200,
        message: verification.reason,
        data: verification,
      });
    } catch (err: any) {
      sendError(res, 500, err.message || 'Failed to verify Proof-of-Presence attestation');
    }
  }
}

export const trafficController = new TrafficController();
