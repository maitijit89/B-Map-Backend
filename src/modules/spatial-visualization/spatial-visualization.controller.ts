import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { building3DService } from './building-3d.service';
import { cinematicCameraService } from './cinematic-camera.service';
import { dynamicSpace4DService } from './dynamic-space-4d.service';
import { environmentalShadingService } from './environmental-shading.service';
import { indoorPrecisionViewService } from './indoor-precision-view.service';
import { multiFloorSpatialService } from './multi-floor-spatial.service';
import { spatioTemporalHeatmapService } from './spatio-temporal-heatmap.service';
import {
  BuildingLodLevel,
  IndianTierLevel,
  IndianUrbanRegion,
  IndoorFacilityCategory,
  TileLayerType,
} from './spatial-visualization.types';
import { streetView360Service } from './street-view-360.service';
import { vectorTileService } from './vector-tile.service';

export class SpatialVisualizationController {
  /**
   * GET /api/v1/spatial-vis/buildings/3d
   * Query 3D digital twin building extrusions by bounding box or center/radius.
   */
  async get3DBuildings(req: Request, res: Response): Promise<void> {
    try {
      const { bbox, longitude, latitude, radius, lod } = req.query;
      const targetLod = (lod as BuildingLodLevel) || 'LOD2';

      if (bbox && typeof bbox === 'string') {
        const parts = bbox.split(',').map((p) => parseFloat(p.trim()));
        if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
          const buildings = await building3DService.getBuildingsInBounds(
            parts as [number, number, number, number],
            targetLod
          );
          sendSuccess({
            res,
            message: `Retrieved ${buildings.length} 3D building profiles`,
            data: buildings,
            meta: { count: buildings.length, lod: targetLod },
          });
          return;
        }
      }

      if (longitude && latitude) {
        const lon = parseFloat(String(longitude));
        const lat = parseFloat(String(latitude));
        const rad = radius ? parseFloat(String(radius)) : 500;

        const buildings = await building3DService.getBuildingsNear(
          [lon, lat],
          rad,
          targetLod
        );

        sendSuccess({
          res,
          message: `Retrieved ${buildings.length} 3D buildings within ${rad}m`,
          data: buildings,
          meta: { count: buildings.length, radiusMeters: rad, lod: targetLod },
        });
        return;
      }

      sendError(res, 400, 'Either "bbox" (west,south,east,north) or "longitude,latitude" required');
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/spatial-vis/tiles/:z/:x/:y
   * Generate vector tile for Slippy map coordinate (z, x, y).
   */
  async getVectorTile(req: Request, res: Response): Promise<void> {
    try {
      const z = parseInt(String(req.params.z), 10);
      const x = parseInt(String(req.params.x), 10);
      const y = parseInt(String(req.params.y), 10);
      const layersParam = req.query.layers ? String(req.query.layers) : undefined;

      if (isNaN(z) || isNaN(x) || isNaN(y)) {
        sendError(res, 400, 'Invalid tile coordinates (z, x, y must be integers)');
        return;
      }

      const requestedLayers: TileLayerType[] = layersParam
        ? (layersParam.split(',') as TileLayerType[])
        : ['roads', 'buildings', 'water', 'pois'];

      const tile = await vectorTileService.generateVectorTile(
        { z, x, y },
        requestedLayers
      );

      sendSuccess({
        res,
        message: `Vector tile generated for (${z}/${x}/${y})`,
        data: tile,
        meta: {
          featureCount: tile.featureCount,
          byteSize: tile.byteSize,
        },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/spatial-vis/heatmaps/hexagonal
   * Aggregate points into a spatio-temporal hexagonal density grid.
   */
  async generateHexHeatmap(req: Request, res: Response): Promise<void> {
    try {
      const { center, radiusMeters, hexRadiusMeters, points } = req.body;

      if (!Array.isArray(center) || center.length !== 2) {
        sendError(res, 400, 'center [lon, lat] is required');
        return;
      }

      const pointsArray = Array.isArray(points) ? points : [];
      const frame = spatioTemporalHeatmapService.generateHexagonalHeatmap(
        center as [number, number],
        radiusMeters || 1500,
        hexRadiusMeters || 100,
        pointsArray
      );

      sendSuccess({
        res,
        message: `Generated heatmap with ${frame.bins.length} hexagonal bins`,
        data: frame,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/spatial-vis/multi-floor/:facilityId
   * Query multi-floor building stack or specific level slice.
   */
  async getMultiFloorStack(req: Request, res: Response): Promise<void> {
    try {
      const facilityId = String(req.params.facilityId);
      const { level } = req.query;

      if (level !== undefined) {
        const floorLevel = parseInt(String(level), 10);
        const slice = multiFloorSpatialService.getFloorSlice(facilityId, floorLevel);
        if (!slice) {
          sendError(res, 404, `Floor level ${floorLevel} not found in facility ${facilityId}`);
          return;
        }
        sendSuccess({ res, data: slice });
        return;
      }

      const stack = multiFloorSpatialService.getFacilityFloorStack(facilityId);
      sendSuccess({
        res,
        message: `Retrieved ${stack.length} vertical floor levels`,
        data: stack,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/spatial-vis/multi-floor/viaducts
   * Query multi-tier elevated flyover viaducts.
   */
  async getViaductSections(req: Request, res: Response): Promise<void> {
    try {
      const { corridor } = req.query;
      const corridorStr = corridor ? String(corridor) : undefined;
      const sections = multiFloorSpatialService.getViaductSections(corridorStr);
      sendSuccess({
        res,
        message: `Retrieved ${sections.length} elevated viaduct sections`,
        data: sections,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/spatial-vis/environmental/solar-shadows
   * Calculate sun position and project building shadow polygons.
   */
  async getSolarShadows(req: Request, res: Response): Promise<void> {
    try {
      const { longitude, latitude, timestamp } = req.query;

      if (!longitude || !latitude) {
        sendError(res, 400, 'longitude and latitude are required');
        return;
      }

      const lon = parseFloat(String(longitude));
      const lat = parseFloat(String(latitude));
      const date = timestamp ? new Date(parseInt(String(timestamp), 10)) : new Date();

      const solar = environmentalShadingService.calculateSolarPosition([lon, lat], date);
      const buildings = await building3DService.getBuildingsNear([lon, lat], 600, 'LOD2');
      const shadows = environmentalShadingService.projectBuildingShadows(buildings, solar);

      sendSuccess({
        res,
        message: `Projected ${shadows.length} building shadows`,
        data: {
          solarPosition: solar,
          shadows,
        },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/spatial-vis/environmental/weather-radar
   * Get dynamic weather radar reflectivity overlay mesh.
   */
  async getWeatherRadar(req: Request, res: Response): Promise<void> {
    try {
      const { longitude, latitude, radius, intensity } = req.query;
      const lon = longitude ? parseFloat(String(longitude)) : 13.388;
      const lat = latitude ? parseFloat(String(latitude)) : 52.517;
      const rad = radius ? parseFloat(String(radius)) : 10000;

      const radar = environmentalShadingService.generateWeatherRadarOverlay(
        [lon, lat],
        rad,
        (intensity as any) || 'moderate'
      );

      sendSuccess({
        res,
        message: 'Dynamic weather radar layer generated',
        data: radar,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/spatial-vis/camera/flight-path
   * Generate 3D cinematic camera flyover path along route waypoints.
   */
  async generateCameraFlyover(req: Request, res: Response): Promise<void> {
    try {
      const { routeCoordinates, routeName, altitudeMeters, durationSeconds } = req.body;

      if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) {
        sendError(res, 400, 'routeCoordinates array of at least 2 [lon, lat] points is required');
        return;
      }

      const flightPath = cinematicCameraService.generateRouteFlightPath(
        routeCoordinates,
        routeName,
        altitudeMeters || 120,
        durationSeconds || 30
      );

      sendSuccess({
        res,
        message: `Generated cinematic flight path with ${flightPath.cameraPoses.length} camera poses`,
        data: flightPath,
      });
    } catch (err: any) {
      sendError(res, 400, err.message);
    }
  }

  // =========================================================================
  // 7. 360-DEGREE STREET-LEVEL VIEW & INDIAN URBAN COVERAGE
  // =========================================================================

  /**
   * GET /api/v1/spatial-vis/street-view/coverage
   * Get coverage analytics proving >95% Indian urban centers covered.
   */
  async getIndianCoverageAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const analytics = streetView360Service.getCoverageAnalytics();
      sendSuccess({
        res,
        message: `Indian Urban Coverage: ${analytics.nationalUrbanCoveragePercentage}% across ${analytics.coveredUrbanCentersCount} urban centers`,
        data: analytics,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/spatial-vis/street-view/cities
   * List Indian urban center profiles with optional region or tier filtering.
   */
  async getUrbanCenters(req: Request, res: Response): Promise<void> {
    try {
      const { region, tier } = req.query;
      const centers = streetView360Service.getUrbanCenters({
        region: region as IndianUrbanRegion,
        tier: tier as IndianTierLevel,
      });

      sendSuccess({
        res,
        message: `Retrieved ${centers.length} Indian urban center profiles`,
        data: centers,
        meta: { count: centers.length },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/spatial-vis/street-view/nearest
   * Find nearest 360-degree high-definition panorama to coordinate.
   */
  async getNearestPanorama(req: Request, res: Response): Promise<void> {
    try {
      const { longitude, latitude, radius, heading } = req.query;

      if (!longitude || !latitude) {
        sendError(res, 400, 'longitude and latitude are required');
        return;
      }

      const lon = parseFloat(String(longitude));
      const lat = parseFloat(String(latitude));
      const rad = radius ? parseFloat(String(radius)) : 500;
      const headingTol = heading !== undefined ? parseFloat(String(heading)) : undefined;

      const pano = await streetView360Service.findNearestPanorama([lon, lat], rad, headingTol);
      if (!pano) {
        sendError(res, 404, `No 360-degree panorama found within ${rad}m of [${lon}, ${lat}]`);
        return;
      }

      sendSuccess({
        res,
        message: `Found 360 panorama: ${pano.panoId} (${pano.resolution}) in ${pano.cityName}`,
        data: pano,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/spatial-vis/street-view/panorama/:panoId
   * Retrieve high-definition 360 panorama by its unique ID.
   */
  async getPanoramaById(req: Request, res: Response): Promise<void> {
    try {
      const panoId = String(req.params.panoId);
      const pano = await streetView360Service.getPanoramaById(panoId);

      if (!pano) {
        sendError(res, 404, `Panorama ${panoId} not found`);
        return;
      }

      sendSuccess({
        res,
        message: `Retrieved panorama ${panoId}`,
        data: pano,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/spatial-vis/street-view/sequence
   * Generate continuous street-level virtual drive tour sequence along path.
   */
  async generateVirtualDriveTour(req: Request, res: Response): Promise<void> {
    try {
      const { routeCoordinates, routeTitle } = req.body;

      if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) {
        sendError(res, 400, 'routeCoordinates array of at least 2 [lon, lat] coordinates required');
        return;
      }

      const tour = streetView360Service.generateVirtualDriveTour(routeCoordinates, routeTitle);
      sendSuccess({
        res,
        message: `Generated virtual drive sequence with ${tour.panoramas.length} street view frames`,
        data: tour,
      });
    } catch (err: any) {
      sendError(res, 400, err.message);
    }
  }

  /**
   * POST /api/v1/spatial-vis/street-view/depth-measure
   * Measure real-world 3D distance and surface elevation from 360 panorama pixel.
   */
  async measureDepthAtPixel(req: Request, res: Response): Promise<void> {
    try {
      const { panoId, pixel } = req.body;

      if (!panoId || !Array.isArray(pixel) || pixel.length !== 2) {
        sendError(res, 400, 'panoId and pixel [x, y] are required');
        return;
      }

      const measurement = streetView360Service.measureDepthAtPixel(panoId, pixel as [number, number]);
      sendSuccess({
        res,
        message: `Measured depth: ${measurement.straightLineDistanceMeters}m to ${measurement.detectedSurfaceType}`,
        data: measurement,
      });
    } catch (err: any) {
      sendError(res, 400, err.message);
    }
  }

  // =========================================================================
  // 8. HIGH-PRECISION INDOOR VIEW (COMMERCIAL, AIRPORTS, TRAIN HUBS)
  // =========================================================================

  /**
   * GET /api/v1/spatial-vis/indoor/facilities
   * Query indoor facilities by category (commercial_complex, international_airport, train_hub) or city.
   */
  async getIndoorFacilities(req: Request, res: Response): Promise<void> {
    try {
      const { category, city } = req.query;
      const facilities = await indoorPrecisionViewService.getFacilities({
        category: category as IndoorFacilityCategory,
        city: city ? String(city) : undefined,
      });

      sendSuccess({
        res,
        message: `Retrieved ${facilities.length} high-precision indoor facilities`,
        data: facilities,
        meta: { count: facilities.length },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/spatial-vis/indoor/facilities/:facilityId
   * Query indoor facility digital twin by ID.
   */
  async getIndoorFacilityById(req: Request, res: Response): Promise<void> {
    try {
      const facilityId = String(req.params.facilityId);
      const facility = await indoorPrecisionViewService.getFacilityById(facilityId);

      if (!facility) {
        sendError(res, 404, `Indoor facility ${facilityId} not found`);
        return;
      }

      sendSuccess({
        res,
        message: `Retrieved facility ${facility.name}`,
        data: facility,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/spatial-vis/indoor/facilities/:facilityId/floors/:floorLevel
   * Query interactive multi-floor plan slice with features and connectors.
   */
  async getIndoorFloorPlan(req: Request, res: Response): Promise<void> {
    try {
      const facilityId = String(req.params.facilityId);
      const floorLevel = parseInt(String(req.params.floorLevel), 10);

      if (isNaN(floorLevel)) {
        sendError(res, 400, 'floorLevel must be an integer');
        return;
      }

      const floorPlan = await indoorPrecisionViewService.getFloorPlan(facilityId, floorLevel);
      if (!floorPlan) {
        sendError(res, 404, `Floor level ${floorLevel} not found in facility ${facilityId}`);
        return;
      }

      sendSuccess({
        res,
        message: `Retrieved floor plan: ${floorPlan.floorName} (${floorPlan.features.length} features)`,
        data: floorPlan,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/spatial-vis/indoor/facilities/:facilityId/route
   * Calculate multi-floor turn-by-turn indoor wayfinding path.
   */
  async calculateIndoorRoute(req: Request, res: Response): Promise<void> {
    try {
      const facilityId = String(req.params.facilityId);
      const { origin, destination, accessibleOnly, avoidCrowdedZones } = req.body;

      if (!origin || !destination || origin.coordinate === undefined || destination.coordinate === undefined) {
        sendError(res, 400, 'origin and destination with floorLevel and coordinate [lon, lat] are required');
        return;
      }

      const routeResult = await indoorPrecisionViewService.calculateIndoorRoute({
        facilityId,
        origin,
        destination,
        accessibleOnly: !!accessibleOnly,
        avoidCrowdedZones: !!avoidCrowdedZones,
      });

      sendSuccess({
        res,
        message: `Calculated indoor route: ${routeResult.totalDistanceMeters}m (${routeResult.steps.length} steps)`,
        data: routeResult,
      });
    } catch (err: any) {
      sendError(res, 400, err.message);
    }
  }

  // =========================================================================
  // 9. 4D DYNAMIC SPACE RENDERING (TEMPORAL + 3D SPACE)
  // =========================================================================

  /**
   * GET /api/v1/spatial-vis/dynamic-4d/scene
   * Query 4D dynamic space state at coordinate and timestamp t.
   */
  async get4DSceneState(req: Request, res: Response): Promise<void> {
    try {
      const { longitude, latitude, radius, timestamp, weather } = req.query;

      if (!longitude || !latitude) {
        sendError(res, 400, 'longitude and latitude are required');
        return;
      }

      const lon = parseFloat(String(longitude));
      const lat = parseFloat(String(latitude));
      const rad = radius ? parseFloat(String(radius)) : 800;
      const ts = timestamp ? parseInt(String(timestamp), 10) : Date.now();
      const weatherOverride = weather as any;

      const sceneState = dynamicSpace4DService.generate4DSceneState([lon, lat], rad, ts, weatherOverride);
      sendSuccess({
        res,
        message: `4D scene rendered at ${sceneState.epochIso} (${sceneState.atmosphere.phase})`,
        data: sceneState,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/spatial-vis/dynamic-4d/time-slider
   * Calculate temporal time-slider interpolation between two capture epochs or timestamps.
   */
  async interpolate4DTimeSlider(req: Request, res: Response): Promise<void> {
    try {
      const { startEpochTimestamp, targetEpochTimestamp, sliderFactor } = req.body;

      if (startEpochTimestamp === undefined || targetEpochTimestamp === undefined || sliderFactor === undefined) {
        sendError(res, 400, 'startEpochTimestamp, targetEpochTimestamp, and sliderFactor (0..1) are required');
        return;
      }

      const result = dynamicSpace4DService.interpolateTemporalSlider(
        Number(startEpochTimestamp),
        Number(targetEpochTimestamp),
        Number(sliderFactor)
      );

      sendSuccess({
        res,
        message: `Interpolated 4D timeline at factor ${result.sliderFactor} (${result.spatialDivergences.length} divergences)`,
        data: result,
      });
    } catch (err: any) {
      sendError(res, 400, err.message);
    }
  }
}

export const spatialVisualizationController = new SpatialVisualizationController();
