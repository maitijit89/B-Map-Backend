import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { locationIngestionService } from './location-ingestion.service';
import { sessionValidationService } from './session-validation.service';
import { permissionCacheService } from './permission-cache.service';
import { tripTokenService } from './trip-token.service';

export class LocationAccessController {
  /**
   * POST /api/v1/tracking/ingest (and /api/v1/location/ingest)
   * Ingests real-time client location fix.
   * Cross-references against active trip session on backend.
   * Enforces 1–2s foreground vs 30–60s background rate regulation.
   */
  async ingestLocation(req: Request, res: Response): Promise<void> {
    try {
      const {
        tripId,
        userId,
        coordinates,
        heading,
        speed,
        accuracy,
        altitude,
        timestamp,
        appLifecycleMode = 'foreground',
        permissions,
        batteryLevel,
        isGeofenceTrigger,
        geofenceEvent,
        scannedBeacons,
        metadata,
      } = req.body;

      if (!tripId || !userId || !coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        sendError(
          res,
          400,
          'tripId, userId, and coordinates [longitude, latitude] are required for location ingestion.'
        );
        return;
      }

      const tripToken =
        req.body.tripToken ||
        (typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined);

      const result = await locationIngestionService.ingestLocation({
        tripId,
        userId,
        coordinates: [Number(coordinates[0]), Number(coordinates[1])],
        heading,
        speed,
        accuracy,
        altitude,
        timestamp,
        appLifecycleMode,
        permissions,
        batteryLevel,
        isGeofenceTrigger,
        geofenceEvent,
        scannedBeacons,
        tripToken,
        metadata,
      });

      // If rejected due to missing/inactive trip session (privacy protection) or cryptographic scoping
      if (!result.accepted) {
        const isAuthError =
          result.errorCode === 'CRYPTOGRAPHIC_TOKEN_MISSING' ||
          result.errorCode === 'CRYPTOGRAPHIC_TOKEN_EXPIRED' ||
          result.errorCode === 'CRYPTOGRAPHIC_TOKEN_INVALID';

        res.status(isAuthError ? 401 : 403).json({
          success: false,
          errorCode: result.errorCode,
          message: result.rejectionReason,
          data: {
            tripId,
            userId,
            accepted: false,
            timestamp: result.timestamp,
          },
        });
        return;
      }

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Location fix ingested successfully',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/tracking/lifecycle-mode
   * Client reports transitioning between foreground (1–2s) and background (30–60s).
   */
  async reportLifecycleChange(req: Request, res: Response): Promise<void> {
    try {
      const { tripId, userId, appLifecycleMode, permissions, batteryLevel } = req.body;

      if (!tripId || !userId || !appLifecycleMode) {
        sendError(res, 400, 'tripId, userId, and appLifecycleMode are required.');
        return;
      }

      const policy = await locationIngestionService.handleLifecycleChange({
        tripId,
        userId,
        appLifecycleMode,
        permissions,
        batteryLevel,
      });

      sendSuccess({
        res,
        statusCode: 200,
        message: `Lifecycle state updated to ${appLifecycleMode}`,
        data: {
          appLifecycleMode,
          policy,
        },
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/tracking/session/register
   * Helper endpoint to activate a trip session in the fast cache (used by mobile client upon starting navigation).
   */
  async registerActiveSession(req: Request, res: Response): Promise<void> {
    try {
      const { tripId, userId, destinationCoordinates } = req.body;
      if (!tripId || !userId) {
        sendError(res, 400, 'tripId and userId are required.');
        return;
      }

      await sessionValidationService.registerActiveTrip(tripId, userId, destinationCoordinates);

      sendSuccess({
        res,
        statusCode: 201,
        message: `Trip session ${tripId} activated for tracking ingestion.`,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/tracking/session/:tripId/terminate
   * Terminates active trip session so subsequent location updates are rejected for privacy.
   */
  async terminateSession(req: Request, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;
      const { status = 'completed' } = req.body;

      await sessionValidationService.terminateActiveTrip(tripId as string, status);

      sendSuccess({
        res,
        statusCode: 200,
        message: `Trip session ${tripId} terminated (${status}). Privacy guard activated.`,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/location/session/tokenize-trip
   * Tokenizes a navigation trip and issues a short-lived cryptographically scoped JWT linked explicitly to an open destination route.
   */
  async tokenizeTrip(req: Request, res: Response): Promise<void> {
    try {
      const { userId, tripId, routeId, destinationCoordinates, expiresInMinutes } = req.body;

      if (!userId || !tripId || !routeId || !destinationCoordinates) {
        sendError(
          res,
          400,
          'userId, tripId, routeId, and destinationCoordinates are required to tokenize a navigation trip.'
        );
        return;
      }

      const tokenResult = await tripTokenService.tokenizeTrip({
        userId,
        tripId,
        routeId,
        destinationCoordinates,
        expiresInMinutes,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: `Navigation trip "${tripId}" tokenized with strict cryptographic scoping.`,
        data: tokenResult,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/location/session/refresh-trip-token
   * Refreshes a short-lived trip token while destination route is open.
   */
  async refreshTripToken(req: Request, res: Response): Promise<void> {
    try {
      const token =
        req.body.tripToken ||
        (typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined);

      if (!token) {
        sendError(res, 400, 'tripToken or Authorization Bearer header is required.');
        return;
      }

      const refreshed = await tripTokenService.refreshTripToken(
        token,
        req.body.expiresInMinutes || 15
      );

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Trip telemetry token refreshed successfully.',
        data: refreshed,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/location/permissions/revoke
   * Revokes background location access. Instantly updates Redis/memory cache to halt background polling.
   */
  async revokeBackgroundPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { userId, tripId } = req.body;
      if (!userId) {
        sendError(res, 400, 'userId is required to revoke permissions.');
        return;
      }

      const result = await permissionCacheService.revokeBackgroundAccess(userId, tripId);

      sendSuccess({
        res,
        statusCode: 200,
        message: result.message,
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/location/permissions/:userId
   * Retrieves current user permission state from Redis/memory cache.
   */
  async getPermissionState(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const state = await permissionCacheService.getPermissionState(userId as string);

      sendSuccess({
        res,
        statusCode: 200,
        data: state,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * PUT /api/v1/location/permissions/state
   * Updates cached user permission state in Redis and memory.
   */
  async updatePermissionState(req: Request, res: Response): Promise<void> {
    try {
      const { userId, ...permissions } = req.body;
      if (!userId) {
        sendError(res, 400, 'userId is required.');
        return;
      }

      const updated = await permissionCacheService.updatePermissionState(userId, permissions);

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Permission state updated in Redis cache.',
        data: updated,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }
}

export const locationAccessController = new LocationAccessController();
