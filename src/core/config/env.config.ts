import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // App & Server Configuration
  APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_PORT: z.string().default('8080').transform((val) => parseInt(val, 10)),
  PORT: z.string().default(process.env.APP_PORT || '8080').transform((val) => parseInt(val, 10)),
  APP_NAME: z.string().default('B Map'),
  APP_URL: z.string().default('http://localhost:8080'),
  APP_VERSION: z.string().default('0.1.2'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('*'),

  // JWT Configuration
  JWT_SECRET: z.string().default('dUzuLuJ8uszVSe+kvXv6/AjAtN08uXCN9aiJuIvdrBo='),
  JWT_EXPIRY_HOURS: z.string().default('72').transform((val) => parseInt(val, 10)),

  // Admin Configuration
  ADMIN_EMAIL: z.string().default('maitidebjit2@gmail.com'),

  // MongoDB Geospatial Database
  MONGODB_URI: z.string().default('mongodb://localhost:27017/b_map_navigation'),
  DB_HOST: z.string().default('cluster0.s6zrwkc.mongodb.net'),
  DB_PORT: z.string().default('27017').transform((val) => parseInt(val, 10)),
  DB_USER: z.string().default('maitidebjit2_db_user'),
  DB_PASSWORD: z.string().default('1yqGJxCmp6KzeyMc'),
  DB_NAME: z.string().default('b_map_db'),

  // Redis Cache (Upstash Cloud / Local)
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('national-bug-258874.upstash.io'),
  REDIS_PORT: z.string().default('6379').transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0').transform((val) => parseInt(val, 10)),
  REDIS_KEY_PREFIX: z.string().default('bmap:'),
  REDIS_ROUTE_CACHE_TTL_SECONDS: z.string().default('3600').transform((val) => parseInt(val, 10)),
  OTP_EXPIRY_MINUTES: z.string().default('5').transform((val) => parseInt(val, 10)),

  // Cloudinary Storage
  CLOUDINARY_CLOUD_NAME: z.string().default('jon6vask'),
  CLOUDINARY_API_KEY: z.string().default('439324579931125'),
  CLOUDINARY_API_SECRET: z.string().default('9346Mxh4TmJd-anhDqFVPqDKCgg'),
  CLOUDINARY_FOLDER: z.string().default('b_map_uploads'),

  // Google Maps Platform
  GOOGLE_MAPS_API_KEY: z.string().default('AIzaSyC5xaYmrltiPZaNNzAwc62ULZoSXFe0IPc'),
  GOOGLE_PLACES_API_KEY: z.string().default('AIzaSyC5xaYmrltiPZaNNzAwc62ULZoSXFe0IPc'),
  GOOGLE_MAPS_API_SECRET: z.string().default('ojqqznoex52Tp0KTbD8D4xbFGtk='),

  // SMTP Configuration (Gmail OTP Delivery)
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587').transform((val) => parseInt(val, 10)),
  SMTP_USERNAME: z.string().default('maitidebjit2@gmail.com'),
  SMTP_PASSWORD: z.string().default('zrlq mahe eyeq lkhh'),
  SMTP_FROM_EMAIL: z.string().default('maitidebjit2@gmail.com'),
  SMTP_FROM_NAME: z.string().default('B Map'),

  // Keep-Alive Heartbeat
  KEEPALIVE_ENABLED: z.string().default('true').transform((val) => val === 'true'),
  KEEPALIVE_INTERVAL_MINUTES: z.string().default('2').transform((val) => parseInt(val, 10)),

  // OSRM
  OSRM_BASE_URL: z.string().default('https://router.project-osrm.org'),
  OSRM_DEFAULT_PROFILE: z.enum(['driving', 'bike', 'foot']).default('driving'),
  OSRM_TIMEOUT_MS: z.string().default('8000').transform((val) => parseInt(val, 10)),

  // Navigation Logic
  OFF_ROUTE_THRESHOLD_METERS: z.string().default('40').transform((val) => parseInt(val, 10)),
  REROUTE_COOLDOWN_SECONDS: z.string().default('5').transform((val) => parseInt(val, 10)),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
