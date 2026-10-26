import { NextFunction, Request, Response } from 'express';

/**
 * Enterprise NoSQL Injection Defense Middleware.
 * Recursively inspects and sanitizes request bodies, query strings, and route parameters
 * by stripping or sanitizing keys that begin with '$' (MongoDB operator injection)
 * or contain '.' (path traversal / arbitrary field injection).
 * Fully compatible with Express 5 request prototype getters.
 */

const hasDangerousKeysOrObjects = (target: Record<string, any>): boolean => {
  for (const key in target) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      if (key.charCodeAt(0) === 36 /* '$' */ || key.indexOf('.') !== -1) {
        return true;
      }
      const val = target[key];
      if (typeof val === 'object' && val !== null) {
        return true;
      }
    }
  }
  return false;
};

const sanitizeObject = (target: any): any => {
  if (!target || typeof target !== 'object') {
    return target;
  }

  if (Array.isArray(target)) {
    if (target.length === 0) return target;
    return target.map((item) => sanitizeObject(item));
  }

  // Fast-path: if object has no dangerous keys and no nested objects, return directly
  if (!hasDangerousKeysOrObjects(target)) {
    return target;
  }

  const cleanObj: Record<string, any> = {};

  for (const key in target) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      if (key.charCodeAt(0) === 36 /* '$' */ || key.indexOf('.') !== -1) {
        continue;
      }

      const value = target[key];
      if (typeof value === 'object' && value !== null) {
        cleanObj[key] = sanitizeObject(value);
      } else {
        cleanObj[key] = value;
      }
    }
  }

  return cleanObj;
};

export const noSqlSanitizer = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
    try {
      const sanitizedQuery = sanitizeObject(req.query);
      if (sanitizedQuery !== req.query) {
        Object.defineProperty(req, 'query', {
          value: sanitizedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    } catch {
      // Graceful fallback
    }
  }

  if (req.params && typeof req.params === 'object' && Object.keys(req.params).length > 0) {
    req.params = sanitizeObject(req.params);
  }

  next();
};
