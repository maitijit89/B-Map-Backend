import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import {
  env,
  logger,
  errorHandler,
  notFoundHandler,
  apiRateLimiter,
  antiReconTrap,
  noSqlSanitizer,
  hppProtection,
} from './core';
import apiRouter from './routes';

export const createApp = (): Application => {
  const app = express();

  // 1. Anti-Reconnaissance & Vulnerability Scanner Trap (Blocks automated bots/probes)
  app.use(antiReconTrap);

  // 2. Security Headers & Server Fingerprint Obfuscation
  app.disable('x-powered-by');
  app.use((_req: Request, res: Response, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('Server', 'Protected-Gateway');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // 3. CORS Configuration
  const corsOriginOption =
    env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  app.use(
    cors({
      origin: corsOriginOption,
      credentials: env.CORS_ORIGIN !== '*',
    })
  );

  // 4. Global Rate Limiter against volumetric DoS
  app.use(apiRateLimiter);

  // 5. Request Parsing (Restricted to 1MB to prevent memory exhaustion DoS)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 6. NoSQL Operator & MongoDB Query Injection Sanitization
  app.use(noSqlSanitizer);

  // 7. HTTP Parameter Pollution (HPP) Defense
  app.use(hppProtection());

  // 8. HTTP Access Logger
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
      version: env.NODE_ENV === 'production' ? '1.0' : '1.0.0',
      status: 'operational',
      ...(env.NODE_ENV === 'development'
        ? {
            description:
              'High performance navigation, geospatial POI search, OSRM routing, Redis caching, and real-time Socket.IO tracking',
            docs: {
              adminDashboard: `${env.API_PREFIX}/admin/dashboard`,
              health: '/api/v1/health',
              directions:
                '/api/v1/routes/directions?origin=13.388860,52.517037&destination=13.397634,52.529407',
              placesNearby:
                '/api/v1/places/nearby?longitude=13.38886&latitude=52.51703&maxDistance=5000',
              navigation: '/api/v1/navigation/start',
              tracking: '/api/v1/tracking/nearby?longitude=13.38886&latitude=52.51703',
            },
          }
        : {}),
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
