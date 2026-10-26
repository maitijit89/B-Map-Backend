import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { parkingSpaceNavigationService } from './parking-space-navigation.service';
import { logger } from '../../core/config/logger';

export const registerParkingNavigationHandlers = (io: Server, socket: Socket) => {
  // Proximity entrance detection stream (BLE beacon gate handoff)
  socket.on(SOCKET_EVENTS.PARKING_ENTRANCE_DETECT, (data: any) => {
    try {
      if (!data || !data.coordinates) return;
      const result = parkingSpaceNavigationService.detectFacilityEntrance(data.coordinates);

      // Emit back to vehicle / driver
      socket.emit(SOCKET_EVENTS.PARKING_ENTRANCE_DETECT, result);

      // If near a facility gate, optionally join facility room for live guidance
      if (result && result.facility) {
        const facilityId = result.facility.facilityId;
        socket.join(`parking:${facilityId}`);
        logger.debug(`Socket ${socket.id} joined parking room parking:${facilityId}`);
      }
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

  // Real-time Indoor Bay Status & Live Slot Occupancy (parking:bay_status)
  socket.on(SOCKET_EVENTS.PARKING_BAY_STATUS, async (data: any) => {
    try {
      if (!data || !data.facilityId) return;

      const room = `parking:${data.facilityId}`;

      // If updating a bay's occupancy status
      if (data.bayId && data.status) {
        const updated = await parkingSpaceNavigationService.updateBaySensorStatus(
          data.bayId,
          data.status,
          data.vehicleLicensePlate
        );

        const payload = {
          facilityId: data.facilityId,
          bayId: data.bayId,
          status: data.status,
          updatedAt: Date.now(),
          bay: updated,
        };

        // Broadcast to facility room and emit back to sender
        io.to(room).emit(SOCKET_EVENTS.PARKING_BAY_STATUS, payload);
        io.to(room).emit(SOCKET_EVENTS.PARKING_BAY_STATUS_BROADCAST, payload);
        socket.emit(SOCKET_EVENTS.PARKING_BAY_STATUS, payload);
      } else {
        // Querying facility live occupancy status
        const facility = parkingSpaceNavigationService.getFacility(data.facilityId);
        const bays = parkingSpaceNavigationService.getBaysForFacility(data.facilityId);

        socket.emit(SOCKET_EVENTS.PARKING_BAY_STATUS, {
          facilityId: data.facilityId,
          facilityName: facility?.name,
          totalSpaces: facility?.floors.reduce((sum: number, f: any) => sum + f.totalSpaces, 0) || 0,
          availableSpaces: facility?.floors.reduce((sum: number, f: any) => sum + f.availableSpaces, 0) || 0,
          baysCount: bays.length,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: `Parking bay status error: ${err.message}` });
    }
  });

  // Subscribe to a specific parking facility room
  socket.on('parking:subscribe', (data: { facilityId: string }) => {
    if (data?.facilityId) {
      const room = `parking:${data.facilityId}`;
      socket.join(room);
      logger.debug(`Socket ${socket.id} subscribed to ${room}`);
    }
  });
};
