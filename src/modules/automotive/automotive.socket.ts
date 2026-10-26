import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { automotiveEcosystemService } from './automotive-ecosystem.service';

export const registerAutomotiveHandlers = (io: Server, socket: Socket) => {
  // Ingest high-frequency CAN bus telemetry
  socket.on(SOCKET_EVENTS.AUTO_CAN_STREAM, (data: any) => {
    try {
      if (!data || !data.vehicleId || !data.packet) return;

      const ecoScore = automotiveEcosystemService.processCANTelemetry(data.vehicleId, data.packet);
      const payload = {
        vehicleId: data.vehicleId,
        ecoScore,
        timestamp: Date.now(),
      };
      socket.emit(SOCKET_EVENTS.AUTO_ECO_SCORE_BROADCAST, payload);
      io.to(`auto:${data.vehicleId}`).emit(SOCKET_EVENTS.AUTO_ECO_SCORE_BROADCAST, payload);
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `CAN stream error: ${err.message}` });
    }
  });

  // Subscribe secondary screens (CarPlay / Android Auto / HUD) to vehicle room
  socket.on('auto:subscribe', (data: { vehicleId: string }) => {
    if (data?.vehicleId) {
      socket.join(`auto:${data.vehicleId}`);
    }
  });

  // Hardware optical Heads-Up Display (HUD) stream
  socket.on(SOCKET_EVENTS.AUTO_HUD_FRAME_STREAM, (data: any) => {
    try {
      if (!data) return;

      const frame = automotiveEcosystemService.generateHUDFrame({
        maneuverCode: data.maneuverCode ?? 1,
        maneuverSymbol: data.maneuverSymbol ?? 'turn.left',
        distancePercent: data.distancePercent ?? 50,
        targetLaneBitmask: data.targetLaneBitmask ?? 1,
        vehicleSpeedKmh: data.vehicleSpeedKmh ?? 50,
        speedLimitKmh: data.speedLimitKmh ?? 50,
        adasWarningCode: data.adasWarningCode,
      });

      socket.emit(SOCKET_EVENTS.AUTO_HUD_FRAME_STREAM, frame);
      if (data.vehicleId) {
        io.to(`auto:${data.vehicleId}`).emit(SOCKET_EVENTS.AUTO_HUD_FRAME_STREAM, frame);
      }
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `HUD frame stream error: ${err.message}` });
    }
  });

  // Cockpit multi-screen state synchronization
  socket.on(SOCKET_EVENTS.AUTO_COCKPIT_SYNC, (data: any) => {
    try {
      if (!data || !data.vehicleId) return;
      // Broadcast to all screens paired with this vehicle (room auto:<vehicleId>)
      io.to(`auto:${data.vehicleId}`).emit(SOCKET_EVENTS.AUTO_COCKPIT_SYNC, data);
      socket.broadcast.emit(`${SOCKET_EVENTS.AUTO_COCKPIT_SYNC}:${data.vehicleId}`, data);
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `Cockpit sync error: ${err.message}` });
    }
  });
};
