/**
 * ============================================================================
 *              B-MAP SOVEREIGN GEOSPATIAL & TELEMATICS ENGINES
 * ============================================================================
 * Centralized registry and gateway for all core mathematical, geospatial,
 * telematics, and cryptographic engines across the B-Map platform.
 */

// 1. Unified Underlying Navigation Engine
export {
  unifiedUnderlyingEngineService,
  UnifiedUnderlyingEngineService,
} from '../../modules/unified-engine/unified-underlying-engine.service';

// 2. High-Precision Positioning & EKF Sensor Fusion Engine
export {
  positioningEngineService,
  PositioningEngineService,
} from '../../modules/positioning/positioning-engine.service';

// 3. Dynamic Rerouting & Off-Route Engine
export {
  offRouteEngineService,
  OffRouteEngineService,
  RerouteState,
  RerouteEvaluationResult,
} from '../../modules/navigation/off-route-engine.service';

// 4. Macroscopic LWR Traffic Shockwave & Spillback Estimator Engine
export {
  trafficShockwaveService as trafficShockwaveEngineService,
  TrafficShockwaveService,
  ShockwaveAnalysisResult,
} from '../../modules/traffic/traffic-shockwave.service';

// 5. Physics-Based Vehicle Eco-Routing & Emissions Engine
export {
  ecoRoutingService as ecoRoutingEngineService,
  EcoRoutingService,
  VehicleEnergyProfile,
  SegmentEnergyConsumption,
  EcoRouteComparison,
} from '../../modules/traffic/eco-routing.service';

// 6. DigiPIN 4m x 4m National Hierarchical Micro-Grid Engine
export {
  digipinService as digiPINEngineService,
  DIGIPINService,
} from '../../modules/digipin/digipin.service';

// 7. NHAI FASTag Dynamic Electronic Toll Collection Engine
export {
  tollService as fastagTollEngineService,
  TollService,
} from '../../modules/tolls/tolls.service';

// 8. 6-Digit Indian Postal Pincode & Landmark Parsing Engine
export {
  pincodeService as pinCodeEngineService,
  PINCodeService,
} from '../../modules/pincode/pincode.service';

// 9. Enterprise Geofence & Real-Time Push Orchestration Engine
export {
  geofenceEngineService,
  GeofenceEngineService,
} from '../../modules/notifications/geofence-engine.service';

// 10. IMD Highway Weather & Winter Fog Hazard Engine
export {
  weatherService as highwayWeatherEngineService,
  WeatherService,
} from '../../modules/weather/weather.service';

// 11. Defense Obfuscation & Planar Differential Privacy Engine
export {
  obfuscationService as defenseObfuscationEngineService,
  ObfuscationService,
} from '../../modules/obfuscation/obfuscation.service';

// 12. Vernacular 12-Language Turn-by-Turn Maneuver Voice Engine
export {
  vernacularService as vernacularEngineService,
  VernacularService,
} from '../../modules/vernacular/vernacular.service';

// 13. ISRO NavIC Dual-Band L5/S & GAGAN Ionospheric Engine
export {
  navicService as navicEngineService,
  NavICService,
} from '../../modules/navic/navic.service';

// 14. Traveling Salesperson (TSP) 2-Opt Multi-Stop Route Optimization Engine
export {
  tspOptimizationEngineService,
  TspOptimizationEngineService,
  TspOptimizationOptions,
  TspOptimizationResult,
  OptimizedWaypoint,
} from '../../modules/routes/tsp-optimization-engine.service';

// 15. Zero-Trust Kinematic Anti-GPS Spoofing, Replay Immunity & Crypto Engine
export {
  zeroTrustSecurityEngineService,
  ZeroTrustSecurityEngineService,
  ZeroTrustVerificationResult,
  TelemetrySignaturePayload,
} from '../security/zero-trust-engine.service';

// 16. Dynamic Directed Traffic Graph & Congestion Re-Weighting Engine
export {
  trafficGraphEngineService,
  trafficGraphService,
  TrafficGraphService,
} from '../../modules/traffic/traffic-graph.service';

