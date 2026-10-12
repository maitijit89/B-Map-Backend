import rateLimit from 'express-rate-limit';
import { env } from '../config/env.config';

/**
 * Strict rate limiter for sensitive authentication & OTP endpoints.
 * Limits each IP to 15 attempts per 15 minutes to prevent credential stuffing and SMTP flooding.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 1000 : 15,
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
  },
});

/**
 * General API rate limiter for public endpoints.
 * Limits each IP to 300 requests per minute to prevent DoS.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.NODE_ENV === 'test' ? 5000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests from this client. Please slow down and try again shortly.',
  },
  skip: (req) => {
    // Skip health check and metrics endpoints
    return req.path === '/health' || req.path === '/api/v1/health';
  },
});
