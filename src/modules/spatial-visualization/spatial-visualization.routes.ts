import { Router } from 'express';
import { spatialVisualizationController } from './spatial-visualization.controller';

const router = Router();

// 3D Digital Twin Buildings
router.get('/buildings/3d', (req, res) => spatialVisualizationController.get3DBuildings(req, res));

// Vector Tile Slippy Map Endpoint
router.get('/tiles/:z/:x/:y', (req, res) => spatialVisualizationController.getVectorTile(req, res));

// Spatio-Temporal Hexagonal Density Heatmaps
router.post('/heatmaps/hexagonal', (req, res) => spatialVisualizationController.generateHexHeatmap(req, res));

// Multi-Floor & Sub-surface Stacking
router.get('/multi-floor/viaducts', (req, res) => spatialVisualizationController.getViaductSections(req, res));
router.get('/multi-floor/:facilityId', (req, res) => spatialVisualizationController.getMultiFloorStack(req, res));

// Environmental Solar Shading & Weather Radar
router.get('/environmental/solar-shadows', (req, res) => spatialVisualizationController.getSolarShadows(req, res));
router.get('/environmental/weather-radar', (req, res) => spatialVisualizationController.getWeatherRadar(req, res));

// Cinematic Camera Flight Path & Billboard Projections
router.post('/camera/flight-path', (req, res) => spatialVisualizationController.generateCameraFlyover(req, res));

// ==========================================
// 7. 360-Degree Street-Level View & Indian Urban Coverage
// ==========================================
router.get('/street-view/coverage', (req, res) => spatialVisualizationController.getIndianCoverageAnalytics(req, res));
router.get('/street-view/cities', (req, res) => spatialVisualizationController.getUrbanCenters(req, res));
router.get('/street-view/nearest', (req, res) => spatialVisualizationController.getNearestPanorama(req, res));
router.get('/street-view/panorama/:panoId', (req, res) => spatialVisualizationController.getPanoramaById(req, res));
router.post('/street-view/sequence', (req, res) => spatialVisualizationController.generateVirtualDriveTour(req, res));
router.post('/street-view/depth-measure', (req, res) => spatialVisualizationController.measureDepthAtPixel(req, res));

// ==========================================
// 8. High-Precision Indoor View (Commercial, Airports, Train Hubs)
// ==========================================
router.get('/indoor/facilities', (req, res) => spatialVisualizationController.getIndoorFacilities(req, res));
router.get('/indoor/facilities/:facilityId', (req, res) => spatialVisualizationController.getIndoorFacilityById(req, res));
router.get('/indoor/facilities/:facilityId/floors/:floorLevel', (req, res) => spatialVisualizationController.getIndoorFloorPlan(req, res));
router.post('/indoor/facilities/:facilityId/route', (req, res) => spatialVisualizationController.calculateIndoorRoute(req, res));

// ==========================================
// 9. 4D Dynamic Space Rendering (Temporal + 3D Space)
// ==========================================
router.get('/dynamic-4d/scene', (req, res) => spatialVisualizationController.get4DSceneState(req, res));
router.post('/dynamic-4d/time-slider', (req, res) => spatialVisualizationController.interpolate4DTimeSlider(req, res));

export default router;
