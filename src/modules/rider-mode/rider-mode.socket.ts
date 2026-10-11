import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { riderModeService } from './rider-mode.service';

export const registerRiderModeHandlers = (io: Server, socket: Socket) => {
  // Real-time motorcycle roll / lean dynamics stream
  socket.on(SOCKET_EVENTS.RIDER_DYNAMICS_STREAM, (data: any) => {
    try {
      if (!data || !data.sessionId || !data.telemetry) return;

      const leanStats = riderModeService.processDynamics(
        data.sessionId,
        data.telemetry,
        data.weather
      );

      socket.emit(SOCKET_EVENTS.RIDER_LEAN_BROADCAST, leanStats);

      // Check for crash detection trigger
      if (data.location && data.stationarySeconds !== undefined) {
        const crash = riderModeService.evaluateCrashTrigger({
          telemetry: data.telemetry,
          stationarySeconds: data.stationarySeconds,
          location: data.location,
          medicalProfile: data.medicalProfile,
        });

        if (crash) {
          socket.emit(SOCKET_EVENTS.RIDER_CRASH_ALERT, crash);
        }
      }
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `Rider dynamics error: ${err.message}` });
    }
  });

  // Rider manually cancels crash countdown
  socket.on(SOCKET_EVENTS.RIDER_CRASH_CANCEL, (data: any) => {
    try {
      if (!data || !data.eventId) return;
      const cancelled = riderModeService.cancelCrashAlert(data.eventId);
      socket.emit(SOCKET_EVENTS.RIDER_CRASH_CANCEL, { eventId: data.eventId, cancelled });
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `Crash cancel error: ${err.message}` });
    }
  });
};
