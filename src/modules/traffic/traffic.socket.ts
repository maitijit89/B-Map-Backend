import { Server, Socket } from 'socket.io';
import { logger } from '../../core/config/logger';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { Coordinate } from '../../core/types/geo.types';
import { trafficEtaService } from './traffic-eta.service';
import { trafficGraphService } from './traffic-graph.service';
import { trafficShockwaveService } from './traffic-shockwave.service';
import { TelemetryVelocityVector } from './traffic.types';

export const registerTrafficSocketHandlers = (io: Server, socket: Socket): void => {
  /**
   * 1. High-frequency Crowdsourced Telemetry Ingestion Stream:
   * Client transmits real-time velocity vector: [lon, lat], speed, heading, accuracy.
   */
  socket.on(
    SOCKET_EVENTS.TRAFFIC_TELEMETRY_STREAM,
    async (data: {
      deviceId: string;
      coordinate: Coordinate;
      speedKmh: number;
      headingDeg: number;
      accuracyMeters?: number;
      vehicleType?: string;
    }) => {
      try {
        if (!data.coordinate || typeof data.speedKmh !== 'number') {
          return;
        }

        const vector: TelemetryVelocityVector = {
          deviceId: data.deviceId || socket.id,
          coordinate: data.coordinate,
          speedKmh: data.speedKmh,
          headingDeg: data.headingDeg || 0,
          accuracyMeters: data.accuracyMeters,
          timestamp: Date.now(),
          vehicleType: (data.vehicleType as any) || 'car',
        };

        // Ingest into telemetry & clustering pipeline
        const result = await trafficEtaService.ingestCrowdsourcedTelemetry([vector]);

        // If an anomaly was filtered (e.g. scooter stopped at roadside tea stall), notify the sender
        if (result.anomaliesDetected.length > 0) {
          const anomaly = result.anomaliesDetected[0];
          socket.emit(SOCKET_EVENTS.TRAFFIC_ANOMALY_FILTERED, {
            segmentId: anomaly.segmentId,
            anomalyType: anomaly.anomalyType,
            confidenceScore: anomaly.confidenceScore,
            explanation: anomaly.details.explanation,
          });
        }

        // Broadcast updated segment speeds to room segment:<segmentId> and global subscribers
        for (const segmentId of result.updatedSegmentIds) {
          const edge = trafficGraphService.getEdge(segmentId);
          if (edge) {
            const shockwave = edge.congestionLevel === 'congested' || edge.congestionLevel === 'severe_gridlock'
              ? trafficShockwaveService.analyzeSegmentShockwave(edge)
              : null;

            const updatePayload = {
              segmentId: edge.segmentId,
              name: edge.name,
              currentSpeedKmh: edge.effectiveSpeedKmh,
              travelTimeMinutes: edge.travelTimeMinutes,
              congestionLevel: edge.congestionLevel,
              activeDeviceCount: edge.activeDeviceCount,
              shockwave: shockwave
                ? {
                    direction: shockwave.direction,
                    velocityKmh: shockwave.shockwaveVelocityKmh,
                    spillbackTimeToUpstreamMinutes: shockwave.spillbackTimeToUpstreamMinutes,
                    queueLengthMeters: shockwave.queueLengthMeters,
                    advisoryMessage: shockwave.advisoryMessage,
                  }
                : undefined,
              timestamp: Date.now(),
            };

            // Room scoped broadcast: segment:<segmentId>
            io.to(`segment:${segmentId}`).emit(SOCKET_EVENTS.TRAFFIC_SEGMENT_UPDATE, updatePayload);
            io.emit(SOCKET_EVENTS.TRAFFIC_SEGMENT_UPDATE, updatePayload);

            // If confirmed congestion, broadcast alert with spillback warnings
            if (edge.congestionLevel === 'congested' || edge.congestionLevel === 'severe_gridlock') {
              const alertPayload = {
                segmentId: edge.segmentId,
                name: edge.name,
                congestionLevel: edge.congestionLevel,
                speedKmh: edge.effectiveSpeedKmh,
                delayMinutes: edge.delayMinutes,
                shockwaveDirection: shockwave?.direction,
                shockwaveVelocityKmh: shockwave?.shockwaveVelocityKmh,
                spillbackTimeToUpstreamMinutes: shockwave?.spillbackTimeToUpstreamMinutes,
                advisory: shockwave?.advisoryMessage,
              };

              io.to(`segment:${segmentId}`).emit(SOCKET_EVENTS.TRAFFIC_CONGESTION_ALERT, alertPayload);
              io.emit(SOCKET_EVENTS.TRAFFIC_CONGESTION_ALERT, alertPayload);
            }
          }
        }
      } catch (err: any) {
        logger.error(`Error in traffic:telemetry_stream for socket ${socket.id}: ${err.message}`);
      }
    }
  );

  /**
   * 2. Live Turn-by-Turn Dynamic ETA calculation stream:
   * Client transmits current location and destination; server re-evaluates weighted graph ETA in minutes.
   */
  socket.on(
    SOCKET_EVENTS.TRAFFIC_ETA_UPDATE,
    async (data: {
      origin: Coordinate;
      destination: Coordinate;
      departureTime?: string;
    }) => {
      try {
        if (!data.origin || !data.destination) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'origin and destination [lon, lat] coordinates required for ETA update',
          });
          return;
        }

        const departureDate = data.departureTime ? new Date(data.departureTime) : new Date();
        const etaResult = await trafficEtaService.calculateRealtimeEta(
          data.origin,
          data.destination,
          departureDate
        );

        socket.emit(SOCKET_EVENTS.TRAFFIC_ETA_UPDATE, etaResult);
      } catch (err: any) {
        logger.warn(`Error computing socket traffic ETA: ${err.message}`);
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
      }
    }
  );

  /**
   * 3. Subscribe to real-time road segment room (segment:<segmentId>)
   * for live BPR travel-time speeds and LWR shockwave spillback warnings.
   */
  socket.on('traffic:subscribe_segment', (data: { segmentId: string }) => {
    if (data?.segmentId) {
      const room = `segment:${data.segmentId}`;
      socket.join(room);
      logger.debug(`Socket ${socket.id} subscribed to ${room}`);
    }
  });

  socket.on('traffic:unsubscribe_segment', (data: { segmentId: string }) => {
    if (data?.segmentId) {
      const room = `segment:${data.segmentId}`;
      socket.leave(room);
      logger.debug(`Socket ${socket.id} unsubscribed from ${room}`);
    }
  });
};
