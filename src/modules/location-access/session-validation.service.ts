import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { INavigationSession, NavigationSession } from '../navigation/navigation-session.model';
import { rideHailingService } from '../super-app/ride-hailing.service';

export interface SessionValidationResult {
  isValid: boolean;
  session?: {
    tripId: string;
    userId: string;
    customerUserId?: string;
    driverId?: string;
    status: 'active' | 'completed' | 'cancelled' | 'paused';
    destinationCoordinates?: [number, number];
    remainingDistanceMeters?: number;
    remainingDurationSeconds?: number;
  };
  errorCode?:
    | 'PRIVACY_REJECTION_NO_ACTIVE_TRIP'
    | 'PRIVACY_REJECTION_SESSION_TERMINATED'
    | 'PRIVACY_REJECTION_USER_MISMATCH'
    | 'PRIVACY_REJECTION_MISSING_TRIP_ID';
  message?: string;
}

export class SessionValidationService {
  // In-memory active trip session cache for fast checks & testing fallback
  private activeTripsMemory = new Map<
    string,
    {
      tripId: string;
      userId: string;
      customerUserId?: string;
      driverId?: string;
      status: 'active' | 'completed' | 'cancelled' | 'paused';
      destinationCoordinates?: [number, number];
      remainingDistanceMeters?: number;
      remainingDurationSeconds?: number;
    }
  >();

