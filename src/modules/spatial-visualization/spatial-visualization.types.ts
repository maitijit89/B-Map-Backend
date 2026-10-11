import { Coordinate } from '../../core/types/geo.types';

// ==========================================
// 1. 3D Digital Twin & Building Models
// ==========================================

export type BuildingLodLevel = 'LOD0' | 'LOD1' | 'LOD2' | 'LOD3';
export type RoofShape = 'flat' | 'gabled' | 'hipped' | 'domed' | 'pyramidal' | 'mansard';
export type BuildingFacadeMaterial =
  | 'glass_curtain'
  | 'concrete'
  | 'brick'
  | 'steel_panel'
  | 'stone'
  | 'timber';

export interface BuildingLightingProfile {
  nightGlow: boolean;
  windowEmissiveColor?: string;
  rooftopBeacon?: boolean;
}

export interface Building3DProfile {
  buildingId: string;
  name?: string;
  footprint: Coordinate[]; // GeoJSON Polygon exterior ring: [[lon, lat], ...]
  heightMeters: number;
  minHeightMeters: number;
  levels: number;
  facadeMaterial: BuildingFacadeMaterial;
  facadeColor: string;
  roofShape: RoofShape;
  roofColor: string;
  lod: BuildingLodLevel;
  isLandmark: boolean;
  landmarkModelUri?: string;
  lightingProfile?: BuildingLightingProfile;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
}

// ==========================================
// 2. Vector Tile Pipeline (MVT / Slippy Tiles)
// ==========================================

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface TileBoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type TileLayerType = 'roads' | 'buildings' | 'water' | 'landuse' | 'pois' | 'traffic';

export interface VectorTileLayerData {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id?: string | number;
    geometry: {
      type: string;
      coordinates: any;
    };
    properties: Record<string, any>;
  }>;
}

export interface VectorTilePayload {
  tileCoord: TileCoordinate;
  bbox: TileBoundingBox;
  layers: Record<string, VectorTileLayerData>;
  generatedAt: number;
  featureCount: number;
  byteSize: number;
}

// ==========================================
// 3. Spatio-Temporal Heatmaps & Hex Bins
// ==========================================

export type CongestionState = 'free' | 'moderate' | 'congested' | 'severe';

export interface HexagonBin {
  hexId: string;
  center: Coordinate;
  boundary: Coordinate[]; // 6 vertex coordinates
  densityCount: number;
  avgSpeedKmH?: number;
  congestionLevel: CongestionState;
  normalizedIntensity: number; // 0.0 to 1.0
}

export interface HeatmapDensityFrame {
  timestamp: number;
  bins: HexagonBin[];
  totalSamplePoints: number;
  maxIntensity: number;
  bandwidthMeters: number;
}

export interface KdeDensityContour {
  contourLevel: number; // 0.1 to 1.0
  densityValue: number;
  colorHex: string;
  polygon: Coordinate[];
}

// ==========================================
// 4. Multi-Floor & Sub-Surface 3D Spatial Stacking
// ==========================================

export type FloorLevel = number; // -3 for basement B3, 0 for ground, +5 for 5th floor

export interface MultiFloorSpatialFeature {
  id: string;
  type: 'corridor' | 'room' | 'staircase' | 'elevator' | 'gate' | 'ramp' | 'amenity';
  name: string;
  geometry: {
    type: string;
    coordinates: any;
  };
  properties: Record<string, any>;
}

export interface FloorElevationProfile {
  facilityId: string;
  floorLevel: FloorLevel;
  floorName: string;
  baseElevationMeters: number;
  ceilingHeightMeters: number;
  isUnderground: boolean;
  features: MultiFloorSpatialFeature[];
}

export interface ViaductFlyoverSection {
  sectionId: string;
  corridorName: string;
  tierLevel: number; // 0: ground, 1: deck 1, 2: flyover tier 2
  clearanceHeightMeters: number;
  centerline3D: Array<[number, number, number]>; // [lon, lat, altitudeMeters]
  gradePercentage: number;
  surfaceType: 'concrete_deck' | 'asphalt_surface' | 'steel_truss';
  pillarCoordinates: Coordinate[];
}

// ==========================================
// 5. Environmental Shading & Weather Radar
// ==========================================

