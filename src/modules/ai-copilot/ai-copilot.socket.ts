import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { aiCopilotService } from './ai-copilot.service';

export const registerAICopilotHandlers = (io: Server, socket: Socket) => {
  // Streams interactive conversational in-drive AI prompts
  socket.on(SOCKET_EVENTS.COPILOT_MESSAGE_STREAM, async (data: any) => {
    try {
      if (!data || !data.prompt) return;

      const response = await aiCopilotService.processUserPrompt({
        conversationId: data.conversationId,
        userId: data.userId,
        prompt: data.prompt,
        vehicleContext: data.vehicleContext,
      });

      socket.emit(SOCKET_EVENTS.COPILOT_MESSAGE_RESPONSE, response);
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `AI Copilot stream error: ${err.message}` });
    }
  });
};
