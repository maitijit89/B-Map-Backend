import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../core/config/env.config';
import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { Coordinate } from '../../core/types/geo.types';
import { TripTelemetryTokenPayload } from './location-access.types';
import { sessionValidationService } from './session-validation.service';

export interface TokenizeTripParams {
  userId: string;
  tripId: string;
  routeId: string;
  destinationCoordinates: Coordinate;
  expiresInMinutes?: number;
}

export interface VerifyTripTokenResult {
  isValid: boolean;
  payload?: TripTelemetryTokenPayload;
  errorCode?:
    | 'CRYPTOGRAPHIC_TOKEN_MISSING'
    | 'CRYPTOGRAPHIC_TOKEN_EXPIRED'
    | 'CRYPTOGRAPHIC_TOKEN_INVALID'
    | 'CRYPTOGRAPHIC_TRIP_MISMATCH'
    | 'CRYPTOGRAPHIC_USER_MISMATCH'
    | 'CRYPTOGRAPHIC_ROUTE_CLOSED'
    | 'CRYPTOGRAPHIC_SCOPE_INVALID';
  message: string;
}

export class TripTokenService {
  private secret: string;
  // Local in-memory open destination route map: tripId -> { routeId, destinationCoordinates, status: 'open' | 'closed' }
  private openDestinationRoutes = new Map<
    string,
    {
      routeId: string;
      destinationCoordinates: Coordinate;
      status: 'open' | 'closed';
      openedAt: number;
    }
  >();

  constructor() {
    this.secret = env.JWT_SECRET;
  }

  /**
   * Checks whether a trip was tokenized with strict cryptographic scoping.
   */
  isTripTokenized(tripId: string): boolean {
    return this.openDestinationRoutes.has(tripId);
  }

