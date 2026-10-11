import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { publicTransitService } from './public-transit.service';

export const registerPublicTransitHandlers = (io: Server, socket: Socket) => {
  // Streams live departure board updates for a station
  socket.on(SOCKET_EVENTS.TRANSIT_LIVE_BOARD_STREAM, async (data: any) => {
    try {
      if (!data || !data.stationId) return;
      const board = await publicTransitService.getStationDepartures(data.stationId);
      socket.emit(SOCKET_EVENTS.TRANSIT_LIVE_BOARD_STREAM, board);
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `Transit board stream error: ${err.message}` });
    }
  });
};
