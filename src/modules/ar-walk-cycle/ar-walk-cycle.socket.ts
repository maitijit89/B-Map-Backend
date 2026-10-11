import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { arWalkCycleService } from './ar-walk-cycle.service';

export const registerARWalkCycleHandlers = (io: Server, socket: Socket) => {
  // Streams real-time camera pose & returns projected AR HUD frame
  socket.on(SOCKET_EVENTS.AR_POSE_STREAM, (data: any) => {
    try {
      if (!data || !data.cameraPose || !data.waypoints) return;

      const frame = arWalkCycleService.computeARHUDFrame({
        cameraPose: data.cameraPose,
        waypoints: data.waypoints,
        currentStepInstruction: data.currentStepInstruction,
        distanceToNextTurnMeters: data.distanceToNextTurnMeters,
      });

      socket.emit(SOCKET_EVENTS.AR_HUD_PROJECTION_BROADCAST, frame);
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `AR stream error: ${err.message}` });
    }
  });
};
