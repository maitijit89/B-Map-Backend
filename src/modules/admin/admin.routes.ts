import { Router } from 'express';
import { authenticateUser, requireAdmin } from '../auth/auth.middleware';
import { adminController } from './admin.controller';

const router = Router();

// 1. Interactive Admin Web Dashboard UI (Accessible via browser, tokens passed via UI/query)
router.get('/dashboard', (req, res) => adminController.getDashboard(req, res));

// 2. Protect all API endpoints with Authentication and Admin Authorization
router.use(authenticateUser as any);
router.use(requireAdmin as any);

// ==========================================
// METRICS & EXECUTIVE ANALYTICS
// ==========================================
router.get('/overview', (req, res) => adminController.getOverview(req, res));
router.get('/analytics/users', (req, res) => adminController.getUserAnalytics(req, res));
router.get('/analytics/feature-usage', (req, res) => adminController.getFeatureUsage(req, res));

// ==========================================
// USER DIRECTORY & ACCESS CONTROL
// ==========================================
router.get('/users/stats', (req, res) => adminController.getUserStats(req, res));
router.get('/users/active', (req, res) => adminController.getActiveUsers(req, res));
router.get('/users', (req, res) => adminController.listUsers(req, res));
router.post('/users', (req, res) => adminController.createUser(req, res));
router.get('/users/:id', (req, res) => adminController.getUserById(req, res));
router.patch('/users/:id', (req, res) => adminController.updateUser(req, res));
router.delete('/users/:id', (req, res) => adminController.deleteUser(req, res));

// ==========================================
// SYSTEM HEALTH, CACHE & INFRASTRUCTURE
// ==========================================
router.get('/system/health', (req, res) => adminController.getSystemHealth(req, res));
router.get('/system/cache', (req, res) => adminController.getCacheStats(req, res));
router.post('/system/cache/flush', (req, res) => adminController.flushCache(req, res));

// ==========================================
// SOVEREIGN FEATURE FLAGS & SYSTEM CONFIG
// ==========================================
router.get('/system/config', (req, res) => adminController.getSystemConfig(req, res));
router.patch('/system/config', (req, res) => adminController.updateSystemConfig(req, res));

// ==========================================
// TRAFFIC CONGESTION & INCIDENT OVERRIDES
// ==========================================
router.get('/traffic/overrides', (req, res) => adminController.getTrafficOverrides(req, res));
router.post('/traffic/override', (req, res) => adminController.setTrafficOverride(req, res));
router.delete('/traffic/override/:id', (req, res) => adminController.deleteTrafficOverride(req, res));

// ==========================================
// HIGHWAY WEATHER & IMD FOG ADVISORIES
// ==========================================
router.get('/weather/overrides', (req, res) => adminController.getWeatherOverrides(req, res));
router.post('/weather/override', (req, res) => adminController.setWeatherOverride(req, res));
router.delete('/weather/override/:name', (req, res) => adminController.deleteWeatherOverride(req, res));

// ==========================================
// ROAD HAZARD MODERATION
// ==========================================
router.get('/hazards', (req, res) => adminController.listHazards(req, res));
router.post('/hazards', (req, res) => adminController.createHazard(req, res));
router.patch('/hazards/:id/verify', (req, res) => adminController.verifyHazard(req, res));
router.delete('/hazards/:id', (req, res) => adminController.deleteHazard(req, res));

// ==========================================
// TOLL PLAZAS & FASTAG REGISTRY
// ==========================================
router.get('/tolls', (req, res) => adminController.listTolls(req, res));
router.post('/tolls', (req, res) => adminController.createToll(req, res));
router.patch('/tolls/:id', (req, res) => adminController.updateToll(req, res));
router.delete('/tolls/:id', (req, res) => adminController.deleteToll(req, res));

// ==========================================
// MASTER POINTS OF INTEREST (POIs)
// ==========================================
router.get('/places', (req, res) => adminController.listPlaces(req, res));
router.post('/places', (req, res) => adminController.createPlace(req, res));
router.delete('/places/:id', (req, res) => adminController.deletePlace(req, res));

// ==========================================
// HIGHWAY EMERGENCY SOS DISPATCH
// ==========================================
router.get('/emergency/incidents', (req, res) => adminController.listSOSIncidents(req, res));
router.patch('/emergency/incidents/:id', (req, res) => adminController.updateSOSIncident(req, res));

// ==========================================
// RATINGS & FEEDBACK MODERATION
// ==========================================
router.get('/ratings', (req, res) => adminController.getRatings(req, res));
router.delete('/ratings/:id', (req, res) => adminController.deleteRating(req, res));

// ==========================================
// ADMINISTRATIVE AUDIT TRAIL
// ==========================================
router.get('/audit-logs', (req, res) => adminController.listAuditLogs(req, res));

export default router;
