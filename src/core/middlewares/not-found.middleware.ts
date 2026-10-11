import { Request, Response } from 'express';
import { sendError } from '../utils/api-response';

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
};
