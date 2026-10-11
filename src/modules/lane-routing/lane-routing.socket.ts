import { Server, Socket } from 'socket.io';
import { logger } from '../../core/config/logger';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { laneRoutingService } from './lane-routing.service';
import { veteranDriverLayerService } from './veteran-driver-layer.service';
import { Coordinate } from '../../core/types/geo.types';
import { LaneTurnDirection } from './lane-routing.types';

export const registerLaneRoutingHandlers = (io: Server, socket: Socket): void => {
  /**
   * Continuous Lane-Level Guidance stream for vehicle HUD / Cockpit
   */
  socket.on(
    SOCKET_EVENTS.LANE_GUIDANCE_STREAM,
    async (data: {
      roadName?: string;
      currentCoordinates?: Coordinate;
      currentLaneIndex?: number;
      distanceToNextTurnMeters: number;
      nextManeuverDirection: LaneTurnDirection;
      currentSpeedMps?: number;
    }) => {
      try {
        if (data.distanceToNextTurnMeters === undefined || !data.nextManeuverDirection) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'distanceToNextTurnMeters and nextManeuverDirection required for lane guidance',
          });
          return;
        }

        // 1. Calculate HD Lane Guidance
        const guidance = await laneRoutingService.computeLaneGuidance(data);

        // Emit back to sender
        socket.emit(SOCKET_EVENTS.LANE_GUIDANCE_BROADCAST, guidance);

        // 2. Check for nearby Veteran Hazards if coordinates provided
        if (data.currentCoordinates) {
          const hazards = veteranDriverLayerService.findHazardsAlongRoute(
            [data.currentCoordinates],
            100 // 100 meters ahead
          );

          if (hazards.length > 0) {
            socket.emit(SOCKET_EVENTS.VETERAN_HAZARD_ALERT, {
              count: hazards.length,
              hazards,
              timestamp: Date.now(),
            });
          }
        }
      } catch (err: any) {
        logger.error(`Error in lane:guidance_stream for ${socket.id}: ${err.message}`);
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
      }
    }
  );
};
