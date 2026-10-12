import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, logger, errorHandler, notFoundHandler, apiRateLimiter } from './core';
import apiRouter from './routes';

export const createApp = (): Application => {
  const app = express();

  // Security headers & fingerprint masking
  app.disable('x-powered-by');
  app.use(helmet());

  // CORS configuration: Safe reflection when credentials=true
  const corsOriginOption =
    env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  app.use(
    cors({
      origin: corsOriginOption,
      credentials: true,
    })
  );

  // Global rate limiter against volumetric DoS
  app.use(apiRateLimiter);

  // Request parsing (hardened to 1MB to prevent memory exhaustion)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // HTTP access logger
  const morganStream = {
    write: (message: string) => {
      logger.info(message.trim());
    },
  };
  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: morganStream,
    })
  );

  // Base welcome route
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'B-Map Navigation Backend API',
      version: '1.0.0',
      description: 'High performance navigation, geospatial POI search, OSRM routing, Redis caching, and real-time Socket.IO tracking',
      docs: {
        adminDashboard: `${env.API_PREFIX}/admin/dashboard`,
        health: '/api/v1/health',
        directions: '/api/v1/routes/directions?origin=13.388860,52.517037&destination=13.397634,52.529407',
        placesNearby: '/api/v1/places/nearby?longitude=13.38886&latitude=52.51703&maxDistance=5000',
        navigation: '/api/v1/navigation/start',
        tracking: '/api/v1/tracking/nearby?longitude=13.38886&latitude=52.51703',
      },
    });
  });

  // Direct Admin Portal convenience route
  app.get('/admin', (_req: Request, res: Response) => {
    res.redirect(`${env.API_PREFIX}/admin/dashboard`);
  });

  // Mount API endpoints
  app.use(env.API_PREFIX, apiRouter);

  // 404 Handler
  app.use(notFoundHandler);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
