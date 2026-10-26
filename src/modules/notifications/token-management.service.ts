import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { DeviceToken, IDeviceToken } from './device-token.model';
import { DevicePlatform, PushTokenType, RegisterDeviceTokenDto } from './notification.types';

export interface UserDeviceTokenEntry {
  token: string;
  platform: DevicePlatform;
  tokenType: PushTokenType;
  deviceId?: string;
  deviceName?: string;
}

export class TokenManagementService {
  // In-memory fallback map for offline resilience / unit testing
  private memoryTokensStore = new Map<string, IDeviceToken>();

  /**
   * Securely stores and maintains Apple Push Notification service (APNs) and
   * Firebase Cloud Messaging (FCM) registration tokens mapped to specific user IDs.
   */
  async registerToken(data: RegisterDeviceTokenDto): Promise<UserDeviceTokenEntry> {
    const cleanToken = data.token.trim();
    const tokenType: PushTokenType =
      data.tokenType || (data.platform === 'ios' && /^[0-9a-fA-F]{64}$/.test(cleanToken) ? 'apns' : 'fcm');

    const updatePayload = {
      userId: data.userId,
      token: cleanToken,
      platform: data.platform,
      tokenType,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      appVersion: data.appVersion,
      isActive: true,
      permissions: {
        postNotifications: data.permissions?.postNotifications ?? true,
        authorizationStatus: data.permissions?.authorizationStatus ?? 'authorized',
      },
      lastUsedAt: new Date(),
    };

    // Update in memory store
    this.memoryTokensStore.set(cleanToken, updatePayload as any);

    // Persist in MongoDB if connected
    try {
      if (mongoose.connection?.readyState === 1) {
        await DeviceToken.findOneAndUpdate({ token: cleanToken }, updatePayload, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        });
      }
    } catch (err: any) {
      logger.warn(`DeviceToken MongoDB upsert warning: ${err.message}`);
    }

    // Cache in Redis for high-speed retrieval
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        const cacheKey = `user:${data.userId}:device_tokens`;
        await redis.sadd(cacheKey, JSON.stringify({ token: cleanToken, platform: data.platform, tokenType }));
        await redis.expire(cacheKey, 86400 * 30); // 30 days
      }
    } catch (e: any) {
      // Ignored
    }

    logger.info(
      `📱 Registered ${tokenType.toUpperCase()} token for user ${data.userId} on ${data.platform} (${cleanToken.substring(0, 12)}...)`
    );

    return {
      token: cleanToken,
      platform: data.platform,
      tokenType,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
    };
  }

  /**
   * De-registers / invalidates a device push token (e.g. on user logout).
   */
  async deRegisterToken(token: string, userId?: string): Promise<boolean> {
    const cleanToken = token.trim();
    this.memoryTokensStore.delete(cleanToken);

    try {
      if (mongoose.connection?.readyState === 1) {
        await DeviceToken.updateOne({ token: cleanToken }, { $set: { isActive: false } });
      }
    } catch (err: any) {
      logger.warn(`Failed to deactivate token in MongoDB: ${err.message}`);
    }

    if (userId && isRedisConnected()) {
      try {
        const redis = getRedisClient();
        await redis.del(`user:${userId}:device_tokens`);
      } catch (e) {
        // Ignored
      }
    }

    logger.info(`Revoked device push token: ${cleanToken.substring(0, 12)}...`);
    return true;
  }

  /**
   * Retrieves all active APNs / FCM tokens mapped to a specific user ID.
   */
  async getUserActiveTokens(userId: string): Promise<UserDeviceTokenEntry[]> {
    const results: UserDeviceTokenEntry[] = [];
    const seenTokens = new Set<string>();

    // 1. Check MongoDB
    try {
      if (mongoose.connection?.readyState === 1) {
        const docs = await DeviceToken.find({ userId, isActive: true }).lean();
        for (const doc of docs) {
          if (!seenTokens.has(doc.token)) {
            seenTokens.add(doc.token);
            results.push({
              token: doc.token,
              platform: doc.platform,
              tokenType: doc.tokenType,
              deviceId: doc.deviceId,
              deviceName: doc.deviceName,
            });
          }
        }
      }
    } catch (err: any) {
      logger.debug(`DeviceToken DB fetch fallback: ${err.message}`);
    }

    // 2. Check in-memory store
    for (const item of this.memoryTokensStore.values()) {
      if (item.userId === userId && item.isActive && !seenTokens.has(item.token)) {
        seenTokens.add(item.token);
        results.push({
          token: item.token,
          platform: item.platform,
          tokenType: item.tokenType,
          deviceId: item.deviceId,
          deviceName: item.deviceName,
        });
      }
    }

    return results;
  }

  /**
   * Deactivates stale/invalid tokens reported by APNs/FCM.
   */
  async markTokenInvalid(token: string): Promise<void> {
    this.memoryTokensStore.delete(token);
    try {
      if (mongoose.connection?.readyState === 1) {
        await DeviceToken.updateOne({ token }, { $set: { isActive: false } });
      }
    } catch (e) {
      // Ignored
    }
  }
}

export const tokenManagementService = new TokenManagementService();
