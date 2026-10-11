import { Request, Response } from 'express';
import { osrmService } from './osrm.service';
import { routeCacheService } from './route-cache.service';
import { Coordinate } from '../../core/types/geo.types';
import { DirectionsQueryOptions } from '../../core/types/osrm.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class RouteController {
  /**
   * GET /api/v1/routes/directions
   * Computes turn-by-turn route between origin and destination.
   */
  async getDirections(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, waypoints, profile, alternatives, steps, overview } = req.query;

      if (!origin || !destination) {
        sendError(res, 400, 'Origin and destination are required (format: lon,lat)');
        return;
      }

      const parseCoord = (str: string): Coordinate => {
        const parts = str.split(',').map((p) => parseFloat(p.trim()));
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
          throw new Error(`Invalid coordinate format: ${str}. Expected "longitude,latitude"`);
        }
        return [parts[0], parts[1]];
      };

      const originCoord = parseCoord(origin as string);
      const destCoord = parseCoord(destination as string);

      const waypointCoords: Coordinate[] = waypoints
        ? (waypoints as string).split('|').map((w) => parseCoord(w))
        : [];

      const coordinates: Coordinate[] = [originCoord, ...waypointCoords, destCoord];

      const options: DirectionsQueryOptions = {
        coordinates,
        profile: (profile as any) || 'driving',
        steps: steps === 'false' ? false : true,
        alternatives: alternatives === 'true',
        overview: (overview as any) || 'full',
        geometries: 'geojson',
      };

      // 1. Check Redis Cache
      const cacheKey = routeCacheService.generateKey(options);
      const cached = await routeCacheService.get(cacheKey);

      if (cached) {
        sendSuccess({
          res,
          message: 'Route fetched from cache',
          data: cached,
          meta: { cached: true, cacheKey },
        });
        return;
      }

      // 2. Compute via OSRM
      const result = await osrmService.getRoute(options);

      // 3. Store in Cache
      await routeCacheService.set(cacheKey, result);

      sendSuccess({
        res,
        message: 'Route computed successfully',
        data: result,
        meta: { cached: false, cacheKey },
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/routes/optimize
   * Solves Traveling Salesperson Problem (TSP) for multi-stop routes.
   */
  async optimizeTrip(req: Request, res: Response): Promise<void> {
    try {
      const { coordinates, profile, roundtrip, source, destination } = req.body;

      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        sendError(res, 400, 'Coordinates must be an array of at least 2 [longitude, latitude] pairs');
        return;
      }

      const result = await osrmService.optimizeTrip(coordinates, profile, {
        roundtrip,
        source,
        destination,
      });

      sendSuccess({
        res,
        message: 'Trip optimized successfully',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/routes/match
   * Map matches GPS trace coordinates to road network.
   */
  async matchTrace(req: Request, res: Response): Promise<void> {
    try {
      const { coordinates, profile, timestamps, radiuses } = req.body;

      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        sendError(res, 400, 'Coordinates must be an array of at least 2 [longitude, latitude] pairs');
        return;
      }

      const result = await osrmService.matchTrace(coordinates, profile, {
        timestamps,
        radiuses,
      });

      sendSuccess({
        res,
        message: 'GPS trace matched to road network successfully',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/routes/matrix
   * Computes distance and duration matrix between sets of points.
   */
  async getDistanceMatrix(req: Request, res: Response): Promise<void> {
    try {
      const { coordinates, profile, sources, destinations } = req.query;

      if (!coordinates) {
        sendError(res, 400, 'coordinates parameter is required (format: "lon1,lat1;lon2,lat2;...")');
        return;
      }

      const parsedCoords: Coordinate[] = (coordinates as string).split(';').map((coordStr) => {
        const [lon, lat] = coordStr.split(',').map((p) => parseFloat(p.trim()));
        if (isNaN(lon) || isNaN(lat)) {
          throw new Error(`Invalid coordinate: ${coordStr}`);
        }
        return [lon, lat];
      });

      const parsedSources = sources
        ? (sources as string).split(';').map((s) => parseInt(s.trim(), 10))
        : undefined;

      const parsedDestinations = destinations
        ? (destinations as string).split(';').map((d) => parseInt(d.trim(), 10))
        : undefined;

      const result = await osrmService.getTable(parsedCoords, profile as any, {
        sources: parsedSources,
        destinations: parsedDestinations,
      });

      sendSuccess({
        res,
        message: 'Distance matrix calculated successfully',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }
}

export const routeController = new RouteController();