export interface SolarPosition {
  elevationDegrees: number; // solar elevation angle above horizon (-90 to +90)
  azimuthDegrees: number; // solar azimuth angle (0=N, 90=E, 180=S, 270=W)
  isDaylight: boolean;
  timestamp: number;
}

export interface BuildingShadowPolygon {
  buildingId: string;
  shadowGeometry: Coordinate[]; // footprint extruded along shadow vector
  shadowLengthMeters: number;
  sunAzimuthDegrees: number;
}

export interface WeatherRadarLayer {
  radarId: string;
  timestamp: number;
  precipitationType: 'rain' | 'snow' | 'hail' | 'none';
  maxDbz: number;
  radarContours: Array<{
    dbzThreshold: number;
    colorHex: string;
    polygon: Coordinate[];
  }>;
}

// ==========================================
// 6. Cinematic Flyover & 3D Camera Path
// ==========================================

export interface CameraPose {
  stepIndex: number;
  position: [number, number, number]; // [lon, lat, altitudeMeters]
  lookAt: [number, number, number]; // [lon, lat, targetAltitudeMeters]
  pitchDegrees: number; // -90 looking straight down, -30 looking forward-down
  bearingDegrees: number; // heading in degrees (0-360)
  fovDegrees: number; // camera field of view, typically 60
  timeOffsetSeconds: number;
}

export interface BillboardScreenAnchor {
  anchorId: string;
  worldPosition: [number, number, number]; // [lon, lat, alt]
  screenCoordinate: [number, number]; // normalized [x, y] in range [0, 1]
  title: string;
  subtitle?: string;
  category: string;
  isVisible: boolean;
}

export interface CinematicFlightPath {
  flightId: string;
  routeName: string;
  totalDurationSeconds: number;
  cameraPoses: CameraPose[];
  billboardAnchors: BillboardScreenAnchor[];
  smoothTransition: boolean;
}

// ==========================================
// 7. 360-Degree High-Definition Street View & Indian Urban Coverage
// ==========================================

export type IndianTierLevel = 'tier1' | 'tier2' | 'tier3';
export type IndianUrbanRegion = 'north' | 'south' | 'west' | 'east' | 'central' | 'northeast';
export type PanoramaResolution = '8K_UHD' | '4K_HD' | '2K_SD';
export type ProjectionType = 'equirectangular' | 'cubemap';

export interface IndianUrbanCenterProfile {
  cityId: string;
  cityName: string;
  state: string;
  region: IndianUrbanRegion;
  tier: IndianTierLevel;
  population: number;
  areaSqKm: number;
  roadNetworkCoveredKm: number;
  panoramasCount: number;
  coveragePercentage: number;
  lastSurveyDate: string;
  fleetVehiclesDeployed: number;
  poiDensityScore: number;
  bounds: [number, number, number, number]; // [west, south, east, north]
  center: Coordinate;
  qualityScore: number; // 0-100
  hasLiDARDepth: boolean;
  highPrecisionIndoorSitesCount: number;
}

export interface CoverageAnalyticsReport {
  totalUrbanCentersTracked: number;
  coveredUrbanCentersCount: number;
  nationalUrbanCoveragePercentage: number;
  tier1CoveragePercentage: number;
  tier2CoveragePercentage: number;
  tier3CoveragePercentage: number;
  totalRoadKmCaptured: number;
  totalPanoramasAvailable: number;
  activeCameraFleetSize: number;
  complianceStandard: string;
  privacyBlurringCompliance: number;
  regions: Record<IndianUrbanRegion, { centersCount: number; avgCoveragePct: number; totalKm: number }>;
}

export interface PanoramaDepthMap {
  format: 'lidar_radial_depth' | 'photogrammetry_dense';
  width: number;
  height: number;
  minDistanceMeters: number;
  maxDistanceMeters: number;
  depthBufferCompressed: string;
  groundPlaneEstimated: {
    normal: [number, number, number];
    heightMeters: number;
  };
}

export interface PanoramaHotspotLink {
  targetPanoId: string;
  targetCoordinate: Coordinate;
  yawDegrees: number;
  pitchDegrees: number;
  distanceMeters: number;
  roadName: string;
  actionType: 'forward' | 'backward' | 'turn_left' | 'turn_right' | 'u_turn' | 'fork';
}

