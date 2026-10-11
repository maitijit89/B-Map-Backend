import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { lifestyleDiscoveryService } from './lifestyle-discovery.service';
import { offlineMapsService } from './offline-maps.service';
import { rideHailingService } from './ride-hailing.service';
import {
  LifestyleBookingType,
  LifestylePoiCategory,
  RideVehicleCategory,
} from './super-app.types';

export class SuperAppController {
  // =========================================================================
  // 1. ALL-IN-ONE RIDE-HAILING ENDPOINTS
  // =========================================================================

  /**
   * POST /api/v1/super-app/rides/quote
   * Calculate multi-modal fare quotes across Auto, Bike Taxi, Mini, Prime Sedan, EV Green, SUV.
   */
  async getFareQuotes(req: Request, res: Response): Promise<void> {
    try {
      const { pickup, dropoff, surgeMultiplier } = req.body;

      if (!Array.isArray(pickup) || !Array.isArray(dropoff) || pickup.length !== 2 || dropoff.length !== 2) {
        sendError(res, 400, 'pickup and dropoff coordinates [lon, lat] are required');
        return;
      }

      const quotes = rideHailingService.calculateFareQuotes(
        pickup as [number, number],
        dropoff as [number, number],
        surgeMultiplier ? Number(surgeMultiplier) : 1.0
      );

      sendSuccess({
        res,
        message: `Calculated ${quotes.length} vehicle category quotes`,
        data: quotes,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/super-app/rides/drivers/nearby
   * Find available drivers near pickup location.
   */
  async getNearbyDrivers(req: Request, res: Response): Promise<void> {
    try {
      const { longitude, latitude, category, radius } = req.query;

      if (!longitude || !latitude) {
        sendError(res, 400, 'longitude and latitude are required');
        return;
      }

      const lon = parseFloat(String(longitude));
      const lat = parseFloat(String(latitude));
      const cat = category as RideVehicleCategory | undefined;
      const rad = radius ? parseFloat(String(radius)) : 3000;

      const drivers = rideHailingService.findNearbyDrivers([lon, lat], cat, rad);
      sendSuccess({
        res,
        message: `Found ${drivers.length} nearby drivers`,
        data: drivers,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/super-app/rides/request
   * Request a new ride, match driver, and generate security OTP.
   */
  async requestRide(req: Request, res: Response): Promise<void> {
    try {
      const {
        riderId,
        riderName,
        riderPhone,
        category,
        pickupLocation,
        pickupAddress,
        dropoffLocation,
        dropoffAddress,
        paymentMethod,
        surgeMultiplier,
      } = req.body;

      if (!riderId || !category || !pickupLocation || !dropoffLocation) {
        sendError(res, 400, 'riderId, category, pickupLocation, and dropoffLocation are required');
        return;
      }

      const booking = rideHailingService.requestRide({
        riderId: String(riderId),
        riderName: riderName ? String(riderName) : 'Valued Rider',
        riderPhone: riderPhone ? String(riderPhone) : '+91 98765 43210',
        category: category as RideVehicleCategory,
        pickupLocation: pickupLocation as [number, number],
        pickupAddress: pickupAddress ? String(pickupAddress) : 'Pickup Point',
        dropoffLocation: dropoffLocation as [number, number],
        dropoffAddress: dropoffAddress ? String(dropoffAddress) : 'Destination Point',
        paymentMethod,
        surgeMultiplier: surgeMultiplier ? Number(surgeMultiplier) : 1.0,
      });

      sendSuccess({
        res,
        message: `Ride booked: Driver ${booking.assignedDriver?.name} assigned. Start OTP: ${booking.otpStartTrip}`,
        data: booking,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/super-app/rides/:bookingId
   * Retrieve active ride booking details.
   */
  async getRideBooking(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = String(req.params.bookingId);
      const booking = rideHailingService.getBooking(bookingId);

      if (!booking) {
        sendError(res, 404, `Booking ${bookingId} not found`);
        return;
      }

      sendSuccess({ res, data: booking });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/super-app/rides/:bookingId/verify-otp
   * Verify 4-digit ride OTP and start trip.
   */
  async verifyOtpAndStartRide(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = String(req.params.bookingId);
      const { otp } = req.body;

      if (!otp) {
        sendError(res, 400, '4-digit otp is required');
        return;
      }

      const result = rideHailingService.verifyOtpAndStartRide(bookingId, String(otp));
      if (!result.success) {
        sendError(res, 400, result.message);
        return;
      }

      sendSuccess({
        res,
        message: result.message,
        data: result.booking,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/super-app/rides/:bookingId/complete
   * Complete trip and finalize invoice.
   */
  async completeRide(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = String(req.params.bookingId);
      const result = rideHailingService.completeRide(bookingId);

      if (!result.success) {
        sendError(res, 404, `Booking ${bookingId} not found`);
        return;
      }

      sendSuccess({
        res,
        message: 'Ride completed successfully',
        data: result.booking,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/super-app/rides/:bookingId/cancel
   * Cancel ride with reason.
   */
  async cancelRide(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = String(req.params.bookingId);
      const { reason, party } = req.body;

      const result = rideHailingService.cancelRide(bookingId, reason || 'Rider requested', party || 'rider');
      if (!result.success) {
        sendError(res, 400, result.message);
        return;
      }

      sendSuccess({
        res,
        message: result.message,
        data: { cancellationFeeInr: result.cancellationFeeInr },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  // =========================================================================
  // 2. POI DISCOVERY & LIFESTYLE BOOKING ENDPOINTS
  // =========================================================================

  /**
   * GET /api/v1/super-app/lifestyle/places
   * Search lifestyle POIs with filters.
   */
  async searchLifestylePois(req: Request, res: Response): Promise<void> {
    try {
      const { category, longitude, latitude, radius, priceTier, minRating, openNow, query } = req.query;

      let coordinate: [number, number] | undefined;
      if (longitude && latitude) {
        coordinate = [parseFloat(String(longitude)), parseFloat(String(latitude))];
      }

      const results = lifestyleDiscoveryService.searchLifestylePois({
        category: category as LifestylePoiCategory,
        coordinate,
        radiusMeters: radius ? parseFloat(String(radius)) : undefined,
        priceTier: priceTier as any,
        minRating: minRating ? parseFloat(String(minRating)) : undefined,
        openNowOnly: openNow === 'true',
        searchTerm: query ? String(query) : undefined,
      });

      sendSuccess({
        res,
        message: `Found ${results.length} lifestyle venues`,
        data: results,
        meta: { count: results.length },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/super-app/lifestyle/places/:poiId
   * Retrieve single lifestyle POI details.
   */
  async getLifestylePoiById(req: Request, res: Response): Promise<void> {
    try {
      const poiId = String(req.params.poiId);
      const poi = lifestyleDiscoveryService.getPoiById(poiId);

      if (!poi) {
        sendError(res, 404, `POI ${poiId} not found`);
        return;
      }

      sendSuccess({ res, data: poi });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/super-app/lifestyle/book
   * Create dining table reservation or wellness/entertainment appointment.
   */
  async createLifestyleBooking(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        userName,
        userPhone,
        poiId,
        bookingType,
        bookingDate,
        timeSlot,
        partySize,
        selectedServiceItemIds,
        specialRequests,
      } = req.body;

      if (!userId || !poiId || !bookingDate || !timeSlot) {
        sendError(res, 400, 'userId, poiId, bookingDate, and timeSlot are required');
        return;
      }

      const booking = lifestyleDiscoveryService.createBooking({
        userId: String(userId),
        userName: userName ? String(userName) : 'Guest User',
        userPhone: userPhone ? String(userPhone) : '+91 98765 43210',
        poiId: String(poiId),
        bookingType: (bookingType as LifestyleBookingType) || 'table_reservation',
        bookingDate: String(bookingDate),
        timeSlot: String(timeSlot),
        partySize: partySize ? Number(partySize) : 2,
        selectedServiceItemIds,
        specialRequests,
      });

      sendSuccess({
        res,
        message: `Booking confirmed: Voucher ${booking.confirmationCode} generated`,
        data: booking,
      });
    } catch (err: any) {
      sendError(res, 400, err.message);
    }
  }

  /**
   * GET /api/v1/super-app/lifestyle/bookings/:bookingId
   * Retrieve lifestyle reservation details.
   */
  async getLifestyleBookingById(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = String(req.params.bookingId);
      const booking = lifestyleDiscoveryService.getBookingById(bookingId);

      if (!booking) {
        sendError(res, 404, `Booking ${bookingId} not found`);
        return;
      }

      sendSuccess({ res, data: booking });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/super-app/lifestyle/bookings/:bookingId/cancel
   * Cancel lifestyle reservation.
   */
  async cancelLifestyleBooking(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = String(req.params.bookingId);
      const result = lifestyleDiscoveryService.cancelBooking(bookingId);

      if (!result.success) {
        sendError(res, 404, result.message);
        return;
      }

      sendSuccess({ res, message: result.message });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  // =========================================================================
  // 3. OFFLINE MAPS UTILITIES ENDPOINTS
  // =========================================================================

  /**
   * GET /api/v1/super-app/offline/bundles
   * Retrieve available regional offline map packages.
   */
  async getOfflineBundles(req: Request, res: Response): Promise<void> {
    try {
      const bundles = offlineMapsService.getAvailableBundles();
      sendSuccess({
        res,
        message: `Retrieved ${bundles.length} offline map packages`,
        data: bundles,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/super-app/offline/bundles/:bundleId
   * Retrieve single offline bundle details.
   */
  async getOfflineBundleById(req: Request, res: Response): Promise<void> {
    try {
      const bundleId = String(req.params.bundleId);
      const bundle = offlineMapsService.getBundleById(bundleId);

      if (!bundle) {
        sendError(res, 404, `Bundle ${bundleId} not found`);
        return;
      }

      sendSuccess({ res, data: bundle });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * GET /api/v1/super-app/offline/bundles/:bundleId/delta
   * Get differential delta patch between installed version and latest server release.
   */
  async getDifferentialDeltaPatch(req: Request, res: Response): Promise<void> {
    try {
      const bundleId = String(req.params.bundleId);
      const { clientVersion } = req.query;

      if (!clientVersion) {
        sendError(res, 400, 'clientVersion is required (e.g. v2.3.0)');
        return;
      }

      const patch = offlineMapsService.getDifferentialDeltaPatch(bundleId, String(clientVersion));
      if (!patch) {
        sendSuccess({
          res,
          message: 'Client bundle is already up to date',
          data: null,
        });
        return;
      }

      sendSuccess({
        res,
        message: `Delta patch generated: saves ${patch.byteSavingsPercentage}% download bandwidth`,
        data: patch,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POST /api/v1/super-app/offline/route-fallback
   * Compute offline fallback route using bundled road graph.
   */
  async calculateOfflineFallbackRoute(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, vehicleType, offlineBundleId } = req.body;

      if (!origin || !destination || !offlineBundleId) {
        sendError(res, 400, 'origin, destination, and offlineBundleId are required');
        return;
      }

      const result = offlineMapsService.calculateOfflineFallbackRoute({
        origin: origin as [number, number],
        destination: destination as [number, number],
        vehicleType,
        offlineBundleId: String(offlineBundleId),
      });

      sendSuccess({
        res,
        message: `Offline route resolved: ${result.totalDistanceMeters}m (${result.steps.length} steps)`,
        data: result,
      });
    } catch (err: any) {
      sendError(res, 400, err.message);
    }
  }

  /**
   * GET /api/v1/super-app/offline/storage-quota
   * Get device storage quota analysis and prune recommendations.
   */
  async getStorageQuotaReport(req: Request, res: Response): Promise<void> {
    try {
      const { installedBundles } = req.query;
      const ids = installedBundles ? String(installedBundles).split(',') : undefined;

      const report = offlineMapsService.getStorageQuotaReport(ids);
      sendSuccess({
        res,
        message: 'Storage quota analyzed',
        data: report,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }
}

export const superAppController = new SuperAppController();
