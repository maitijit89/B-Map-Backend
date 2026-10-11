import { Server, Socket } from 'socket.io';
import { logger } from '../../core/config/logger';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { positioningEngineService } from './positioning-engine.service';
import { RawSensorPacket } from './positioning.types';

export const registerPositioningHandlers = (io: Server, socket: Socket): void => {
  /**
   * Continuous high-frequency telemetry ingestion:
   * Client streams IMU + GNSS + Beacons -> Server outputs fused state in real-time
   */
  socket.on(SOCKET_EVENTS.POSITIONING_STREAM_TELEMETRY, async (packet: RawSensorPacket) => {
    try {
      if (!packet || !packet.deviceId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Valid packet with deviceId required' });
        return;
      }

      // Process via unified fusion engine
      const fusedState = await positioningEngineService.processSensorPacket(packet);

      // Emit back to sender
      socket.emit(SOCKET_EVENTS.POSITIONING_FUSED_BROADCAST, fusedState);

      // Also broadcast to any subscribed fleet or HUD viewers
      io.to(`device:${packet.deviceId}`).emit(SOCKET_EVENTS.POSITIONING_FUSED_BROADCAST, fusedState);
    } catch (err: any) {
      logger.error(`Error processing telemetry stream for socket ${socket.id}: ${err.message}`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });

  /**
   * Subscribe to a device's high-precision fused state stream
   */
  socket.on(SOCKET_EVENTS.POSITIONING_SUBSCRIBE, (data: { targetDeviceId: string }) => {
    if (data?.targetDeviceId) {
      const room = `device:${data.targetDeviceId}`;
      socket.join(room);
      logger.debug(`Socket ${socket.id} subscribed to ${room}`);
    }
  });
};