export interface SemanticARStreetOverlay {
  overlayId: string;
  category: 'storefront' | 'metro_pillar' | 'traffic_sign' | 'road_marking' | 'landmark' | 'transit_stop';
  title: string;
  subtitle?: string;
  worldCoordinate: [number, number, number];
  panoYaw: number;
  panoPitch: number;
  distanceMeters: number;
  iconName: string;
  metadata: Record<string, any>;
}

export interface StreetLevel360Panorama {
  panoId: string;
  cityId: string;
  cityName: string;
  location: Coordinate;
  altitudeMeters: number;
  cameraHeightMeters: number;
  headingDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
  fovDegrees: number;
  resolution: PanoramaResolution;
  equirectangularImageUrl: string;
  cubemapFacesUrl?: {
    front: string;
    back: string;
    left: string;
    right: string;
    top: string;
    bottom: string;
  };
  tilePyramidBaseUrl?: string;
  depthMap?: PanoramaDepthMap;
  hotspots: PanoramaHotspotLink[];
  arOverlays: SemanticARStreetOverlay[];
  captureTimestamp: number;
  historicalEpoch: string;
  roadClass: 'national_highway' | 'state_highway' | 'arterial_ring_road' | 'inner_urban' | 'commercial_boulevard' | 'residential_lane';
  privacyAnonymized: {
    facesBlurred: number;
    licensePlatesBlurred: number;
    complianceVerified: boolean;
  };
}

export interface StreetViewTourSequence {
  sequenceId: string;
  routeTitle: string;
  cityId: string;
  totalDistanceMeters: number;
  panoramas: StreetLevel360Panorama[];
  smoothTransitionDurationMs: number;
  suggestedHeadingSteps: Array<{
    panoId: string;
    targetHeading: number;
    recommendedPitch: number;
  }>;
}

export interface DepthMeasurementResult {
  panoId: string;
  sourcePixel: [number, number];
  estimatedTargetCoord3D: [number, number, number];
  straightLineDistanceMeters: number;
  horizontalDistanceMeters: number;
  verticalHeightOffsetMeters: number;
  detectedSurfaceType: 'building_facade' | 'road_surface' | 'sidewalk' | 'overhead_bridge' | 'vegetation';
}

// ==========================================
// 8. High-Precision Indoor View (Commercial, Airports, Train Hubs)
// ==========================================

export type IndoorFacilityCategory =
  | 'commercial_complex'
  | 'international_airport'
  | 'train_hub'
  | 'metro_interchange';

export type IndoorZoneType =
  // Commercial
  | 'retail_store'
  | 'food_court'
  | 'office_lobby'
  | 'corporate_suite'
  | 'atrium'
  | 'conference_center'
  | 'parking_bay'
  | 'cinema'
  // Airport
  | 'digiyatra_gate'
  | 'checkin_counter'
  | 'security_checkpoint'
  | 'immigration_counter'
  | 'boarding_gate'
  | 'baggage_carousel'
  | 'duty_free'
  | 'airline_lounge'
  | 'aerotrain_station'
  // Train Hub
  | 'train_platform'
  | 'rail_concourse'
  | 'foot_overbridge'
  | 'ticket_counter'
  | 'irctc_lounge'
  | 'cloakroom'
  | 'metro_transfer_gate'
  | 'auto_taxi_stand'
  // General Core
  | 'elevator'
  | 'escalator'
  | 'staircase'
  | 'restroom'
  | 'atm'
  | 'information_desk'
  | 'emergency_exit'
  | 'corridor';

export interface IndoorVerticalConnector {
  connectorId: string;
  type: 'elevator' | 'escalator' | 'staircase' | 'ramp';
  connectedLevels: number[];
  isWheelchairAccessible: boolean;
  isBidirectional: boolean;
  operationalStatus: 'active' | 'maintenance' | 'closed';
  transitTimeSecondsPerFloor: number;
  coordinate: Coordinate;
}

export interface IndoorMapFeature {
  featureId: string;
  name: string;
  zoneType: IndoorZoneType;
  floorLevel: number;
  polygon: Coordinate[];
  centerPoint: Coordinate;
  icon: string;
  tags: string[];
  properties: Record<string, any>;
}

export interface IndoorNavNode {
  nodeId: string;
  coordinate: Coordinate;
  floorLevel: number;
  nodeType: 'waypoint' | 'connector' | 'poi' | 'gate' | 'platform';
  adjacentNodeIds: string[];
}

