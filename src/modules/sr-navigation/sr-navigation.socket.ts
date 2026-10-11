import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { srNavigationService } from './sr-navigation.service';

export const registerSRNavigationHandlers = (io: Server, socket: Socket) => {
  socket.on(SOCKET_EVENTS.SR_TELEMETRY_STREAM, async (data: any) => {
    try {
      if (!data || !data.coordinates) return;

      const hudState = await srNavigationService.computeSRHUDState({
        coordinates: data.coordinates,
        speedKmh: data.speedKmh,
        speedLimitKmh: data.speedLimitKmh,
        lateralOffsetMeters: data.lateralOffsetMeters,
        currentLaneIndex: data.currentLaneIndex,
        nextTurnDirection: data.nextTurnDirection,
        distanceToTurnMeters: data.distanceToTurnMeters,
        blinkerState: data.blinkerState,
        surroundingObjects: data.surroundingObjects,
      });

      // Emit live SR state back to the device
      socket.emit(SOCKET_EVENTS.SR_HUD_BROADCAST, hudState);

      // Issue lane departure warning if vehicle drifts without turn signal
      if (hudState.lateralOffset.departureWarning) {
        socket.emit(SOCKET_EVENTS.SR_LANE_DRIFT_ALERT, {
          direction: hudState.lateralOffset.departureDirection,
          lateralOffsetMeters: hudState.lateralOffset.lateralOffsetFromCenterMeters,
          message: `Lane departure alert: drifting towards ${hudState.lateralOffset.departureDirection} lane boundary!`,
          timestamp: Date.now(),
        });
      }

      // Issue forward collision alert if TTC is under critical threshold
      if (hudState.forwardCollisionWarning) {
        socket.emit(SOCKET_EVENTS.SR_COLLISION_WARNING, {
          level: 'critical',
          message: 'Forward Collision Warning: Rapid approach to preceding vehicle!',
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `SR Navigation Stream Error: ${err.message}` });
    }
  });
};
