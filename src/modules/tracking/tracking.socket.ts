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

      // Broadcast to any clients actively tracking this entity
      io.to(`track:${data.userId}`).emit(SOCKET_EVENTS.LOCATION_BROADCAST, {
        userId: data.userId,
        role: data.role || 'driver',
        coordinates: [data.longitude, data.latitude],
        heading: data.heading ?? 0,
        speed: data.speed ?? 0,
        accuracy: data.accuracy ?? 0,
        timestamp: data.timestamp || Date.now(),
      });
    } catch (err: any) {
      logger.error(`Error in location:update socket event: ${err.message}`);
    }
  });

  /**
   * Subscribe to a specific entity's live track (e.g. Rider watching assigned Driver).
   */
  socket.on(SOCKET_EVENTS.LOCATION_SUBSCRIBE, (data: { targetUserId: string }) => {
    if (data?.targetUserId) {
      const room = `track:${data.targetUserId}`;
      socket.join(room);
      logger.debug(`Socket ${socket.id} subscribed to ${room}`);
    }
  });

  /**
   * Unsubscribe from entity's live track.
   */
  socket.on(SOCKET_EVENTS.LOCATION_UNSUBSCRIBE, (data: { targetUserId: string }) => {
    if (data?.targetUserId) {
      const room = `track:${data.targetUserId}`;
      socket.leave(room);
      logger.debug(`Socket ${socket.id} unsubscribed from ${room}`);
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