export interface IndoorFloorPlan {
  floorLevel: number;
  floorName: string;
  altitudeOffsetMeters: number;
  ceilingHeightMeters: number;
  boundary: Coordinate[];
  features: IndoorMapFeature[];
  connectors: IndoorVerticalConnector[];
  navGraphNodes: IndoorNavNode[];
}

export interface IndoorHighPrecisionFacility {
  facilityId: string;
  name: string;
  city: string;
  state: string;
  category: IndoorFacilityCategory;
  center: Coordinate;
  boundary: Coordinate[];
  defaultFloorLevel: number;
  floorLevels: number[];
  floors: IndoorFloorPlan[];
  totalAreaSqMeters: number;
  isLiveOccupancyTracked: boolean;
  indoorBeaconProtocol: 'ble_ibeacon' | 'wifi_rtt' | 'geomagnetic_slam' | 'uwb';
  verticalConnectors: IndoorVerticalConnector[];
}

export interface IndoorRouteRequest {
  facilityId: string;
  origin: { floorLevel: number; coordinate: Coordinate; featureId?: string };
  destination: { floorLevel: number; coordinate: Coordinate; featureId?: string };
  accessibleOnly?: boolean;
  avoidCrowdedZones?: boolean;
}

export interface IndoorRouteStep {
  stepIndex: number;
  floorLevel: number;
  instruction: string;
  action: 'straight' | 'turn_left' | 'turn_right' | 'take_elevator' | 'take_escalator' | 'take_stairs' | 'arrive';
  distanceMeters: number;
  durationSeconds: number;
  pathCoordinates: Coordinate[];
  connectorDetails?: {
    connectorType: 'elevator' | 'escalator' | 'staircase' | 'ramp';
    fromFloor: number;
    toFloor: number;
  };
}

export interface IndoorRouteResult {
  routeId: string;
  facilityId: string;
  facilityName: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  steps: IndoorRouteStep[];
  floorsTraversed: number[];
  accessibleMode: boolean;
  estimatedSecurityWaitSeconds?: number;
  path3D: Array<[number, number, number]>;
}

// ==========================================
// 9. 4D Dynamic Space Rendering (Temporal + 3D Space)
// ==========================================

export type TimeOfDayPhase =
  | 'dawn'
  | 'morning_peak'
  | 'midday'
  | 'afternoon'
  | 'golden_hour'
  | 'twilight'
  | 'night_urban';

export interface Dynamic4DAtmosphericState {
  timestamp: number;
  phase: TimeOfDayPhase;
  sunElevation: number;
  sunAzimuth: number;
  ambientColorHex: string;
  skyboxHdri: string;
  precipitation: 'none' | 'monsoon_rain' | 'delhi_winter_fog' | 'summer_heat_haze';
  visibilityMeters: number;
  roadWetnessFactor: number;
  streetLightingIntensity: number;
}

export interface Dynamic4DEntity {
  entityId: string;
  type: 'vehicle_stream' | 'pedestrian_swarm' | 'dynamic_hazard' | 'transit_vehicle' | 'construction_crane';
  currentPosition: [number, number, number];
  velocityVector: [number, number, number];
  densityFactor: number;
}

export interface Dynamic4DSceneState {
  sceneId: string;
  timestamp: number;
  epochIso: string;
  center: Coordinate;
  radiusMeters: number;
  atmosphere: Dynamic4DAtmosphericState;
  dynamicEntities: Dynamic4DEntity[];
  occupancyHeatFactor: number;
  interpolatedPanoramasCount: number;
  buildingGlowProfiles: Array<{ buildingId: string; emissiveMultiplier: number }>;
}

export interface Dynamic4DTimeSliderInterpolation {
  startEpochTimestamp: number;
  targetEpochTimestamp: number;
  interpolatedTimestamp: number;
  sliderFactor: number; // 0.0 to 1.0
  blendedAtmosphere: Dynamic4DAtmosphericState;
  spatialDivergences: Array<{
    areaName: string;
    description: string; // e.g. "New Flyover Expansion completed between 2024 and 2026"
    divergenceType: 'infrastructure_addition' | 'lane_widening' | 'commercial_tower_erection';
    coordinate: Coordinate;
  }>;
}

