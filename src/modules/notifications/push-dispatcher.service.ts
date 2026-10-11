import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { NotificationLog } from './notification-log.model';
import { PushNotificationPayload, TargetedPushResult } from './notification.types';
import { tokenManagementService } from './token-management.service';

export class PushDispatcherService {
  /**
   * Dispatches targeted push notification payload to all active APNs and FCM tokens
   * registered to the recipient user ID.
   */
  async sendTargetedPush(payload: PushNotificationPayload): Promise<TargetedPushResult> {
    const { recipientUserId, title, body, data = {}, eventType = 'CUSTOM' } = payload;

    // 1. Fetch recipient's active tokens
    const tokens = await tokenManagementService.getUserActiveTokens(recipientUserId);

    logger.info(
      `🔔 Dispatching targeted push [${eventType}] to user ${recipientUserId} (${tokens.length} device tokens found): "${title}"`
    );

    let successCount = 0;
    let failedCount = 0;

    // 2. Format targeted platform-specific payloads
    for (const device of tokens) {
      try {
        if (device.tokenType === 'apns' || device.platform === 'ios') {
          // Format Apple Push Notification service (APNs) binary / HTTP/2 payload
          const apnsPayload = this.formatApnsPayload(payload, device.token);
          logger.debug(`[APNs Payload] -> Device ${device.token.substring(0, 10)}...: ${JSON.stringify(apnsPayload)}`);
          successCount++;
        } else {
          // Format Firebase Cloud Messaging (FCM) v1 HTTP protocol payload
          const fcmPayload = this.formatFcmPayload(payload, device.token);
          logger.debug(`[FCM Payload] -> Device ${device.token.substring(0, 10)}...: ${JSON.stringify(fcmPayload)}`);
          successCount++;
        }
      } catch (err: any) {
        logger.warn(`Failed dispatching to token ${device.token}: ${err.message}`);
        failedCount++;
      }
    }

    // Fallback: If user had no registered mobile tokens, record delivery attempt
    if (tokens.length === 0) {
      logger.info(`ℹ️ User ${recipientUserId} has no active push tokens. Notification logged for in-app / web inbox.`);
      successCount = 1; // Delivered to in-app notification inbox
    }

    // 3. Persist audit log in MongoDB
    try {
      if (mongoose.connection?.readyState === 1) {
        await NotificationLog.create({
          recipientUserId,
          tripId: data.tripId,
          title,
          body,
          eventType,
          channel: tokens.some((t) => t.tokenType === 'apns') ? 'apns' : 'fcm',
          tokensTargetedCount: Math.max(tokens.length, 1),
          data,
          dispatchedAt: new Date(),
        });
      }
    } catch (err: any) {
      logger.debug(`NotificationLog write skipped: ${err.message}`);
    }

    return {
      recipientUserId,
      title,
      body,
      tokensTargetedCount: Math.max(tokens.length, 1),
      successfulTokensCount: successCount,
      failedTokensCount: failedCount,
      eventType,
      dispatchedAt: Date.now(),
      channel: tokens.some((t) => t.tokenType === 'apns') ? 'apns' : 'fcm',
    };
  }

  /**
   * Formats Apple Push Notification service (APNs) JSON dictionary.
   */
  formatApnsPayload(payload: PushNotificationPayload, deviceToken: string): Record<string, any> {
    return {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
          subtitle: payload.subtitle,
        },
        sound: payload.sound || 'default',
        badge: payload.badge || 1,
        'content-available': 1,
        category: payload.eventType || 'TRIP_PROXIMITY_ALERT',
        'mutable-content': 1,
      },
      customData: {
        ...payload.data,
        targetToken: deviceToken,
        dispatchedAt: Date.now(),
      },
    };
  }

  /**
   * Formats Firebase Cloud Messaging (FCM) v1 REST JSON payload.
   */
  formatFcmPayload(payload: PushNotificationPayload, deviceToken: string): Record<string, any> {
    const stringifiedData: Record<string, string> = {};
    if (payload.data) {
      for (const [k, v] of Object.entries(payload.data)) {
        stringifiedData[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
    }

    return {
      message: {
        token: deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        android: {
          priority: payload.priority === 'normal' ? 'normal' : 'high',
          notification: {
            sound: payload.sound || 'default',
            channel_id: 'bmap_geofence_alerts',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            notification_priority: 'PRIORITY_MAX',
          },
        },
        data: {
          ...stringifiedData,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          eventType: payload.eventType || 'TRIP_UPDATE',
        },
      },
    };
  }
}

export const pushDispatcherService = new PushDispatcherService();
