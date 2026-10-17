import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { aiCopilotService } from './ai-copilot.service';
import { aiCopilotSocketBridge } from './ai-copilot-socket-bridge.service';
import { logger } from '../../core/config/logger';

export const registerAICopilotHandlers = (io: Server, socket: Socket) => {
  // Mobile app streams speech prompt + live vehicle GPS
  socket.on(SOCKET_EVENTS.COPILOT_MESSAGE_STREAM, async (data: any) => {
    try {
      if (!data?.prompt) return;

      const conversationId = data.conversationId || `conv_${socket.id}`;
      const userId = (socket as any).userId || data.userId || socket.id;

      // 1. Try real-time WebSocket Gateway stream to b_map_ai
      const streamedOverSocket = aiCopilotSocketBridge.streamToGateway(
        {
          sessionId: conversationId,
          driverId: userId,
          prompt: data.prompt,
          telemetry: data.vehicleContext?.currentCoordinates
            ? {
                coordinates: data.vehicleContext.currentCoordinates,
                speedKmH: data.vehicleContext.speedKmh || 50,
                headingDeg: data.vehicleContext.headingDeg || 0,
                remainingDistanceMeters: data.vehicleContext.remainingDistanceMeters || 5000,
                etaMinutes: data.vehicleContext.etaMinutes || 10,
                batteryOrFuelSoC: data.vehicleContext.fuelLevelPercent || 80,
                activeRouteId: data.vehicleContext.activeRouteId || 'active_route',
                destinationMetadata: {
                  name: data.vehicleContext.destinationName || 'Destination',
                  coordinates: data.vehicleContext.destinationCoordinates || [13.404954, 52.520008],
                },
              }
            : undefined,
        },
        // Real-time processing status callback
        (statusData) => {
          socket.emit(SOCKET_EVENTS.COPILOT_PROCESSING_STATUS, statusData);
        },
        // Response callback
        (response) => {
          socket.emit(SOCKET_EVENTS.COPILOT_MESSAGE_RESPONSE, response);
        },
        // Error callback (triggers fallback)
        async (bridgeErr) => {
          logger.debug(`[AICopilotSocket] WebSocket bridge reported error, falling back to HTTP: ${bridgeErr?.message}`);
          try {
            const fallbackResponse = await aiCopilotService.processUserPrompt({
              conversationId,
              userId,
              prompt: data.prompt,
              vehicleContext: data.vehicleContext,
            });
            socket.emit(SOCKET_EVENTS.COPILOT_MESSAGE_RESPONSE, fallbackResponse);
          } catch (err: any) {
            socket.emit(SOCKET_EVENTS.COPILOT_ERROR, {
              message: `AI Copilot stream error: ${err.message}`,
            });
          }
        }
      );

      // 2. If WebSocket gateway bridge was not active, execute standard service pipeline (HTTP / local fallback)
      if (!streamedOverSocket) {
        socket.emit(SOCKET_EVENTS.COPILOT_PROCESSING_STATUS, {
          status: 'processing_via_http_gateway',
          timestamp: new Date().toISOString(),
        });

        const aiResponse = await aiCopilotService.processUserPrompt({
          conversationId,
          userId,
          prompt: data.prompt,
          vehicleContext: data.vehicleContext,
        });

        socket.emit(SOCKET_EVENTS.COPILOT_MESSAGE_RESPONSE, aiResponse);
      }
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.COPILOT_ERROR, {
        message: `AI Copilot stream error: ${err.message}`,
      });
    }
  });
};

