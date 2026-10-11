import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { parkingSpaceNavigationService } from './parking-space-navigation.service';

export const registerParkingNavigationHandlers = (io: Server, socket: Socket) => {
  // Proximity entrance detection stream
  socket.on(SOCKET_EVENTS.PARKING_ENTRANCE_DETECT, (data: any) => {
    try {
      if (!data || !data.coordinates) return;
      const result = parkingSpaceNavigationService.detectFacilityEntrance(data.coordinates);
      socket.emit(SOCKET_EVENTS.PARKING_ENTRANCE_DETECT, result);
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `Parking entrance stream error: ${err.message}` });
    }
  });

  // Indoor Turn-by-Turn bay guidance stream
  socket.on(SOCKET_EVENTS.PARKING_INDOOR_GUIDANCE, async (data: any) => {
    try {
      if (!data || !data.facilityId || !data.targetBayId) return;

      const plan = await parkingSpaceNavigationService.planIndoorBayNavigation({
        facilityId: data.facilityId,
        entranceGateId: data.entranceGateId,
        targetBayId: data.targetBayId,
      });

      socket.emit(SOCKET_EVENTS.PARKING_INDOOR_GUIDANCE, plan);
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `Indoor bay guidance error: ${err.message}` });
    }
  });
};
