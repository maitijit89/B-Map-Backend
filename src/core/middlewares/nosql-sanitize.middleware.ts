import { NextFunction, Request, Response } from 'express';

/**
 * Enterprise NoSQL Injection Defense Middleware.
 * Recursively inspects and sanitizes request bodies, query strings, and route parameters
 * by stripping or sanitizing keys that begin with '$' (MongoDB operator injection)
 * or contain '.' (path traversal / arbitrary field injection).
 * Fully compatible with Express 5 request prototype getters.
 */

const sanitizeObject = (target: any): any => {
  if (!target || typeof target !== 'object') {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => sanitizeObject(item));
  }

  const cleanObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(target)) {
    // Strip keys with leading '$' (MongoDB operators) or containing '.' (field traversal)
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      cleanObj[key] = sanitizeObject(value);
    } else {
      cleanObj[key] = value;
    }
  }

  return cleanObj;
};

export const noSqlSanitizer = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    try {
      const sanitizedQuery = sanitizeObject(req.query);
      Object.defineProperty(req, 'query', {
        value: sanitizedQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      // Graceful fallback
    }
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
};
