import { logger } from '../../core/config/logger';
import { Coordinate } from '../../core/types/geo.types';
import { calculateBearing, calculateDistanceMeters } from '../../core/utils/geo.utils';
import {
  DriverMatchCandidate,
  DriverVehicleInfo,
  RideBooking,
  RideFareQuote,
  RideStatus,
  RideVehicleCategory,
} from './super-app.types';

export class RideHailingService {
  /**
   * In-memory store for active ride bookings.
   */
  private activeBookings: Map<string, RideBooking> = new Map();

  /**
   * Pool of simulated active drivers operating across key Indian urban zones.
   */
  private activeDrivers: Map<string, DriverVehicleInfo> = new Map();

  constructor() {
    this.seedDefaultDriverFleet();
  }

  /**
   * Seeds demo drivers across vehicle categories in Delhi NCR, Mumbai, Bengaluru.
   */
  private seedDefaultDriverFleet(): void {
    const drivers: DriverVehicleInfo[] = [
      {
        driverId: 'drv_auto_rajesh',
        name: 'Rajesh Kumar',
        phone: '+91 98112 34567',
        photoUrl: 'https://cdn.bmap.in/drivers/rajesh_auto.webp',
        rating: 4.88,
        totalTrips: 3420,
        vehicleModel: 'Bajaj RE Compact 4S Auto',
        vehicleNumber: 'DL 1R AB 1042',
        vehicleColor: 'Yellow-Green',
        vehicleCategory: 'auto_rickshaw',
        currentLocation: [77.2195, 28.6328], // Near Connaught Place
        headingDegrees: 90,
      },
      {
        driverId: 'drv_moto_amit',
        name: 'Amit Sharma',
        phone: '+91 98710 98765',
        photoUrl: 'https://cdn.bmap.in/drivers/amit_moto.webp',
        rating: 4.92,
        totalTrips: 1850,
        vehicleModel: 'Hero Splendor Plus (Helmet Provided)',
        vehicleNumber: 'DL 4S CY 8219',
        vehicleColor: 'Black',
        vehicleCategory: 'moto_bike',
        currentLocation: [77.2210, 28.6310],
        headingDegrees: 45,
      },
      {
        driverId: 'drv_mini_vikram',
        name: 'Vikram Singh',
        phone: '+91 99100 11223',
        photoUrl: 'https://cdn.bmap.in/drivers/vikram_mini.webp',
        rating: 4.82,
        totalTrips: 4120,
        vehicleModel: 'Maruti Suzuki WagonR VXI',
        vehicleNumber: 'DL 1Z T 5431',
        vehicleColor: 'Silver',
        vehicleCategory: 'mini_hatchback',
        currentLocation: [77.2240, 28.6335],
        headingDegrees: 180,
      },
      {
        driverId: 'drv_prime_sunil',
        name: 'Sunil Verma',
        phone: '+91 98200 44556',
        photoUrl: 'https://cdn.bmap.in/drivers/sunil_prime.webp',
        rating: 4.96,
        totalTrips: 5200,
        vehicleModel: 'Hyundai Aura SX Petrol',
        vehicleNumber: 'DL 1E B 9988',
        vehicleColor: 'White',
        vehicleCategory: 'prime_sedan',
        currentLocation: [77.2180, 28.6300],
        headingDegrees: 270,
      },
      {
        driverId: 'drv_ev_priya',
        name: 'Priya Mukherjee',
        phone: '+91 98300 77889',
        photoUrl: 'https://cdn.bmap.in/drivers/priya_ev.webp',
        rating: 4.95,
        totalTrips: 2100,
        vehicleModel: 'Tata Tigor EV Green Clean Cab',
        vehicleNumber: 'DL 1C EV 3321',
        vehicleColor: 'Teal Blue',
        vehicleCategory: 'ev_green',
        currentLocation: [77.2205, 28.6340],
        headingDegrees: 0,
      },
      {
        driverId: 'drv_suv_gurpreet',
        name: 'Gurpreet Singh',
        phone: '+91 98140 22334',
        photoUrl: 'https://cdn.bmap.in/drivers/gurpreet_suv.webp',
        rating: 4.9,
        totalTrips: 2980,
        vehicleModel: 'Maruti Suzuki Ertiga ZXI (6+1)',
        vehicleNumber: 'HR 26 DQ 7711',
        vehicleColor: 'Metallic Grey',
        vehicleCategory: 'suv_xl',
        currentLocation: [77.2260, 28.6320],
        headingDegrees: 120,
      },
    ];

    for (const d of drivers) {
      this.activeDrivers.set(d.driverId, d);
    }
  }

