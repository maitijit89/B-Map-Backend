import { Server, Socket } from 'socket.io';
import { logger } from '../../core/config/logger';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { unifiedUnderlyingEngineService } from './unified-underlying-engine.service';
import { UnifiedTelemetryTick } from './unified-engine.types';

export const registerUnifiedEngineHandlers = (io: Server, socket: Socket): void => {
  /**
   * Continuous high-frequency tick for the Unified Underlying Engine
   */
  socket.on(SOCKET_EVENTS.UNIFIED_TELEMETRY_TICK, async (tick: UnifiedTelemetryTick) => {
    try {
      if (!tick || !tick.sensorPacket || !tick.sensorPacket.deviceId) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Valid unified tick with sensorPacket and deviceId required',
        });
        return;
      }

      // Process complete underlying pipeline (Positioning + Route + Lane + Recommendations)
      const unifiedState = await unifiedUnderlyingEngineService.processUnifiedTick(tick);

      // 1. Emit complete state back to client
      socket.emit(SOCKET_EVENTS.UNIFIED_STATE_BROADCAST, unifiedState);

      // Broadcast to vehicle room
      io.to(`session:${unifiedState.sessionId}`).emit(
        SOCKET_EVENTS.UNIFIED_STATE_BROADCAST,
        unifiedState
      );

      // 2. Check for active dynamic recommendations to display as HUD popups
      if (unifiedState.activeRecommendations.length > 0) {
        for (const rec of unifiedState.activeRecommendations) {
          socket.emit(SOCKET_EVENTS.DYNAMIC_RECOMMENDATION_POPUP, rec);
        }
      }
    } catch (err: any) {
      logger.error(`Error processing unified tick for ${socket.id}: ${err.message}`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });
};
