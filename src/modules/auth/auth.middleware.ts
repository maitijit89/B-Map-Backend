import { NextFunction, Request, Response } from 'express';
import { sendError } from '../../core/utils/api-response';
import { jwtService, JwtUserPayload } from './jwt.service';

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

/**
 * Authentication middleware to verify JWT Bearer token in request headers.
 */
export const authenticateUser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 401, 'Unauthorized: Access token missing or invalid format. Please provide "Bearer <token>".');
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwtService.verifyToken(token);
    req.user = payload;
    next();
  } catch (error: any) {
    sendError(res, 401, error.message || 'Invalid or expired authentication token.');
  }
};

/**
 * Authorization middleware to restrict endpoint to administrators.
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'admin') {
    sendError(res, 403, 'Forbidden: Administrator privileges required.');
    return;
  }
  next();
};
