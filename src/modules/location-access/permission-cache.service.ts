import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { PermissionStatus, UserPermissionState } from './location-access.types';

export class PermissionCacheService {
  // In-memory lightweight high-speed cache for sub-millisecond lookups
  private permissionMemoryCache = new Map<string, UserPermissionState>();

  /**
   * Retrieves cached permission state for a user.
   * Checks local memory cache first, falling back to distributed Redis.
   */
  async getPermissionState(userId: string): Promise<UserPermissionState> {
    if (!userId) {
      return this.getDefaultGrantedState('anonymous');
    }

    // 1. Check local memory cache
    const mem = this.permissionMemoryCache.get(userId);
    if (mem) {
      return mem;
    }

    // 2. Check distributed Redis
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        const raw = await redis.get(`perms:${userId}`);
        if (raw) {
          const parsed: UserPermissionState = JSON.parse(raw);
          this.permissionMemoryCache.set(userId, parsed);
          return parsed;
        }
      }
    } catch (err: any) {
      logger.debug(`Redis permission lookup skipped: ${err.message}`);
    }

    // Default to initial granted state if no explicit revocation was recorded
    const defaultState = this.getDefaultGrantedState(userId);
    this.permissionMemoryCache.set(userId, defaultState);
    return defaultState;
  }

  /**
   * Updates user permission state in both memory and distributed Redis.
   */
  async updatePermissionState(
    userId: string,
    partial: Partial<UserPermissionState>
  ): Promise<UserPermissionState> {
    const existing = await this.getPermissionState(userId);
    const updated: UserPermissionState = {
      ...existing,
      ...partial,
      userId,
      lastUpdatedAt: Date.now(),
    };

    // If background location is revoked or denied, automatically halt polling and stop expecting socket messages
    if (updated.backgroundLocation === 'revoked' || updated.backgroundLocation === 'denied') {
      updated.pollingHalted = true;
      updated.socketExpectingTelemetry = false;
    } else if (updated.backgroundLocation === 'granted') {
      updated.pollingHalted = false;
      updated.socketExpectingTelemetry = true;
    }

    this.permissionMemoryCache.set(userId, updated);

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        await redis.setex(`perms:${userId}`, 86400 * 7, JSON.stringify(updated));
      }
    } catch (err: any) {
      logger.debug(`Redis permission write skipped: ${err.message}`);
    }

    return updated;
  }

  /**
   * Instantly revokes background location access for a user.
   * The backend immediately knows to stop polling or expecting socket messages for that user session.
   */
  async revokeBackgroundAccess(
    userId: string,
    tripId?: string
  ): Promise<{ revoked: boolean; message: string; state: UserPermissionState }> {
    logger.warn(
      `🚫 [PERMISSION REVOCATION] User "${userId}" REVOKED background access${
        tripId ? ` on trip "${tripId}"` : ''
      }. Instantly halting background polling & socket expectations.`
    );

    const updatedState = await this.updatePermissionState(userId, {
      backgroundLocation: 'revoked',
      pollingHalted: true,
      socketExpectingTelemetry: false,
    });

    return {
      revoked: true,
      message:
        'Background location access revoked. Backend has immediately terminated background polling and cleared socket telemetry expectations.',
      state: updatedState,
    };
  }

  /**
   * Fast check to see if background location is allowed for this user session.
   */
  async isBackgroundAccessAllowed(userId: string): Promise<boolean> {
    const state = await this.getPermissionState(userId);
    return state.backgroundLocation === 'granted';
  }

  /**
   * Default initial permission state when user begins a session.
   */
  private getDefaultGrantedState(userId: string): UserPermissionState {
    return {
      userId,
      backgroundLocation: 'granted',
      fineLocation: 'granted',
      motionFitness: 'granted',
      bluetoothScan: 'granted',
      postNotifications: 'granted',
      lastUpdatedAt: Date.now(),
      pollingHalted: false,
      socketExpectingTelemetry: true,
    };
  }
}

export const permissionCacheService = new PermissionCacheService();
