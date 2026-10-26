import mongoose from 'mongoose';
import { IPlace, Place } from './place.model';
import { Coordinate } from '../../core/types/geo.types';
import { escapeRegExp } from '../../core/utils/security.utils';
import { OfflinePOISeed, queryOfflineFallbackPOIs } from '../../core/resilience/offline-fallback-seeds';

export interface CreatePlaceInput {
  name: string;
  category: string;
  description?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  coordinates: Coordinate; // [lon, lat]
  rating?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface NearbyPlaceQuery {
  longitude: number;
  latitude: number;
  maxDistanceMeters?: number; // default 5000m (5km)
  minDistanceMeters?: number;
  category?: string;
  limit?: number;
}

export class PlaceService {
  // Ultra-fast in-memory L1 cache for spatial proximity queries (30s TTL)
  private nearbyCache = new Map<string, { data: IPlace[]; expiry: number }>();

  /**
   * Create a new geospatial Point of Interest (POI).
   */
  async createPlace(input: CreatePlaceInput): Promise<IPlace> {
    const place = new Place({
      name: input.name,
      category: input.category,
      description: input.description,
      address: input.address,
      location: {
        type: 'Point',
        coordinates: input.coordinates,
      },
      rating: input.rating,
      tags: input.tags,
      metadata: input.metadata,
    });

    const saved = await place.save();
    this.nearbyCache.clear(); // Invalidate cache on new POI creation
    return saved;
  }

  /**
   * Geospatial search using MongoDB $near operator with 2dsphere index.
   * If MongoDB is unreachable or experiencing network partition, falls back to
   * pre-calibrated in-memory national POIs ("offlineFallback": true).
   */
  async findNearby(query: NearbyPlaceQuery): Promise<IPlace[]> {
    const maxDistance = query.maxDistanceMeters || 5000;
    const limit = query.limit || 50;

    // Check L1 cache first for fast repeat hits
    const cacheKey = `near_${query.longitude.toFixed(3)}_${query.latitude.toFixed(3)}_${maxDistance}_${query.category || 'all'}_${limit}`;
    const cached = this.nearbyCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return queryOfflineFallbackPOIs({
        longitude: query.longitude,
        latitude: query.latitude,
        maxDistanceMeters: maxDistance,
        category: query.category,
        limit,
      }) as unknown as IPlace[];
    }

    try {
      const filter: Record<string, any> = {
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [query.longitude, query.latitude],
            },
            $maxDistance: maxDistance,
          },
        },
      };

      if (query.minDistanceMeters) {
        filter.location.$near.$minDistance = query.minDistanceMeters;
      }

      if (query.category) {
        filter.category = query.category.toLowerCase();
      }

      const results = (await Place.find(filter).limit(limit).lean().exec()) as unknown as IPlace[];

      // Store in L1 cache
      if (this.nearbyCache.size > 500) {
        const now = Date.now();
        for (const [k, v] of this.nearbyCache.entries()) {
          if (v.expiry < now) this.nearbyCache.delete(k);
        }
      }
      this.nearbyCache.set(cacheKey, { data: results, expiry: Date.now() + 30000 });

      return results;
    } catch {
      return queryOfflineFallbackPOIs({
        longitude: query.longitude,
        latitude: query.latitude,
        maxDistanceMeters: maxDistance,
        category: query.category,
        limit,
      }) as unknown as IPlace[];
    }
  }

  /**
   * Geospatial search within a bounding polygon using $geoWithin.
   */
  async findWithinPolygon(
    polygonCoordinates: Coordinate[][],
    category?: string
  ): Promise<IPlace[]> {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return [];
    }

    try {
      const filter: Record<string, any> = {
        location: {
          $geoWithin: {
            $geometry: {
              type: 'Polygon',
              coordinates: polygonCoordinates,
            },
          },
        },
      };

      if (category) {
        filter.category = category.toLowerCase();
      }

      return (await Place.find(filter).lean().exec()) as unknown as IPlace[];
    } catch {
      return [];
    }
  }

  /**
   * Search places by text keyword and category.
   * Falls back to offline POI seeds on database partition.
   */
  async searchPlaces(keyword: string, category?: string, limit: number = 20): Promise<IPlace[]> {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      const fallback = queryOfflineFallbackPOIs({
        longitude: 77.2185,
        latitude: 28.6328,
        maxDistanceMeters: 100000,
        category,
        limit,
      });
      const term = keyword.toLowerCase().trim();
      return fallback.filter(
        (p: OfflinePOISeed) =>
          p.name.toLowerCase().includes(term) ||
          p.tags.some((t: string) => t.toLowerCase().includes(term))
      ) as unknown as IPlace[];
    }

    try {
      const sanitizedKeyword = escapeRegExp(keyword.trim());
      const filter: Record<string, any> = {
        $or: [
          { name: { $regex: sanitizedKeyword, $options: 'i' } },
          { description: { $regex: sanitizedKeyword, $options: 'i' } },
          { tags: { $in: [new RegExp(sanitizedKeyword, 'i')] } },
        ],
      };

      if (category) {
        filter.category = category.toLowerCase();
      }

      return (await Place.find(filter).limit(limit).lean().exec()) as unknown as IPlace[];
    } catch {
      const fallback = queryOfflineFallbackPOIs({
        longitude: 77.2185,
        latitude: 28.6328,
        maxDistanceMeters: 100000,
        category,
        limit,
      });
      const term = keyword.toLowerCase().trim();
      return fallback.filter(
        (p: OfflinePOISeed) =>
          p.name.toLowerCase().includes(term) ||
          p.tags.some((t: string) => t.toLowerCase().includes(term))
      ) as unknown as IPlace[];
    }
  }

  /**
   * Get place by MongoDB ObjectId.
   */
  async getPlaceById(id: string): Promise<IPlace | null> {
    return (await Place.findById(id).lean().exec()) as unknown as IPlace | null;
  }
}

export const placeService = new PlaceService();