  /**
   * Calculates comprehensive multi-modal fare quotes for a route.
   */
  calculateFareQuotes(
    pickup: Coordinate,
    dropoff: Coordinate,
    surgeMultiplier: number = 1.0
  ): RideFareQuote[] {
    const distanceMeters = calculateDistanceMeters(pickup, dropoff);
    const distanceKm = Math.max(0.5, Math.round((distanceMeters / 1000) * 10) / 10);

    // Estimate transit duration assuming 25 km/h urban average speed
    const estimatedMinutes = Math.max(4, Math.round((distanceKm / 25) * 60));

    // Night surcharge detection (23:00 - 05:00)
    const currentHour = new Date().getHours();
    const isNightTime = currentHour >= 23 || currentHour < 5;
    const nightFactor = isNightTime ? 0.25 : 0.0;

    const categories: Array<{
      category: RideVehicleCategory;
      displayName: string;
      icon: string;
      pax: number;
      base: number;
      perKm: number;
      perMin: number;
      evDiscount: number;
    }> = [
      {
        category: 'auto_rickshaw',
        displayName: 'Auto Rickshaw',
        icon: 'electric_rickshaw',
        pax: 3,
        base: 30,
        perKm: 11.0,
        perMin: 1.2,
        evDiscount: 0,
      },
      {
        category: 'moto_bike',
        displayName: 'Bike Taxi (Moto)',
        icon: 'two_wheeler',
        pax: 1,
        base: 20,
        perKm: 7.5,
        perMin: 0.8,
        evDiscount: 0,
      },
      {
        category: 'mini_hatchback',
        displayName: 'B-Map Mini (Hatchback)',
        icon: 'directions_car',
        pax: 4,
        base: 50,
        perKm: 14.0,
        perMin: 1.5,
        evDiscount: 0,
      },
      {
        category: 'prime_sedan',
        displayName: 'B-Map Prime (Sedan)',
        icon: 'local_taxi',
        pax: 4,
        base: 80,
        perKm: 18.0,
        perMin: 2.0,
        evDiscount: 0,
      },
      {
        category: 'ev_green',
        displayName: 'Green EV (Zero Emission)',
        icon: 'eco',
        pax: 4,
        base: 60,
        perKm: 15.0,
        perMin: 1.5,
        evDiscount: 15, // ₹15 eco green promotional subsidy
      },
      {
        category: 'suv_xl',
        displayName: 'B-Map SUV XL (6 Seater)',
        icon: 'airport_shuttle',
        pax: 6,
        base: 120,
        perKm: 24.0,
        perMin: 2.5,
        evDiscount: 0,
      },
      {
        category: 'outstation_intercity',
        displayName: 'Outstation Intercity',
        icon: 'commute',
        pax: 4,
        base: 250,
        perKm: 16.0,
        perMin: 1.0,
        evDiscount: 0,
      },
    ];

    return categories.map((cat) => {
      const distFare = distanceKm * cat.perKm;
      const timeFare = estimatedMinutes * cat.perMin;
      const rawSubtotal = cat.base + distFare + timeFare - cat.evDiscount;

      const surgeAddition = rawSubtotal * (surgeMultiplier - 1.0);
      const nightSurcharge = rawSubtotal * nightFactor;
      const taxableAmount = rawSubtotal + surgeAddition + nightSurcharge;
      const taxesGst = Math.round(taxableAmount * 0.05); // 5% GST
      const totalFare = Math.round(taxableAmount + taxesGst);

      // Random ETA for nearby pickup between 2 and 6 mins
      const etaPickupMinutes = cat.category === 'moto_bike' ? 2 : cat.category === 'auto_rickshaw' ? 3 : 5;

      return {
        category: cat.category,
        categoryDisplayName: cat.displayName,
        iconName: cat.icon,
        capacityPax: cat.pax,
        baseFare: cat.base,
        distanceKm,
        distanceFare: Math.round(distFare),
        estimatedDurationMinutes: estimatedMinutes,
        timeFare: Math.round(timeFare),
        surgeMultiplier,
        nightSurcharge: Math.round(nightSurcharge),
        taxesGst,
        totalFare,
        currency: 'INR',
        etaPickupMinutes,
      };
    });
  }

