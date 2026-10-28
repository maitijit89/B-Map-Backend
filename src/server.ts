import http from 'http';
import { createApp } from './app';
import {
  connectDatabase,
  disconnectDatabase,
  env,
  logger,
  closeRedis,
  initRedis,
  AntiTamperSentinel,
} from './core';
import { initSocketServer } from './sockets';
import { keepaliveService } from './services/keepalive.service';
import { aiCopilotService, aiCopilotSocketBridge } from './modules/ai-copilot';
import { telemetryWorkerService } from './modules/telemetry-ingestion';

const startServer = async (): Promise<void> => {
  try {
    // 0. Initialize Runtime Anti-Tamper, Anti-Debugging & Memory Defense
    AntiTamperSentinel.initialize();

    // 1. Initialize Geospatial Database (MongoDB)
    await connectDatabase();

    // 2. Initialize Redis Cache & Real-Time Geo Layer
    initRedis();

    // 3. Initialize Express Application
    const app = createApp();

    // 4. Create HTTP Server with optimized connection keep-alive timeouts
    const httpServer = http.createServer(app);
    httpServer.keepAliveTimeout = 65000; // Exceeds 60s reverse proxy timeouts
    httpServer.headersTimeout = 66000; // Must be strictly greater than keepAliveTimeout
    httpServer.maxRequestsPerSocket = 1000;

    // 5. Initialize Socket.IO Real-Time Engine
    initSocketServer(httpServer);

    // 6. Listen on configured port
    httpServer.listen(env.PORT, async () => {
      logger.info(`🚀 B-Map Navigation Server listening on port ${env.PORT}`);
      logger.info(`📍 REST API available at: http://localhost:${env.PORT}${env.API_PREFIX}`);
      logger.info(`🔌 Socket.IO endpoint ready on: ws://localhost:${env.PORT}`);
      logger.info(`🗺️ OSRM Engine connected to: ${env.OSRM_BASE_URL}`);

      // Start anti-sleep keep-alive heartbeat if configured
      keepaliveService.start();

      // Start high-throughput asynchronous telemetry worker consumer
      telemetryWorkerService.start();

      // Initialize AI Copilot microservice connection, WebSocket bridge & Gemma LLM engine
      await aiCopilotService.initializeAIConnection();
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      keepaliveService.stop();
      await telemetryWorkerService.stop();
      aiCopilotSocketBridge.disconnect();

      try {
        const { getIO } = await import('./sockets');
        const io = getIO();
        logger.info('Draining active Socket.IO connections...');
        io.disconnectSockets(true);
        io.close();
      } catch (err: any) {
        logger.debug(`Socket draining note: ${err.message}`);
      }

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
