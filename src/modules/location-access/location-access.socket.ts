import { Server, Socket } from 'socket.io';
import { logger } from '../../core/config/logger';
import { locationIngestionService } from './location-ingestion.service';
import { ClientLifecycleChangePayload, LocationTelemetryPayload } from './location-access.types';
import { permissionCacheService } from './permission-cache.service';

export const registerLocationAccessSocketHandlers = (io: Server, socket: Socket): void => {
  /**
   * Real-Time Stream Ingestion with Trip Validation & Dynamic Rate Regulation
   */
  socket.on('location:lifecycle_ingest', async (payload: LocationTelemetryPayload) => {
    try {
      if (!payload || !payload.tripId || !payload.userId || !payload.coordinates) {
        socket.emit('location:rejection', {
          accepted: false,
          errorCode: 'INVALID_PAYLOAD',
          message: 'tripId, userId, and coordinates [longitude, latitude] are required.',
        });
        return;
      }

      const result = await locationIngestionService.ingestLocation(payload);

      if (!result.accepted) {
        // Discarded due to privacy protection (no active trip, revoked background permission, or missing crypto token)
        socket.emit('location:rejection', {
          accepted: false,
          tripId: payload.tripId,
          errorCode: result.errorCode,
          message: result.rejectionReason,
        });
        return;
      }

      // Return dynamic ingestion acknowledgment with optimal interval directive
      socket.emit('location:lifecycle_ack', result);

      // If client is in foreground, broadcast live track to subscribers
      if (result.appLifecycleMode === 'foreground') {
        io.to(`trip:${payload.tripId}`).emit('trip:live_coordinate', {
          tripId: payload.tripId,
          userId: payload.userId,
          coordinates: payload.coordinates,
          heading: payload.heading,
          speed: payload.speed,
          timestamp: result.timestamp,
        });
      }
    } catch (err: any) {
      logger.error(`Error in location:lifecycle_ingest socket handler: ${err.message}`);
      socket.emit('location:error', { message: err.message });
    }
  });

  /**
   * Mobile app notifies server when transitioning between foreground and background
   */
  socket.on('client:lifecycle_change', async (payload: ClientLifecycleChangePayload) => {
    try {
      if (!payload?.tripId || !payload?.appLifecycleMode) return;

      const policy = await locationIngestionService.handleLifecycleChange(payload);
      socket.emit('ingestion:rate_directive', {
        tripId: payload.tripId,
        appLifecycleMode: payload.appLifecycleMode,
        policy,
      });
    } catch (err: any) {
      logger.warn(`Error handling client:lifecycle_change: ${err.message}`);
    }
  });

  /**
   * Mobile app notifies server that user has revoked background permission.
   * Backend immediately halts polling and ceases socket expectation.
   */
  socket.on('client:permission_revoke', async (data: { userId: string; tripId?: string }) => {
    try {
      if (!data?.userId) return;

      const rev = await permissionCacheService.revokeBackgroundAccess(data.userId, data.tripId);
      socket.emit('location:background_polling_halted', {
        userId: data.userId,
        pollingHalted: true,
        message: rev.message,
        state: rev.state,
      });

      logger.info(
        `📡 [SOCKET NOTIFICATION] Emitted background_polling_halted for user "${data.userId}".`
      );
    } catch (err: any) {
      logger.warn(`Error handling client:permission_revoke: ${err.message}`);
    }
  });
};
