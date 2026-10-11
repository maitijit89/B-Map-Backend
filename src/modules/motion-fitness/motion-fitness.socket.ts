import { Server, Socket } from 'socket.io';
import { logger } from '../../core/config/logger';
import { activityRecognitionService } from './activity-recognition.service';
import { MotionActivityPayload } from './motion-fitness.types';

export const registerMotionFitnessSocketHandlers = (io: Server, socket: Socket): void => {
  /**
   * Continuous Activity Recognition stream (STILL, WALKING, DRIVING)
   */
  socket.on('motion:activity_stream', async (payload: MotionActivityPayload) => {
    try {
      if (!payload || !payload.tripId || !payload.activity) {
        socket.emit('motion:error', { message: 'tripId and activity are required' });
        return;
      }

      const result = await activityRecognitionService.processActivityUpdate(payload);

      // Return processed result to the transmitting client
      socket.emit('motion:activity_ack', result);

      // If an algorithmic action was triggered, broadcast automated ping notification
      if (result.actionTriggered !== 'NONE' && result.automatedPing) {
        socket.emit('motion:automated_ping', {
          tripId: payload.tripId,
          actionTriggered: result.actionTriggered,
          notification: result.automatedPing,
          contextAwareRouting: result.contextAwareRouting,
        });

        // Broadcast to trip room
        io.to(`trip:${payload.tripId}`).emit('trip:state_transition', {
          tripId: payload.tripId,
          status: result.tripStatus,
          actionTriggered: result.actionTriggered,
          automatedPing: result.automatedPing,
        });
      }
    } catch (err: any) {
      logger.error(`Error in motion:activity_stream socket handler: ${err.message}`);
      socket.emit('motion:error', { message: err.message });
    }
  });

  /**
   * Client manually resumes an auto-paused trip
   */
  socket.on('motion:resume_trip', async (data: { tripId: string }) => {
    try {
      if (data?.tripId) {
        await activityRecognitionService.resumeTrip(data.tripId);
        socket.emit('motion:resumed', { tripId: data.tripId, status: 'active' });
        io.to(`trip:${data.tripId}`).emit('trip:resumed', { tripId: data.tripId, status: 'active' });
      }
    } catch (err: any) {
      logger.warn(`Error in motion:resume_trip: ${err.message}`);
    }
  });
};
