import { ErrorRequestHandler } from 'express';
import { env } from '../config/env.config';
import { logger } from '../config/logger';
import { sendError } from '../utils/api-response';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error('Unhandled API Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  const message = err.message || 'Internal Server Error';

  sendError(
    res,
    statusCode,
    message,
    env.NODE_ENV === 'development' ? { stack: err.stack } : undefined
  );
};