  /**
   * Registers or syncs an active trip in memory / Redis for ultra-fast validation checks.
   */
  async registerActiveTrip(
    tripId: string,
    userId: string,
    destinationCoordinates?: [number, number],
    customerUserId?: string,
    driverId?: string
  ): Promise<void> {
    const sessionData = {
      tripId,
      userId,
      customerUserId: customerUserId || userId,
      driverId: driverId || userId,
      status: 'active' as const,
      destinationCoordinates,
      remainingDistanceMeters: 5000,
      remainingDurationSeconds: 600,
    };

    this.activeTripsMemory.set(tripId, sessionData);

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        await redis.setex(`trip:${tripId}:active`, 86400, JSON.stringify(sessionData));
      }
    } catch (err: any) {
      logger.debug(`Redis cache write skipped for trip ${tripId}: ${err.message}`);
    }
  }

  /**
   * Terminates / removes active trip from fast cache.
   */
  async terminateActiveTrip(tripId: string, status: 'completed' | 'cancelled' = 'completed'): Promise<void> {
    const existing = this.activeTripsMemory.get(tripId);
    if (existing) {
      existing.status = status;
      this.activeTripsMemory.set(tripId, existing);
    }

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        await redis.del(`trip:${tripId}:active`);
      }
    } catch (err: any) {
      logger.debug(`Redis cache del skipped for trip ${tripId}: ${err.message}`);
    }
  }

  /**
   * Cross-references incoming coordinates against active database trip IDs.
   * If a client transmits location data but has no active or matching trip session on the backend,
   * the server strictly rejects the payload to protect user privacy.
   */
  async validateActiveTripSession(
    tripId: string | undefined,
    userId?: string
  ): Promise<SessionValidationResult> {
    if (!tripId || tripId.trim() === '') {
      return {
        isValid: false,
        errorCode: 'PRIVACY_REJECTION_MISSING_TRIP_ID',
        message: 'Location transmission rejected to protect user privacy: Missing trip ID.',
      };
    }

    const cleanTripId = tripId.trim();

    // 1. Fast Cache Check (Redis / In-Memory)
    let cachedSession = this.activeTripsMemory.get(cleanTripId);

    if (!cachedSession && isRedisConnected()) {
      try {
        const redis = getRedisClient();
        const raw = await redis.get(`trip:${cleanTripId}:active`);
        if (raw) {
          cachedSession = JSON.parse(raw);
        }
      } catch (err: any) {
        // Fall through to database
      }
    }

    if (cachedSession) {
      if (cachedSession.status !== 'active') {
        logger.warn(
          `🛡️ Privacy Guard: Rejected telemetry for inactive trip "${cleanTripId}" (status: ${cachedSession.status}).`
        );
        return {
          isValid: false,
          errorCode: 'PRIVACY_REJECTION_SESSION_TERMINATED',
          message: `Location transmission rejected: Trip session "${cleanTripId}" is ${cachedSession.status}. Coordinates will not be collected.`,
        };
      }

      if (userId) {
        const matchesOwner = cachedSession.userId === userId;
        const matchesDriver = cachedSession.driverId === userId;
        const matchesCustomer = cachedSession.customerUserId === userId;

        if (!matchesOwner && !matchesDriver && !matchesCustomer) {
          logger.warn(
            `🛡️ Privacy Guard: Rejected telemetry for user mismatch on trip "${cleanTripId}". Payload user: ${userId}, Session owner: ${cachedSession.userId}`
          );
          return {
            isValid: false,
            errorCode: 'PRIVACY_REJECTION_USER_MISMATCH',
            message: `Location transmission rejected: User ID does not match active trip session owner or driver.`,
          };
        }
      }

      return {
        isValid: true,
        session: cachedSession,
      };
    }

    // 2. Query MongoDB NavigationSession Model
    try {
      const navSession = await NavigationSession.findOne({ sessionId: cleanTripId });

      if (navSession) {
        if (navSession.status !== 'active') {
          logger.warn(
            `🛡️ Privacy Guard: Rejected coordinates for non-active database trip "${cleanTripId}" (status: ${navSession.status}).`
          );
          return {
            isValid: false,
            errorCode: 'PRIVACY_REJECTION_SESSION_TERMINATED',
            message: `Location transmission rejected: Navigation session "${cleanTripId}" is ${navSession.status}. Coordinates will not be stored.`,
          };
        }

        if (userId && navSession.userId !== userId) {
          logger.warn(
            `🛡️ Privacy Guard: Rejected telemetry for user mismatch on navigation session "${cleanTripId}".`
          );
          return {
            isValid: false,
            errorCode: 'PRIVACY_REJECTION_USER_MISMATCH',
            message: `Location transmission rejected: User ID does not match active navigation session.`,
          };
        }

        const destCoords = navSession.destination?.coordinates;
        const normalizedSession = {
          tripId: navSession.sessionId,
          userId: navSession.userId,
          status: navSession.status,
          destinationCoordinates: destCoords,
          remainingDistanceMeters: navSession.remainingDistanceMeters,
          remainingDurationSeconds: navSession.remainingDurationSeconds,
        };

        // Cache for subsequent high-frequency pings
        this.activeTripsMemory.set(cleanTripId, normalizedSession);

        return {
          isValid: true,
          session: normalizedSession,
        };
      }
    } catch (err: any) {
      logger.debug(`Database lookup fallback check for trip ${cleanTripId}: ${err.message}`);
    }

    // 3. Query Active Super-App Ride Bookings
    try {
      const ride = rideHailingService.getBooking(cleanTripId);
      if (ride) {
        const activeStatuses = ['ACCEPTED', 'DRIVER_ARRIVING', 'IN_TRANSIT'];
        if (!activeStatuses.includes(ride.status)) {
          logger.warn(
            `🛡️ Privacy Guard: Rejected coordinates for ride booking "${cleanTripId}" with inactive status "${ride.status}".`
          );
          return {
            isValid: false,
            errorCode: 'PRIVACY_REJECTION_SESSION_TERMINATED',
            message: `Location transmission rejected: Ride booking "${cleanTripId}" has status "${ride.status}". Coordinates will not be tracked.`,
          };
        }

        const normalizedRide = {
          tripId: ride.bookingId,
          userId: ride.riderId,
          status: 'active' as const,
          destinationCoordinates: ride.dropoffLocation,
          remainingDistanceMeters: 3000,
          remainingDurationSeconds: 360,
        };

        this.activeTripsMemory.set(cleanTripId, normalizedRide);

        return {
          isValid: true,
          session: normalizedRide,
        };
      }
    } catch (err: any) {
      // Fall through
    }

    // 4. No active trip found anywhere in database -> Strict Privacy Rejection
    logger.warn(
      `🛡️ Privacy Guard: REJECTED location payload with non-existent or inactive tripId "${cleanTripId}". No telemetry stored.`
    );

    return {
      isValid: false,
      errorCode: 'PRIVACY_REJECTION_NO_ACTIVE_TRIP',
      message: `Location transmission rejected to protect user privacy: No active trip session on backend for ID "${cleanTripId}".`,
    };
  }
}

export const sessionValidationService = new SessionValidationService();