  /**
   * Finds candidate drivers matching vehicle category within radius of pickup point.
   */
  findNearbyDrivers(
    pickup: Coordinate,
    category?: RideVehicleCategory,
    radiusMeters: number = 3000
  ): DriverMatchCandidate[] {
    const candidates: DriverMatchCandidate[] = [];

    for (const driver of this.activeDrivers.values()) {
      if (category && driver.vehicleCategory !== category) {
        continue;
      }

      const dist = calculateDistanceMeters(pickup, driver.currentLocation);
      if (dist <= radiusMeters) {
        const eta = Math.max(1, Math.round(dist / 350)); // ~21 km/h in traffic
        candidates.push({
          driverId: driver.driverId,
          name: driver.name,
          rating: driver.rating,
          vehicleCategory: driver.vehicleCategory,
          location: driver.currentLocation,
          distanceMeters: Math.round(dist),
          etaMinutes: eta,
        });
      }
    }

    return candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  /**
   * Requests a new ride, matches available driver, and initiates state machine.
   */
  requestRide(params: {
    riderId: string;
    riderName: string;
    riderPhone: string;
    category: RideVehicleCategory;
    pickupLocation: Coordinate;
    pickupAddress: string;
    dropoffLocation: Coordinate;
    dropoffAddress: string;
    paymentMethod?: 'upi' | 'wallet' | 'cash' | 'corporate_card';
    surgeMultiplier?: number;
  }): RideBooking {
    const bookingId = `ride_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const quotes = this.calculateFareQuotes(
      params.pickupLocation,
      params.dropoffLocation,
      params.surgeMultiplier || 1.0
    );

    const selectedQuote =
      quotes.find((q) => q.category === params.category) || quotes[0];

    // Find best matching driver
    const nearby = this.findNearbyDrivers(params.pickupLocation, params.category, 5000);
    const assignedDriverCandidate = nearby.length > 0 ? nearby[0] : null;
    const assignedDriver = assignedDriverCandidate
      ? this.activeDrivers.get(assignedDriverCandidate.driverId)
      : Array.from(this.activeDrivers.values())[0];

    // Generate 4-digit ride start OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const booking: RideBooking = {
      bookingId,
      riderId: params.riderId,
      riderName: params.riderName,
      riderPhone: params.riderPhone,
      category: params.category,
      status: 'accepted',
      pickupLocation: params.pickupLocation,
      pickupAddress: params.pickupAddress,
      dropoffLocation: params.dropoffLocation,
      dropoffAddress: params.dropoffAddress,
      otpStartTrip: otp,
      assignedDriver,
      fare: selectedQuote,
      paymentMethod: params.paymentMethod || 'upi',
      paymentStatus: 'authorized',
      requestedAt: Date.now(),
      acceptedAt: Date.now() + 1500,
      routePolyline: [params.pickupLocation, params.dropoffLocation],
      liveDistanceRemainingMeters: Math.round(calculateDistanceMeters(params.pickupLocation, params.dropoffLocation)),
      liveEtaRemainingSeconds: selectedQuote.estimatedDurationMinutes * 60,
    };

    this.activeBookings.set(bookingId, booking);
    logger.info(`Ride booked: ${bookingId} for rider ${params.riderName} with driver ${assignedDriver?.name} (OTP: ${otp})`);
    return booking;
  }

  /**
   * Verifies the 4-digit security OTP to start the trip.
   */
  verifyOtpAndStartRide(bookingId: string, enteredOtp: string): { success: boolean; message: string; booking?: RideBooking } {
    const booking = this.activeBookings.get(bookingId);
    if (!booking) {
      return { success: false, message: `Booking ${bookingId} not found` };
    }

    if (booking.otpStartTrip !== enteredOtp) {
      return { success: false, message: 'Invalid 4-digit Start OTP. Please ask rider for correct PIN.' };
    }

    booking.status = 'in_transit';
    booking.pickupAt = Date.now();
    return { success: true, message: 'OTP verified successfully. Trip started!', booking };
  }

  /**
   * Completes the ride and finalizes payment invoice.
   */
  completeRide(bookingId: string): { success: boolean; booking?: RideBooking } {
    const booking = this.activeBookings.get(bookingId);
    if (!booking) {
      return { success: false };
    }

    booking.status = 'completed';
    booking.completedAt = Date.now();
    booking.paymentStatus = 'completed';
    booking.liveDistanceRemainingMeters = 0;
    booking.liveEtaRemainingSeconds = 0;

    return { success: true, booking };
  }

  /**
   * Cancels a ride with reason code and cancellation party.
   */
  cancelRide(
    bookingId: string,
    reason: string,
    party: 'rider' | 'driver' | 'system_timeout' = 'rider'
  ): { success: boolean; message: string; cancellationFeeInr: number } {
    const booking = this.activeBookings.get(bookingId);
    if (!booking) {
      return { success: false, message: `Booking ${bookingId} not found`, cancellationFeeInr: 0 };
    }

    const elapsedSeconds = (Date.now() - (booking.acceptedAt || booking.requestedAt)) / 1000;
    const cancellationFeeInr = elapsedSeconds > 180 && party === 'rider' ? 45 : 0; // Free within 3 mins

    booking.status = 'cancelled';
    booking.cancelledAt = Date.now();
    booking.cancellationReason = reason;
    booking.cancellationParty = party;

    return {
      success: true,
      message: `Ride ${bookingId} cancelled by ${party}`,
      cancellationFeeInr,
    };
  }

  /**
   * Retrieves active ride booking by ID.
   */
  getBooking(bookingId: string): RideBooking | null {
    return this.activeBookings.get(bookingId) || null;
  }
}

export const rideHailingService = new RideHailingService();
