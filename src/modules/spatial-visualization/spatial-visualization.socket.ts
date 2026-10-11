import { Server, Socket } from 'socket.io';
import { logger } from '../../core/config/logger';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { Coordinate } from '../../core/types/geo.types';
import { cinematicCameraService } from './cinematic-camera.service';
import { dynamicSpace4DService } from './dynamic-space-4d.service';
import { environmentalShadingService } from './environmental-shading.service';
import { indoorPrecisionViewService } from './indoor-precision-view.service';
import { spatioTemporalHeatmapService } from './spatio-temporal-heatmap.service';

export const registerSpatialVisualizationHandlers = (io: Server, socket: Socket): void => {
  /**
   * Subscribe to 3D spatial scene viewport room for live mesh and environmental sync.
   */
  socket.on(SOCKET_EVENTS.SPATIAL_3D_SCENE_SUBSCRIBE, (data: { sceneId: string; bounds?: [number, number, number, number] }) => {
    if (data?.sceneId) {
      const room = `spatial:scene:${data.sceneId}`;
      socket.join(room);
      logger.info(`Socket ${socket.id} subscribed to 3D spatial scene: ${room}`);

      // Emit initial weather radar sweep
      const center: Coordinate = [13.388, 52.517];
      const radar = environmentalShadingService.generateWeatherRadarOverlay(center, 8000, 'moderate');
      socket.emit(SOCKET_EVENTS.SPATIAL_WEATHER_RADAR_STREAM, radar);
    }
  });

  /**
   * Request live real-time traffic density heatmap updates for viewport.
   */
  socket.on(SOCKET_EVENTS.SPATIAL_HEATMAP_STREAM, (data: { center: Coordinate; radiusMeters?: number }) => {
    try {
      if (!data?.center || !Array.isArray(data.center)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid center coordinate for heatmap stream' });
        return;
      }

      // Synthesize dynamic live vehicle points
      const points = [
        { coordinate: [data.center[0] + 0.002, data.center[1] + 0.001] as Coordinate, speedKmH: 22 },
        { coordinate: [data.center[0] - 0.003, data.center[1] + 0.002] as Coordinate, speedKmH: 14 },
        { coordinate: [data.center[0] + 0.001, data.center[1] - 0.002] as Coordinate, speedKmH: 48 },
        { coordinate: [data.center[0], data.center[1]] as Coordinate, speedKmH: 18 },
      ];

      const frame = spatioTemporalHeatmapService.generateHexagonalHeatmap(
        data.center,
        data.radiusMeters || 1200,
        100,
        points
      );

      socket.emit(SOCKET_EVENTS.SPATIAL_HEATMAP_STREAM, frame);
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });

  /**
   * Continuous camera flight pose streaming for synchronized multi-device client screens or cockpit displays.
   */
  socket.on(SOCKET_EVENTS.SPATIAL_CAMERA_FLYBY_UPDATE, (data: { flightId: string; routeCoordinates: Coordinate[] }) => {
    try {
      if (!data?.routeCoordinates || data.routeCoordinates.length < 2) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'routeCoordinates must contain at least 2 points' });
        return;
      }

      const flightPath = cinematicCameraService.generateRouteFlightPath(
        data.routeCoordinates,
        'Live Camera Stream',
        100,
        15
      );

      socket.emit(SOCKET_EVENTS.SPATIAL_CAMERA_FLYBY_UPDATE, {
        flightId: data.flightId,
        flightPath,
      });
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });

  /**
   * 4D Dynamic Space: Real-time time slider scrub & diurnal atmosphere synchronization.
   */
  socket.on(SOCKET_EVENTS.DYNAMIC_4D_TIME_SLIDER_SYNC, (data: { center: Coordinate; targetTimestamp: number; weather?: string }) => {
    try {
      if (!data?.center || !Array.isArray(data.center)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'center [lon, lat] required for 4D time slider sync' });
        return;
      }

      const sceneState = dynamicSpace4DService.generate4DSceneState(
        data.center,
        1000,
        data.targetTimestamp || Date.now(),
        data.weather as any
      );

      socket.emit(SOCKET_EVENTS.DYNAMIC_4D_SCENE_STREAM, sceneState);
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });

  /**
   * High-Precision Indoor: Real-time floor occupancy and crowd density streaming.
   */
  socket.on(SOCKET_EVENTS.INDOOR_CROWD_DENSITY_STREAM, (data: { facilityId: string; floorLevel: number }) => {
    try {
      if (!data?.facilityId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'facilityId required' });
        return;
      }

      const room = `indoor:facility:${data.facilityId}:floor:${data.floorLevel ?? 0}`;
      socket.join(room);

      socket.emit(SOCKET_EVENTS.INDOOR_CROWD_DENSITY_STREAM, {
        facilityId: data.facilityId,
        floorLevel: data.floorLevel ?? 0,
        occupancyFactor: 0.68,
        activeCrowdZones: [
          { zoneId: 'zone_central_atrium', crowdLevel: 'moderate', densityPaxPerM2: 0.8 },
          { zoneId: 'zone_security_checkpoint', crowdLevel: 'heavy', densityPaxPerM2: 1.6 },
        ],
        timestamp: Date.now(),
      });
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });

  /**
   * High-Precision Indoor: Real-time airport gate change & flight boarding alert broadcast.
   */
  socket.on(SOCKET_EVENTS.INDOOR_AIRPORT_GATE_UPDATE, (data: { flightNumber: string; newGate: string; terminal: string }) => {
    try {
      if (data?.flightNumber && data?.newGate) {
        io.emit(SOCKET_EVENTS.INDOOR_AIRPORT_GATE_UPDATE, {
          flightNumber: data.flightNumber,
          newGate: data.newGate,
          terminal: data.terminal || 'T3',
          timestamp: Date.now(),
          urgentBroadcast: true,
        });
      }
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });

  /**
   * High-Precision Indoor: Real-time railway platform change & train arrival broadcast.
   */
  socket.on(SOCKET_EVENTS.INDOOR_TRAIN_PLATFORM_UPDATE, (data: { trainNumber: string; platformNumber: number; stationCode: string }) => {
    try {
      if (data?.trainNumber && data?.platformNumber !== undefined) {
        io.emit(SOCKET_EVENTS.INDOOR_TRAIN_PLATFORM_UPDATE, {
          trainNumber: data.trainNumber,
          platformNumber: data.platformNumber,
          stationCode: data.stationCode || 'NDLS',
          timestamp: Date.now(),
          announcementAudioUri: `audio/announcements/train_${data.trainNumber}_pf_${data.platformNumber}.mp3`,
        });
      }
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message });
    }
  });
};

