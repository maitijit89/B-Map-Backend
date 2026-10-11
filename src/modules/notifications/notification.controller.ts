import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { geofenceTriggerService } from './geofence-trigger.service';
import { pushDispatcherService } from './push-dispatcher.service';
import { tokenManagementService } from './token-management.service';

export class NotificationController {
  /**
   * POST /api/v1/notifications/devices/register
   * Securely store & maintain APNs / FCM tokens mapped to user IDs.
   */
  async registerDeviceToken(req: Request, res: Response): Promise<void> {
    try {
      const { userId, token, platform, tokenType, deviceId, deviceName, appVersion, permissions } = req.body;

      if (!userId || !token || !platform) {
        sendError(res, 400, 'userId, token, and platform (android, ios, web) are required.');
        return;
      }

      const result = await tokenManagementService.registerToken({
        userId,
        token,
        platform,
        tokenType,
        deviceId,
        deviceName,
        appVersion,
        permissions,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Device push token registered successfully',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * DELETE /api/v1/notifications/devices/:token
   * De-register device push token (e.g. on logout or uninstall).
   */
  async deRegisterDeviceToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { userId } = req.body;

      await tokenManagementService.deRegisterToken(token as string, userId);

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Device push token deactivated successfully',
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/notifications/devices/:userId
   * List active registered APNs / FCM device tokens for a user.
   */
  async getUserDevices(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const tokens = await tokenManagementService.getUserActiveTokens(userId as string);

      sendSuccess({
        res,
        statusCode: 200,
        message: `Found ${tokens.length} active device token(s)`,
        data: tokens,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/notifications/send-targeted
   * Dispatches targeted push notification payload to specific user.
   */
  async sendTargetedPush(req: Request, res: Response): Promise<void> {
    try {
      const { recipientUserId, title, body, data, sound, priority, eventType } = req.body;

      if (!recipientUserId || !title || !body) {
        sendError(res, 400, 'recipientUserId, title, and body are required.');
        return;
      }

      const result = await pushDispatcherService.sendTargetedPush({
        recipientUserId,
        title,
        body,
        data,
        sound,
        priority,
        eventType,
      });

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Targeted push notification dispatched successfully',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/notifications/geofence/evaluate
   * Evaluates geofence proximity (e.g. driver 500m away) and triggers targeted customer push.
   */
  async evaluateGeofence(req: Request, res: Response): Promise<void> {
    try {
      const {
        tripId,
        driverId,
        customerUserId,
        driverCoordinates,
        destinationCoordinates,
        etaSeconds,
      } = req.body;

      if (!tripId || !driverId || !customerUserId || !driverCoordinates || !destinationCoordinates) {
        sendError(
          res,
          400,
          'tripId, driverId, customerUserId, driverCoordinates [lon, lat], and destinationCoordinates [lon, lat] are required.'
        );
        return;
      }

      const result = await geofenceTriggerService.evaluateProximityAndTriggerPush({
        tripId,
        driverId,
        customerUserId,
        driverCoordinates,
        destinationCoordinates,
        etaSeconds,
      });

      sendSuccess({
        res,
        statusCode: 200,
        message:
          result.milestoneTriggered !== 'NONE'
            ? `Geofence milestone ${result.milestoneTriggered} triggered push notification`
            : 'Geofence proximity evaluated (no milestone crossed)',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }
}

export const notificationController = new NotificationController();
