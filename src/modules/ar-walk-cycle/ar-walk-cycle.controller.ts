import { Request, Response } from 'express';
import { arWalkCycleService } from './ar-walk-cycle.service';
import { arVisualSearchService } from './ar-visual-search.service';
import { getARVisualSearchViewHtml } from './ar-visual-search.view';
import { Coordinate } from '../../core/types/geo.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { env } from '../../core/config/env.config';

export class ARWalkCycleController {
  /**
   * Computes 3D Augmented Reality (AR) HUD frame with viewport projection
   */
  async computeARHUD(req: Request, res: Response): Promise<void> {
    try {
      const { cameraPose, waypoints, currentStepInstruction, distanceToNextTurnMeters } = req.body;
      if (!cameraPose || !waypoints || !Array.isArray(waypoints)) {
        sendError(res, 400, 'cameraPose and waypoints array are required');
        return;
      }

      const frame = arWalkCycleService.computeARHUDFrame({
        cameraPose,
        waypoints,
        currentStepInstruction,
        distanceToNextTurnMeters,
      });

      sendSuccess({
        res,
        message: 'AR HUD projection frame computed successfully',
        data: frame,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Plans pedestrian walking route (wheelchair accessible, sheltered arcade mode)
   */
  async planWalkRoute(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, options } = req.body;
      if (!origin || !destination) {
        sendError(res, 400, 'origin [lon, lat] and destination [lon, lat] are required');
        return;
      }

      const origCoord: Coordinate = [origin[0], origin[1]];
      const destCoord: Coordinate = [destination[0], destination[1]];

      const plan = await arWalkCycleService.planWalkRoute({
        origin: origCoord,
        destination: destCoord,
        options,
      });

      sendSuccess({
        res,
        message: 'Pedestrian walk route planned successfully',
        data: plan,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Plans cycling route with elevation gradient profiling and bike amenities
   */
  async planCycleRoute(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, vehicleType } = req.body;
      if (!origin || !destination) {
        sendError(res, 400, 'origin [lon, lat] and destination [lon, lat] are required');
        return;
      }

      const origCoord: Coordinate = [origin[0], origin[1]];
      const destCoord: Coordinate = [destination[0], destination[1]];

      const plan = await arWalkCycleService.planCycleRoute({
        origin: origCoord,
        destination: destCoord,
        vehicleType,
      });

      sendSuccess({
        res,
        message: 'Cycle route and elevation profile planned successfully',
        data: plan,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Queries nearby bike amenities (air pumps, repair stands, chargers)
   */
  async getNearbyAmenities(req: Request, res: Response): Promise<void> {
    try {
      const lon = parseFloat(req.query.longitude as string);
      const lat = parseFloat(req.query.latitude as string);
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 3000;

      if (isNaN(lon) || isNaN(lat)) {
        sendError(res, 400, 'Valid longitude and latitude query parameters required');
        return;
      }

      const amenities = await arWalkCycleService.getNearbyAmenities([lon, lat], radius);
      sendSuccess({
        res,
        message: 'Nearby bicycle amenities retrieved',
        data: { count: amenities.length, amenities },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Multimodal AI Visual Localization:
   * Accepts user photo upload, executes the visual landmark recognition algorithm,
   * extracts signage OCR/architectural signatures, and returns verified location
   * search results with AR navigation guidance & 3D HUD frame.
   */
  async searchByPhoto(req: Request, res: Response): Promise<void> {
    try {
      const { image, userLocation, userAltitudeMeters, searchRadiusMeters, cameraPose, hint } = req.body;
      if (!image) {
        sendError(res, 400, 'Image payload (base64 string, data URL, or image URL) is required');
        return;
      }

      let parsedUserLocation: Coordinate | undefined;
      if (Array.isArray(userLocation) && userLocation.length === 2) {
        parsedUserLocation = [parseFloat(userLocation[0]), parseFloat(userLocation[1])];
      }

      const result = await arVisualSearchService.searchLocationByPhoto({
        image,
        userLocation: parsedUserLocation,
        userAltitudeMeters: userAltitudeMeters ? parseFloat(userAltitudeMeters) : undefined,
        searchRadiusMeters: searchRadiusMeters ? parseFloat(searchRadiusMeters) : undefined,
        cameraPose,
        hint,
      });

      sendSuccess({
        res,
        message: `AI visual landmark localization identified: ${result.topMatch.name}`,
        data: result,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Serves the interactive glassmorphic Web UI for AR Visual Navigation & AI Search
   */
  async getVisualSearchView(_req: Request, res: Response): Promise<void> {
    try {
      const html = getARVisualSearchViewHtml(env.API_PREFIX);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err: any) {
      sendError(res, 500, `Failed to render AR Visual Navigation view: ${err.message}`);
    }
  }
}

export const arWalkCycleController = new ARWalkCycleController();
