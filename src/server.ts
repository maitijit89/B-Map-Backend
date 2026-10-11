import http from 'http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase, env, logger, closeRedis, initRedis } from './core';
import { initSocketServer } from './sockets';
import { keepaliveService } from './services/keepalive.service';

const startServer = async (): Promise<void> => {
  try {
    // 1. Initialize Geospatial Database (MongoDB)
    await connectDatabase();

    // 2. Initialize Redis Cache & Real-Time Geo Layer
    initRedis();

    // 3. Initialize Express Application
    const app = createApp();

    // 4. Create HTTP Server
    const httpServer = http.createServer(app);

    // 5. Initialize Socket.IO Real-Time Engine
    initSocketServer(httpServer);

    // 6. Listen on configured port
    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 B-Map Navigation Server listening on port ${env.PORT}`);
      logger.info(`📍 REST API available at: http://localhost:${env.PORT}${env.API_PREFIX}`);
      logger.info(`🔌 Socket.IO endpoint ready on: ws://localhost:${env.PORT}`);
      logger.info(`🗺️ OSRM Engine connected to: ${env.OSRM_BASE_URL}`);

      // Start anti-sleep keep-alive heartbeat if configured
      keepaliveService.start();
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      keepaliveService.stop();

      httpServer.close(async () => {
        logger.info('HTTP server closed.');

        try {
          await disconnectDatabase();
          await closeRedis();
          logger.info('All database and cache connections closed. Exiting process.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during graceful shutdown:', err);
          process.exit(1);
        }
      });

      // Force exit if shutdown takes too long
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Fatal error starting server:', error);
    process.exit(1);
  }
};

startServer();
