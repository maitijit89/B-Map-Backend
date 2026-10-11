import { Server, Socket } from 'socket.io';
import { logger } from '../../core/config/logger';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { navigationService } from './navigation.service';
import { NavigationProgressUpdate } from './navigation.types';
import { isValidCoordinate } from '../../core/utils/geo.utils';

export const registerNavigationHandlers = (io: Server, socket: Socket): void => {
  /**
   * Join a Turn-by-Turn navigation session room.
   */
  socket.on(SOCKET_EVENTS.NAV_JOIN, async (data: { sessionId: string }) => {
    try {
      if (!data?.sessionId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'sessionId is required to join navigation' });
        return;
      }

      const session = await navigationService.getSession(data.sessionId);
      if (!session) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: `Session ${data.sessionId} not found` });
        return;
      }

      const room = `nav:${data.sessionId}`;
      socket.join(room);
      logger.info(`Socket ${socket.id} joined navigation session: ${room}`);

      // Emit initial state back to client
      socket.emit(SOCKET_EVENTS.NAV_PROGRESS_STATE, {
        sessionId: session.sessionId,
        status: session.status,
        currentStepIndex: session.currentStepIndex,
        remainingDistanceMeters: session.remainingDistanceMeters,
        remainingDurationSeconds: session.remainingDurationSeconds,
        distanceToNextStepMeters: session.distanceToNextStepMeters,
        nextStep: session.nextStep,
        currentRoute: session.currentRoute,
      });
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });

  /**
   * Leave a navigation session room.
   */
  socket.on(SOCKET_EVENTS.NAV_LEAVE, (data: { sessionId: string }) => {
    if (data?.sessionId) {
      const room = `nav:${data.sessionId}`;
      socket.leave(room);
      logger.info(`Socket ${socket.id} left navigation session: ${room}`);
    }
  });

  /**
   * Continuous progress stream from the client device during active navigation.
   * Performs off-route checks, maneuver progression, and automatic dynamic reroutes.
   */
  socket.on(SOCKET_EVENTS.NAV_UPDATE_PROGRESS, async (update: NavigationProgressUpdate) => {
    try {
      if (!update?.sessionId || !isValidCoordinate(update.currentLocation)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Invalid progress update. Required: sessionId, currentLocation [lon, lat]',
        });
        return;
      }

      const result = await navigationService.processProgressUpdate(update);
      const room = `nav:${update.sessionId}`;

      // 1. If off-route detected, alert the client
      if (result.isOffRoute) {
        io.to(room).emit(SOCKET_EVENTS.NAV_OFF_ROUTE_ALERT, {
          sessionId: update.sessionId,
          distanceFromRouteMeters: result.distanceFromRouteMeters,
          timestamp: Date.now(),
        });
      }

      // 2. If a dynamic reroute was computed via OSRM, push new route to client
      if (result.rerouted && result.updatedRoute) {
        logger.info(`📡 Broadcasting updated route for session ${update.sessionId}`);
        io.to(room).emit(SOCKET_EVENTS.NAV_REROUTE_SUCCESS, {
          sessionId: update.sessionId,
          newRoute: result.updatedRoute,
          distanceFromRouteMeters: result.distanceFromRouteMeters,
          timestamp: Date.now(),
        });
      }

      // 3. Destination reached
      if (result.status === 'completed') {
        io.to(room).emit(SOCKET_EVENTS.NAV_DESTINATION_REACHED, {
          sessionId: update.sessionId,
          message: 'You have arrived at your destination!',
          completedAt: new Date(),
        });
      }

      // 4. Broadcast updated navigation HUD state
      io.to(room).emit(SOCKET_EVENTS.NAV_PROGRESS_STATE, result);
    } catch (err: any) {
      logger.error(`Error in nav:update_progress socket event: ${err.message}`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });
};