  /**
   * Tokenizes a navigation trip and issues a short-lived cryptographically signed JWT.
   * The token is linked explicitly to an open destination route.
   */
  async tokenizeTrip(params: TokenizeTripParams): Promise<{
    tripToken: string;
    expiresInSeconds: number;
    tripId: string;
    routeId: string;
    destinationCoordinates: Coordinate;
  }> {
    const { userId, tripId, routeId, destinationCoordinates, expiresInMinutes = 15 } = params;

    const payload: TripTelemetryTokenPayload = {
      sub: userId,
      tripId,
      routeId,
      destinationCoordinates,
      scope: 'telemetry:ingest',
      type: 'trip_scoped_token',
    };

    const options: SignOptions = {
      expiresIn: `${expiresInMinutes}m`,
      issuer: 'b-map-navigation-engine',
      audience: 'b-map-telemetry-client',
    };

    const token = jwt.sign(payload, this.secret, options);

    // Explicitly link open destination route to this trip session in memory & Redis
    this.openDestinationRoutes.set(tripId, {
      routeId,
      destinationCoordinates,
      status: 'open',
      openedAt: Date.now(),
    });

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        await redis.setex(
          `trip:${tripId}:open_route`,
          expiresInMinutes * 60 * 2,
          JSON.stringify({
            routeId,
            destinationCoordinates,
            status: 'open',
            openedAt: Date.now(),
          })
        );
      }
    } catch (err: any) {
      logger.debug(`Redis route linkage skipped: ${err.message}`);
    }

    // Ensure sessionValidationService has the active trip registered with destination
    await sessionValidationService.registerActiveTrip(tripId, userId, destinationCoordinates);

    logger.info(
      `🔐 [CRYPTOGRAPHIC SCOPING] Tokenized trip "${tripId}" for user "${userId}". Issued short-lived JWT (Route: ${routeId}, Exp: ${expiresInMinutes}m)`
    );

    return {
      tripToken: token,
      expiresInSeconds: expiresInMinutes * 60,
      tripId,
      routeId,
      destinationCoordinates,
    };
  }

  /**
   * Strictly verifies incoming coordinate update JWT:
   * 1. Validates signature and ensures token is not expired.
   * 2. Asserts token scope is 'telemetry:ingest'.
   * 3. Confirms token's tripId and userId match the telemetry payload.
   * 4. Asserts that the trip is explicitly linked to an open destination route.
   */
  async verifyTripTelemetryToken(
    token: string | undefined,
    tripId: string,
    userId: string
  ): Promise<VerifyTripTokenResult> {
    if (!token || token.trim() === '') {
      return {
        isValid: false,
        errorCode: 'CRYPTOGRAPHIC_TOKEN_MISSING',
        message:
          'Raw coordinate update strictly rejected: Strict cryptographic scoping requires a valid short-lived trip JWT ("tripToken" or "Authorization: Bearer <token>").',
      };
    }

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();

    let decoded: TripTelemetryTokenPayload;
    try {
      decoded = jwt.verify(cleanToken, this.secret, {
        issuer: 'b-map-navigation-engine',
        audience: 'b-map-telemetry-client',
      }) as TripTelemetryTokenPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return {
          isValid: false,
          errorCode: 'CRYPTOGRAPHIC_TOKEN_EXPIRED',
          message:
            'Trip telemetry token has expired. Please refresh the short-lived token for this active trip.',
        };
      }
      return {
        isValid: false,
        errorCode: 'CRYPTOGRAPHIC_TOKEN_INVALID',
        message: `Cryptographic token verification failed: ${error.message}`,
      };
    }

    // Assert correct scope
    if (decoded.scope !== 'telemetry:ingest' || decoded.type !== 'trip_scoped_token') {
      return {
        isValid: false,
        errorCode: 'CRYPTOGRAPHIC_SCOPE_INVALID',
        message: 'Supplied token does not possess the required "telemetry:ingest" cryptographic scope.',
      };
    }

    // Assert exact tripId match
    if (decoded.tripId !== tripId) {
      logger.warn(
        `🛡️ [CRYPTOGRAPHIC VIOLATION] Trip mismatch: Token tripId="${decoded.tripId}" vs Payload tripId="${tripId}". Coordinate fix discarded.`
      );
      return {
        isValid: false,
        errorCode: 'CRYPTOGRAPHIC_TRIP_MISMATCH',
        message: `Cryptographic token tripId ("${decoded.tripId}") does not match transmitting payload tripId ("${tripId}").`,
      };
    }

    // Assert exact userId match
    if (decoded.sub !== userId) {
      logger.warn(
        `🛡️ [CRYPTOGRAPHIC VIOLATION] User mismatch: Token userId="${decoded.sub}" vs Payload userId="${userId}". Coordinate fix discarded.`
      );
      return {
        isValid: false,
        errorCode: 'CRYPTOGRAPHIC_USER_MISMATCH',
        message: `Cryptographic token owner ("${decoded.sub}") does not match transmitting user ID ("${userId}").`,
      };
    }

    // Assert destination route is open on the backend
    const routeRecord = await this.getOpenDestinationRoute(tripId);
    if (!routeRecord || routeRecord.status !== 'open') {
      return {
        isValid: false,
        errorCode: 'CRYPTOGRAPHIC_ROUTE_CLOSED',
        message: `Coordinate update rejected: Destination route "${decoded.routeId}" for trip "${tripId}" is not currently open or active.`,
      };
    }

    if (routeRecord.routeId !== decoded.routeId) {
      return {
        isValid: false,
        errorCode: 'CRYPTOGRAPHIC_TRIP_MISMATCH',
        message: `Token route ID ("${decoded.routeId}") does not match backend active open route ("${routeRecord.routeId}").`,
      };
    }

    return {
      isValid: true,
      payload: decoded,
      message: 'Trip telemetry token verified and successfully cryptographically scoped.',
    };
  }

  /**
   * Refreshes an active short-lived trip token while destination route is open.
   */
  async refreshTripToken(
    oldToken: string,
    expiresInMinutes: number = 15
  ): Promise<{ tripToken: string; expiresInSeconds: number }> {
    const cleanToken = oldToken.startsWith('Bearer ') ? oldToken.slice(7).trim() : oldToken.trim();

    let decoded: TripTelemetryTokenPayload;
    try {
      decoded = jwt.decode(cleanToken) as TripTelemetryTokenPayload;
    } catch {
      throw new Error('Unable to decode trip token for refresh.');
    }

    if (!decoded || !decoded.tripId || !decoded.sub) {
      throw new Error('Invalid token structure.');
    }

    const routeRecord = await this.getOpenDestinationRoute(decoded.tripId);
    if (!routeRecord || routeRecord.status !== 'open') {
      throw new Error(
        `Cannot refresh trip token: Trip "${decoded.tripId}" has no open destination route.`
      );
    }

    const refreshed = await this.tokenizeTrip({
      userId: decoded.sub,
      tripId: decoded.tripId,
      routeId: decoded.routeId,
      destinationCoordinates: decoded.destinationCoordinates,
      expiresInMinutes,
    });

    return {
      tripToken: refreshed.tripToken,
      expiresInSeconds: refreshed.expiresInSeconds,
    };
  }

  /**
   * Closes an open destination route when a trip ends or cancels.
   */
  async closeDestinationRoute(tripId: string): Promise<void> {
    const existing = this.openDestinationRoutes.get(tripId);
    if (existing) {
      existing.status = 'closed';
      this.openDestinationRoutes.set(tripId, existing);
    }

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        await redis.del(`trip:${tripId}:open_route`);
      }
    } catch {
      // Redis skip
    }

    logger.info(`🔒 Destination route for trip "${tripId}" marked closed.`);
  }

  private async getOpenDestinationRoute(tripId: string): Promise<{
    routeId: string;
    destinationCoordinates: Coordinate;
    status: 'open' | 'closed';
  } | null> {
    const mem = this.openDestinationRoutes.get(tripId);
    if (mem) return mem;

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        const raw = await redis.get(`trip:${tripId}:open_route`);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.openDestinationRoutes.set(tripId, parsed);
          return parsed;
        }
      }
    } catch {
      // Skip
    }

    return null;
  }
}

export const tripTokenService = new TripTokenService();
