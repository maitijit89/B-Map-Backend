import { Request, Response } from 'express';
import { geoTrackingService } from './geo-tracking.service';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class TrackingController {
  /**
   * POST /api/v1/tracking/update
   * Ingest driver/user location update into Redis Geo layer
   */
  async updateLocation(req: Request, res: Response): Promise<void> {
    try {
      const { userId, role, longitude, latitude, heading, speed, accuracy, metadata } = req.body;

      if (!userId || longitude === undefined || latitude === undefined) {
        sendError(res, 400, 'userId, longitude, and latitude are required');
        return;
      }

      await geoTrackingService.updateLocation({
        userId,
        role: role || 'driver',
        longitude: parseFloat(longitude),
        latitude: parseFloat(latitude),
        heading,
        speed,
        accuracy,
        metadata,
      });

      sendSuccess({
        res,
        message: 'Location updated in geospatial index',
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/tracking/nearby
   * Find active drivers or entities nearby via Redis GEOSEARCH
   */
  async getNearbyEntities(req: Request, res: Response): Promise<void> {
    try {
      const { longitude, latitude, radius, role, limit } = req.query;

      if (!longitude || !latitude) {
        sendError(res, 400, 'longitude and latitude query parameters are required');
        return;
      }

      const lon = parseFloat(longitude as string);
      const lat = parseFloat(latitude as string);

      const entities = await geoTrackingService.findNearbyEntities({
        longitude: lon,
        latitude: lat,
        radiusInMeters: radius ? parseFloat(radius as string) : 5000,
        role: (role as string) || 'driver',
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      sendSuccess({
        res,
        message: `Found ${entities.length} active nearby entities`,
        data: entities,
        meta: {
          searchPoint: [lon, lat],
          radiusMeters: radius ? parseFloat(radius as string) : 5000,
        },
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/tracking/:userId
   * Get an entity's current real-time coordinates
   */
  async getEntityLocation(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { role } = req.query;

      const location = await geoTrackingService.getEntityLocation(
        userId as string,
        (role as string) || 'driver'
      );

      if (!location) {
        sendError(res, 404, 'Entity location not found or inactive');
        return;
      }

      sendSuccess({
        res,
        data: {
          userId,
          coordinates: location,
        },
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }
}

export const trackingController = new TrackingController();