// 17. Crowdsourced Telemetry Ingestion & Map-Matching Engine
export {
  crowdsourcedTelemetryEngineService,
  crowdsourcedTelemetryService,
  CrowdsourcedTelemetryService,
} from '../../modules/traffic/crowdsourced-telemetry.service';

// 18. DBSCAN Spatial Anomaly & Road Incident Clustering Engine
export {
  dbscanAnomalyClusteringEngineService,
  trafficAnomalyClusteringService,
  TrafficAnomalyClusteringService,
} from '../../modules/traffic/traffic-anomaly-clustering.service';

// 19. Lane-Level Routing & Micro-Navigation Guidance Engine
export {
  laneGuidanceEngineService,
  laneRoutingService,
  LaneRoutingService,
} from '../../modules/lane-routing/lane-routing.service';

// 20. High-Precision Parking Space & Multi-Floor Navigation Engine
export {
  parkingNavigationEngineService,
  parkingSpaceNavigationService,
  ParkingSpaceNavigationService,
} from '../../modules/parking/parking-space-navigation.service';

// 21. Sub-Meter Super-Resolution (SR) Lane-Offset Navigation Engine
export {
  srNavigationEngineService,
  srNavigationService,
  SRNavigationService,
} from '../../modules/sr-navigation/sr-navigation.service';

// 22. Augmented Reality Walk & Micro-Mobility Cycle Engine
export {
  arWalkCycleEngineService,
  arWalkCycleService,
  ARWalkCycleService,
} from '../../modules/ar-walk-cycle/ar-walk-cycle.service';

// 23. Automotive In-Vehicle Infotainment (IVI) & CAN-Bus ADAS Engine
export {
  automotiveEcosystemEngineService,
  automotiveEcosystemService,
  AutomotiveEcosystemService,
} from '../../modules/automotive/automotive-ecosystem.service';

// 24. Two-Wheeler Rider Mode & Autonomous Crash Detection Engine
export {
  riderModeEngineService,
  riderModeService,
  RiderModeService,
} from '../../modules/rider-mode/rider-mode.service';

// 25. V2X Cooperative Collision & Green Light Optimal Speed Advisory (GLOSA) Engine
export {
  v2xEngineService,
  v2xService,
  V2XService,
} from '../../modules/v2x/v2x.service';

// 26. Multimodal Transit Fare Estimation & Fare Matrix Engine
export {
  fareEstimationEngineService,
  fareService,
  FareService,
} from '../../modules/fares/fares.service';

// 27. EV Charging Network & Dynamic Range Optimization Engine
export {
  evChargingEngineService,
  evService,
  EVService,
} from '../../modules/evcharging/evcharging.service';

// 28. BLE Indoor Micro-Beacon & Multi-Floor Trilateration Engine
export {
  indoorBeaconEngineService,
  indoorBeaconMappingService,
  IndoorBeaconMappingService,
} from '../../modules/nearby-devices/indoor-beacon-mapping.service';

// 29. Sovereign Multimodal Public Transit Itinerary Engine
export {
  publicTransitEngineService,
  publicTransitService,
  PublicTransitService,
} from '../../modules/public-transit/public-transit.service';

// 30. Emergency Green-Corridor & Autonomous Priority Dispatch Engine
export {
  emergencyDispatchEngineService,
  emergencyService,
  EmergencyService,
} from '../../modules/emergency/emergency.service';

// 31. In-Vehicle Car Navigation, Speed Trap & ADAS Camera Engine
export {
  carNavigationEngineService,
  carNavigationService,
  CarNavigationService,
} from '../../modules/car-navigation/car-navigation.service';

// 32. Core Kinematic Motion Modeling & Extended Kalman Filter (EKF)
export {
  ExtendedKalmanFilter,
  EkfState,
  EkfFilteredMeasurement,
} from '../algorithms/extended-kalman-filter';

