import { Router } from 'express';
import aiCopilotRoutes from '../modules/ai-copilot/ai-copilot.routes';
import aiDataMiningRoutes from '../modules/ai-data-mining/ai-data-mining.routes';
import arWalkCycleRoutes from '../modules/ar-walk-cycle/ar-walk-cycle.routes';
import authRoutes from '../modules/auth/auth.routes';
import automotiveRoutes from '../modules/automotive/automotive.routes';
import carNavigationRoutes from '../modules/car-navigation/car-navigation.routes';
import healthRoutes from '../modules/health/health.routes';
import laneRoutingRoutes from '../modules/lane-routing/lane-routing.routes';
import navigationRoutes from '../modules/navigation/navigation.routes';
import parkingNavigationRoutes from '../modules/parking/parking-navigation.routes';
import placeRoutes from '../modules/places/place.routes';
import positioningRoutes from '../modules/positioning/positioning.routes';
import publicTransitRoutes from '../modules/public-transit/public-transit.routes';
import riderModeRoutes from '../modules/rider-mode/rider-mode.routes';
import routeRoutes from '../modules/routes/route.routes';
import spatialVisualizationRoutes from '../modules/spatial-visualization/spatial-visualization.routes';
import srNavigationRoutes from '../modules/sr-navigation/sr-navigation.routes';
import superAppRoutes from '../modules/super-app/super-app.routes';
import locationAccessRoutes from '../modules/location-access/location-access.routes';
import motionFitnessRoutes from '../modules/motion-fitness/motion-fitness.routes';
import notificationRoutes from '../modules/notifications/notification.routes';
import nearbyDevicesRoutes from '../modules/nearby-devices/nearby-devices.routes';
import trackingRoutes from '../modules/tracking/tracking.routes';
import unifiedEngineRoutes from '../modules/unified-engine/unified-engine.routes';

// Restored domain & infrastructure modules
import navicRoutes from '../modules/navic/navic.routes';
import tollRoutes from '../modules/tolls/tolls.routes';
import pincodeRoutes from '../modules/pincode/pincode.routes';
import digipinRoutes from '../modules/digipin/digipin.routes';
import emergencyRoutes from '../modules/emergency/emergency.routes';
import environmentRoutes from '../modules/environment/environment.routes';
import weatherRoutes from '../modules/weather/weather.routes';
import hazardRoutes from '../modules/hazards/hazards.routes';
import vernacularRoutes from '../modules/vernacular/vernacular.routes';
import v2xRoutes from '../modules/v2x/v2x.routes';
import obfuscationRoutes from '../modules/obfuscation/obfuscation.routes';
import boundaryRoutes from '../modules/boundaries/boundaries.routes';
import evChargingRoutes from '../modules/evcharging/evcharging.routes';
import fareRoutes from '../modules/fares/fares.routes';
import roadsRoutes from '../modules/roads/roads.routes';
import { mapsRouter, tilesRouter } from '../modules/maps-tiles/maps-tiles.routes';
import fleetRoutes from '../modules/fleet/fleet.routes';
import timezoneRoutes from '../modules/timezone/timezone.routes';
import ratingRoutes from '../modules/ratings/ratings.routes';
import adminRoutes from '../modules/admin/admin.routes';

const router = Router();

// Health check
router.use('/health', healthRoutes);

// Authentication & Identity (Name, Age, Email, Number, Email OTP, JWT)
router.use('/auth', authRoutes);

// Core B-Map Navigation & Data Mining Modules
router.use('/routes', routeRoutes);
router.use('/places', placeRoutes);
router.use('/navigation', navigationRoutes);
router.use('/tracking', trackingRoutes);
router.use('/location', locationAccessRoutes);
router.use('/motion', motionFitnessRoutes);
router.use('/notifications', notificationRoutes);
router.use('/nearby-devices', nearbyDevicesRoutes);
router.use('/bluetooth', nearbyDevicesRoutes);
router.use('/positioning', positioningRoutes);
router.use('/lane-routing', laneRoutingRoutes);
router.use('/unified', unifiedEngineRoutes);
router.use('/data-mining', aiDataMiningRoutes);

// Next-Gen Intelligent Driving & Lane-Level Navigation
router.use('/sr-navigation', srNavigationRoutes);
router.use('/automotive', automotiveRoutes);
router.use('/rider-mode', riderModeRoutes);
router.use('/parking', parkingNavigationRoutes);

// Multi-Mode Core Navigation & Routing
router.use('/car-nav', carNavigationRoutes);
router.use('/transit', publicTransitRoutes);
router.use('/ar-walk-cycle', arWalkCycleRoutes);

// Comprehensive AI & Large Language Model (LLM) Features
router.use('/ai-copilot', aiCopilotRoutes);

// Advanced Visualization & Spatial Mapping
router.use('/spatial-vis', spatialVisualizationRoutes);

// Unified Lifestyle & Commercial Super-App Ecosystem
router.use('/super-app', superAppRoutes);

// Indian Sovereign Navigation & Specialized Geospatial Modules
router.use('/navic', navicRoutes);
router.use('/tolls', tollRoutes);
router.use('/pincode', pincodeRoutes);
router.use('/digipin', digipinRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/environment', environmentRoutes);
router.use('/weather', weatherRoutes);
router.use('/hazards', hazardRoutes);
router.use('/vernacular', vernacularRoutes);
router.use('/v2x', v2xRoutes);
router.use('/obfuscation', obfuscationRoutes);
router.use('/boundaries', boundaryRoutes);
router.use('/ev', evChargingRoutes);
router.use('/fares', fareRoutes);
router.use('/roads', roadsRoutes);
router.use('/maps', mapsRouter);
router.use('/tiles', tilesRouter);
router.use('/fleet', fleetRoutes);
router.use('/timezone', timezoneRoutes);
router.use('/ratings', ratingRoutes);
router.use('/admin', adminRoutes);

export default router;
