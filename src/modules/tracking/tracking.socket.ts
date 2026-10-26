import { Server, Socket } from 'socket.io';
import { env } from '../../core/config/env.config';
import { logger } from '../../core/config/logger';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { geoTrackingService } from './geo-tracking.service';
import { LocationPayload, NearbyQueryOptions } from '../../core/types/geo.types';
import { isValidCoordinate } from '../../core/utils/geo.utils';

export const registerTrackingHandlers = (io: Server, socket: Socket): void => {
  /**
   * Continuous Location Ingestion:
   * Drivers/Couriers/Users stream real-time GPS fixes here.
   */
  socket.on(SOCKET_EVENTS.LOCATION_UPDATE, async (data: LocationPayload) => {
    try {
      if (!data || !data.userId || !isValidCoordinate([data.longitude, data.latitude])) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Invalid location payload. [longitude, latitude] required.',
        });
        return;
      }

      // Update Redis Geospatial index & hash
      await geoTrackingService.updateLocation(data);

      // Broadcast to any clients actively tracking this entity (Room driver:<driverId> & track:<userId>)
      const broadcastPayload = {
        userId: data.userId,
        driverId: data.userId,
        role: data.role || 'driver',
        coordinates: [data.longitude, data.latitude],
        heading: data.heading ?? 0,
        speed: data.speed ?? 0,
        accuracy: data.accuracy ?? 0,
        timestamp: data.timestamp || Date.now(),
      };
      io.to(`track:${data.userId}`).emit(SOCKET_EVENTS.LOCATION_BROADCAST, broadcastPayload);
      io.to(`driver:${data.userId}`).emit(SOCKET_EVENTS.LOCATION_BROADCAST, broadcastPayload);
    } catch (err: any) {
      logger.error(`Error in location:update socket event: ${err.message}`);
    }
  });

  /**
   * High-Frequency 1Hz–5Hz Breadcrumb Stream:
   * Connected vehicles, mobile apps, and telematics units stream real-time fixes at 1Hz–5Hz.
   * Performs coordinate validation, updates Redis spatial index, and broadcasts interpolated breadcrumbs.
   */
  socket.on(SOCKET_EVENTS.TRACKING_BREADCRUMB_STREAM, async (packet: {
    userId: string;
    sequenceId: number;
    coordinates: [number, number]; // [lon, lat]
    headingDeg?: number;
    speedKmh?: number;
    accuracyMeters?: number;
    timestamp?: number;
    samplingFrequencyHz?: number; // 1 to 5 Hz
    altitudeMeters?: number;
  }) => {
    try {
      if (!packet || !packet.userId || !isValidCoordinate(packet.coordinates)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Invalid breadcrumb packet. Required: userId, coordinates [lon, lat]',
        });
        return;
      }

      const now = packet.timestamp || Date.now();
      const speed = packet.speedKmh ?? 0;
      const heading = packet.headingDeg ?? 0;
      const accuracy = packet.accuracyMeters ?? 5.0;

      // Update Redis geospatial storage
      await geoTrackingService.updateLocation({
        userId: packet.userId,
        longitude: packet.coordinates[0],
        latitude: packet.coordinates[1],
        heading,
        speed,
        accuracy,
        timestamp: now,
      });

      // Broadcast high-frequency breadcrumb to all subscribers of this entity (driver:<driverId> & track:<userId>)
      const breadcrumbPayload = {
        userId: packet.userId,
        driverId: packet.userId,
        sequenceId: packet.sequenceId,
        coordinates: packet.coordinates,
        headingDeg: heading,
        speedKmh: speed,
        accuracyMeters: accuracy,
        samplingFrequencyHz: packet.samplingFrequencyHz || 1,
        timestamp: now,
        serverDispatchedAt: Date.now(),
      };
      io.to(`track:${packet.userId}`).emit(SOCKET_EVENTS.TRACKING_BREADCRUMB_BROADCAST, breadcrumbPayload);
      io.to(`driver:${packet.userId}`).emit(SOCKET_EVENTS.TRACKING_BREADCRUMB_BROADCAST, breadcrumbPayload);
    } catch (err: any) {
      logger.error(`Error in tracking:breadcrumb_stream socket event: ${err.message}`);
    }
  });

  /**
   * Subscribe to a specific entity's live track (e.g. Rider watching assigned Driver).
   * Supports room driver:<driverId> and track:<userId>.
   */
  socket.on(SOCKET_EVENTS.LOCATION_SUBSCRIBE, (data: { targetUserId?: string; driverId?: string }) => {
    const id = data?.driverId || data?.targetUserId;
    if (id) {
      socket.join(`track:${id}`);
      socket.join(`driver:${id}`);
      logger.debug(`Socket ${socket.id} subscribed to driver:${id} and track:${id}`);
    }
  });

  /**
   * Unsubscribe from entity's live track.
   */
  socket.on(SOCKET_EVENTS.LOCATION_UNSUBSCRIBE, (data: { targetUserId?: string; driverId?: string }) => {
    const id = data?.driverId || data?.targetUserId;
    if (id) {
      socket.leave(`track:${id}`);
      socket.leave(`driver:${id}`);
      logger.debug(`Socket ${socket.id} unsubscribed from driver:${id} and track:${id}`);
    }
  });

  /**
   * Real-time Nearby Query:
   * Finds drivers within radius over WebSocket.
   */
  socket.on(SOCKET_EVENTS.NEARBY_DRIVERS_REQUEST, async (query: NearbyQueryOptions) => {
    try {
      if (!isValidCoordinate([query.longitude, query.latitude])) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid search coordinates' });
        return;
      }

      const nearby = await geoTrackingService.findNearbyEntities({
        longitude: query.longitude,
        latitude: query.latitude,
        radiusInMeters: query.radiusInMeters || 5000,
        role: query.role || 'driver',
        limit: query.limit || 30,
      });

      socket.emit(SOCKET_EVENTS.NEARBY_DRIVERS_RESPONSE, {
        query,
        count: nearby.length,
        results: nearby,
      });
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });
};
