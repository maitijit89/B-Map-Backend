import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../core/config/env.config';
import { logger } from '../core/config/logger';
import { registerAICopilotHandlers } from '../modules/ai-copilot/ai-copilot.socket';
import { registerARWalkCycleHandlers } from '../modules/ar-walk-cycle/ar-walk-cycle.socket';
import { registerAutomotiveHandlers } from '../modules/automotive/automotive.socket';
import { registerCarNavigationHandlers } from '../modules/car-navigation/car-navigation.socket';
import { registerLaneRoutingHandlers } from '../modules/lane-routing/lane-routing.socket';
import { registerNavigationHandlers } from '../modules/navigation/navigation.socket';
import { registerParkingNavigationHandlers } from '../modules/parking/parking-navigation.socket';
import { registerPositioningHandlers } from '../modules/positioning/positioning.socket';
import { registerPublicTransitHandlers } from '../modules/public-transit/public-transit.socket';
import { registerRiderModeHandlers } from '../modules/rider-mode/rider-mode.socket';
import { registerSpatialVisualizationHandlers } from '../modules/spatial-visualization/spatial-visualization.socket';
import { registerSRNavigationHandlers } from '../modules/sr-navigation/sr-navigation.socket';
import { registerSuperAppHandlers } from '../modules/super-app/super-app.socket';
import { registerTrackingHandlers } from '../modules/tracking/tracking.socket';
import { registerUnifiedEngineHandlers } from '../modules/unified-engine/unified-engine.socket';
import { registerLocationAccessSocketHandlers } from '../modules/location-access/location-access.socket';
import { registerMotionFitnessSocketHandlers } from '../modules/motion-fitness/motion-fitness.socket';

let ioInstance: Server | null = null;

export const initSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`🔌 Socket connected: ${socket.id} (transport: ${socket.conn.transport.name})`);

    // Register domain handlers
    registerTrackingHandlers(io, socket);
    registerLocationAccessSocketHandlers(io, socket);
    registerMotionFitnessSocketHandlers(io, socket);
    registerNavigationHandlers(io, socket);
    registerPositioningHandlers(io, socket);
    registerLaneRoutingHandlers(io, socket);
    registerUnifiedEngineHandlers(io, socket);

    // Next-Gen Intelligent Driving handlers
    registerSRNavigationHandlers(io, socket);
    registerAutomotiveHandlers(io, socket);
    registerRiderModeHandlers(io, socket);
    registerParkingNavigationHandlers(io, socket);

    // Multi-Mode Core Navigation handlers
    registerCarNavigationHandlers(io, socket);
    registerPublicTransitHandlers(io, socket);
    registerARWalkCycleHandlers(io, socket);

    // Comprehensive AI & LLM Copilot handlers
    registerAICopilotHandlers(io, socket);

    // Advanced Visualization & Spatial Mapping handlers
    registerSpatialVisualizationHandlers(io, socket);

    // Unified Super-App Ecosystem (Rides, Lifestyle, Offline) handlers
    registerSuperAppHandlers(io, socket);

    socket.on('disconnect', (reason: string) => {
      logger.info(`🔌 Socket disconnected: ${socket.id} (reason: ${reason})`);
    });

    socket.on('error', (err: any) => {
      logger.error(`Socket error for ${socket.id}:`, err);
    });
  });

  ioInstance = io;
  logger.info('⚡ Socket.IO real-time navigation, tracking, positioning, lane guidance & spatial visualization layers initialized');
  return io;
};

export const getIO = (): Server => {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized yet');
  }
  return ioInstance;
};
