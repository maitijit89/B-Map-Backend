import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { carNavigationService } from './car-navigation.service';

export const registerCarNavigationHandlers = (io: Server, socket: Socket) => {
  // Streams nearby camera & radar alerts as car moves
  socket.on(SOCKET_EVENTS.CAR_CAMERA_ALERT_STREAM, async (data: any) => {
    try {
      if (!data || !data.coordinates) return;
      const cameras = await carNavigationService.getNearbySpeedCameras(data.coordinates, data.radiusMeters || 3000);
      socket.emit(SOCKET_EVENTS.CAR_CAMERA_ALERT_STREAM, {
        cameras,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `Car camera stream error: ${err.message}` });
    }
  });
};
