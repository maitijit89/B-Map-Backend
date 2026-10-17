import { NextFunction, Request, Response } from 'express';

/**
 * Enterprise HTTP Parameter Pollution (HPP) Defense Middleware.
 * Prevents attackers from submitting multiple parameters with identical names to bypass
 * type checks or security validations (e.g., ?role=user&role=admin -> req.query.role = ['user', 'admin']).
 * Fully compatible with Express 5 request prototype getters.
 */
export const hppProtection = (whitelist: string[] = ['sort', 'filter', 'tags', 'fields']) => {
  const allowedSet = new Set(whitelist);

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.query || typeof req.query !== 'object') {
      return next();
    }

    try {
      const cleanQuery: Record<string, any> = { ...req.query };

      for (const [key, value] of Object.entries(cleanQuery)) {
        if (Array.isArray(value) && !allowedSet.has(key)) {
          // Select the last provided parameter value to normalize the input
          cleanQuery[key] = value[value.length - 1];
        }
      }

      Object.defineProperty(req, 'query', {
        value: cleanQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      // Graceful fallback
    }

    next();
  };
};
