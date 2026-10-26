import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { TrackingLog } from './tracking-log.model';
import { Coordinate, LocationPayload, NearbyEntityResult, NearbyQueryOptions } from '../../core/types/geo.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';

export class GeoTrackingService {
  private inMemoryLocations = new Map<string, LocationPayload>();

  private getGeoKey(role: string = 'driver'): string {
    return `geo:${role}s`;
  }

  /**
   * Updates real-time location in Redis Geospatial Index & metadata hash.
   */
  async updateLocation(payload: LocationPayload): Promise<void> {
    const role = payload.role || 'driver';
    const geoKey = this.getGeoKey(role);
    const memberId = payload.userId;
    const now = payload.timestamp || Date.now();

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();

        // 1. Redis GEOADD command: GEOADD key longitude latitude member
        await redis.geoadd(geoKey, payload.longitude, payload.latitude, memberId);

        // 2. Store rich telemetry in Redis Hash
        const metaKey = `entity:${memberId}:meta`;
        await redis.hset(metaKey, {
          userId: memberId,
          role,
          longitude: payload.longitude.toString(),
          latitude: payload.latitude.toString(),
          heading: (payload.heading ?? 0).toString(),
          speed: (payload.speed ?? 0).toString(),
          accuracy: (payload.accuracy ?? 0).toString(),
          lastUpdated: now.toString(),
        });

        // Set 24 hour TTL on telemetry hash
        await redis.expire(metaKey, 86400);
      }

      // Keep in local cache for ultra-fast fallback
      this.inMemoryLocations.set(memberId, { ...payload, timestamp: now });

      // Async persistence to MongoDB (fire-and-forget or non-blocking)
      this.persistToMongo(payload).catch((err) => {
        logger.warn(`Failed persisting location to MongoDB: ${err.message}`);
      });
    } catch (err: any) {
      logger.error(`Error updating location for ${memberId}: ${err.message}`);
    }
  }

  /**
   * Finds nearby active entities (e.g. drivers) within a radius (meters) using Redis GEOSEARCH / GEORADIUS.
   */
  async findNearbyEntities(options: NearbyQueryOptions): Promise<NearbyEntityResult[]> {
    const role = options.role || 'driver';
    const geoKey = this.getGeoKey(role);
    const radiusMeters = options.radiusInMeters;
    const limit = options.limit || 50;

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();

        // Use GEOSEARCH (Redis 6.2+) with fallback to GEORADIUS
        let rawResults: any[] = [];
        try {
          // GEOSEARCH key FROMLONLAT lon lat BYRADIUS radius m WITHCOORD WITHDIST COUNT limit ASC
          rawResults = (await (redis as any).geosearch(
            geoKey,
            'FROMLONLAT',
            options.longitude,
            options.latitude,
            'BYRADIUS',
            radiusMeters,
            'm',
            'WITHCOORD',
            'WITHDIST',
            'COUNT',
            limit,
            'ASC'
          )) as any[];
        } catch {
          // Fallback to GEORADIUS for earlier Redis versions
          rawResults = (await (redis as any).georadius(
            geoKey,
            options.longitude,
            options.latitude,
            radiusMeters,
            'm',
            'WITHCOORD',
            'WITHDIST',
            'COUNT',
            limit,
            'ASC'
          )) as any[];
        }

        const results: NearbyEntityResult[] = [];

        for (const item of rawResults) {
          const memberId = item[0] as string;
          const distMeters = parseFloat(item[1] as string);
          const coords = item[2] as [string, string]; // [lon, lat]

          // Fetch extra metadata
          const metaKey = `entity:${memberId}:meta`;
          const meta = await redis.hgetall(metaKey);

          results.push({
            userId: memberId,
            longitude: parseFloat(coords[0]),
            latitude: parseFloat(coords[1]),
            distanceInMeters: Math.round(distMeters * 10) / 10,
            lastUpdated: meta?.lastUpdated ? parseInt(meta.lastUpdated, 10) : Date.now(),
            role,
            metadata: {
              heading: meta?.heading ? parseFloat(meta.heading) : 0,
              speed: meta?.speed ? parseFloat(meta.speed) : 0,
            },
          });
        }

        return results;
      }
    } catch (err: any) {
      logger.warn(`Redis GEO query error, falling back to memory: ${err.message}`);
    }

    // In-memory fallback calculation using Turf.js
    const results: NearbyEntityResult[] = [];
    const origin: Coordinate = [options.longitude, options.latitude];

    for (const [userId, loc] of this.inMemoryLocations.entries()) {
      if (options.role && loc.role !== options.role) continue;
      const target: Coordinate = [loc.longitude, loc.latitude];
      const dist = calculateDistanceMeters(origin, target);

      if (dist <= radiusMeters) {
        results.push({
          userId,
          longitude: loc.longitude,
          latitude: loc.latitude,
          distanceInMeters: Math.round(dist * 10) / 10,
          lastUpdated: loc.timestamp || Date.now(),
          role: loc.role,
          metadata: {
            heading: loc.heading ?? 0,
            speed: loc.speed ?? 0,
          },
        });
      }
    }

    results.sort((a, b) => a.distanceInMeters - b.distanceInMeters);
    return results.slice(0, limit);
  }

  /**
   * Retrieves an entity's current location from Redis.
   */
  async getEntityLocation(userId: string, role: string = 'driver'): Promise<Coordinate | null> {
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        const geoKey = this.getGeoKey(role);
        const pos = await redis.geopos(geoKey, userId);

        if (pos && pos[0]) {
          return [parseFloat(pos[0][0]), parseFloat(pos[0][1])];
        }
      }
    } catch (err: any) {
      logger.warn(`Failed fetching geopos from Redis: ${err.message}`);
    }

    const loc = this.inMemoryLocations.get(userId);
    return loc ? [loc.longitude, loc.latitude] : null;
  }

  /**
   * Asynchronously persists location breadcrumb to MongoDB for audit & route replay.
   */
  private async persistToMongo(payload: LocationPayload): Promise<void> {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return;
    }
    await TrackingLog.create({
      userId: payload.userId,
      role: payload.role || 'driver',
      location: {
        type: 'Point',
        coordinates: [payload.longitude, payload.latitude],
      },
      heading: payload.heading,
      speed: payload.speed,
      accuracy: payload.accuracy,
      recordedAt: new Date(payload.timestamp || Date.now()),
      metadata: payload.metadata,
    });
  }
}

export const geoTrackingService = new GeoTrackingService();
