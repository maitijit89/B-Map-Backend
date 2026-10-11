import { Router } from 'express';
import { superAppController } from './super-app.controller';

const router = Router();

// ==========================================
// 1. ALL-IN-ONE RIDE-HAILING ENDPOINTS
// ==========================================
router.post('/rides/quote', (req, res) => superAppController.getFareQuotes(req, res));
router.get('/rides/drivers/nearby', (req, res) => superAppController.getNearbyDrivers(req, res));
router.post('/rides/request', (req, res) => superAppController.requestRide(req, res));
router.get('/rides/:bookingId', (req, res) => superAppController.getRideBooking(req, res));
router.post('/rides/:bookingId/verify-otp', (req, res) => superAppController.verifyOtpAndStartRide(req, res));
router.post('/rides/:bookingId/complete', (req, res) => superAppController.completeRide(req, res));
router.post('/rides/:bookingId/cancel', (req, res) => superAppController.cancelRide(req, res));

// ==========================================
// 2. POI DISCOVERY & LIFESTYLE BOOKING ENDPOINTS
// ==========================================
router.get('/lifestyle/places', (req, res) => superAppController.searchLifestylePois(req, res));
router.get('/lifestyle/places/:poiId', (req, res) => superAppController.getLifestylePoiById(req, res));
router.post('/lifestyle/book', (req, res) => superAppController.createLifestyleBooking(req, res));
router.get('/lifestyle/bookings/:bookingId', (req, res) => superAppController.getLifestyleBookingById(req, res));
router.post('/lifestyle/bookings/:bookingId/cancel', (req, res) => superAppController.cancelLifestyleBooking(req, res));

// ==========================================
// 3. OFFLINE MAPS UTILITIES ENDPOINTS
// ==========================================
router.get('/offline/bundles', (req, res) => superAppController.getOfflineBundles(req, res));
router.get('/offline/bundles/:bundleId', (req, res) => superAppController.getOfflineBundleById(req, res));
router.get('/offline/bundles/:bundleId/delta', (req, res) => superAppController.getDifferentialDeltaPatch(req, res));
router.post('/offline/route-fallback', (req, res) => superAppController.calculateOfflineFallbackRoute(req, res));
router.get('/offline/storage-quota', (req, res) => superAppController.getStorageQuotaReport(req, res));

export default router;
