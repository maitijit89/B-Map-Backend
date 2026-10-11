import { Request, Response } from 'express';
import { placeService } from './place.service';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class PlaceController {
  /**
   * POST /api/v1/places
   * Create a new geospatial Point of Interest
   */
  async createPlace(req: Request, res: Response): Promise<void> {
    try {
      const { name, category, description, address, coordinates, rating, tags, metadata } = req.body;

      if (!name || !category || !coordinates) {
        sendError(res, 400, 'name, category, and coordinates [lon, lat] are required');
        return;
      }

      const place = await placeService.createPlace({
        name,
        category,
        description,
        address,
        coordinates,
        rating,
        tags,
        metadata,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Place created successfully',
        data: place,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/places/nearby
   * Find places nearby a coordinate using MongoDB 2dsphere $near
   */
  async getNearby(req: Request, res: Response): Promise<void> {
    try {
      const { longitude, latitude, maxDistance, minDistance, category, limit } = req.query;

      if (!longitude || !latitude) {
        sendError(res, 400, 'longitude and latitude query parameters are required');
        return;
      }

      const lon = parseFloat(longitude as string);
      const lat = parseFloat(latitude as string);

      if (isNaN(lon) || isNaN(lat)) {
        sendError(res, 400, 'longitude and latitude must be valid numbers');
        return;
      }

      const places = await placeService.findNearby({
        longitude: lon,
        latitude: lat,
        maxDistanceMeters: maxDistance ? parseFloat(maxDistance as string) : 5000,
        minDistanceMeters: minDistance ? parseFloat(minDistance as string) : undefined,
        category: category as string,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      sendSuccess({
        res,
        message: `Found ${places.length} nearby places`,
        data: places,
        meta: {
          searchPoint: [lon, lat],
          maxDistanceMeters: maxDistance ? parseFloat(maxDistance as string) : 5000,
        },
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/places/within-polygon
   * Find places bounded inside a polygon using MongoDB $geoWithin
   */
  async getWithinPolygon(req: Request, res: Response): Promise<void> {
    try {
      const { coordinates, category } = req.body;

      if (!Array.isArray(coordinates) || coordinates.length < 1) {
        sendError(res, 400, 'coordinates array for polygon rings is required');
        return;
      }

      const places = await placeService.findWithinPolygon(coordinates, category);

      sendSuccess({
        res,
        message: `Found ${places.length} places inside polygon`,
        data: places,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/places/search
   * Search places by text keyword
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const { q, category, limit } = req.query;

      if (!q || typeof q !== 'string') {
        sendError(res, 400, 'Search keyword "q" is required');
        return;
      }

      const places = await placeService.searchPlaces(
        q,
        category as string,
        limit ? parseInt(limit as string, 10) : 20
      );

      sendSuccess({
        res,
        message: `Search returned ${places.length} results`,
        data: places,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/places/:id
   * Get single place by id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const place = await placeService.getPlaceById(req.params.id as string);
      if (!place) {
        sendError(res, 404, 'Place not found');
        return;
      }

      sendSuccess({
        res,
        data: place,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }
}

export const placeController = new PlaceController();
