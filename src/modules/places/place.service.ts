import { IPlace, Place } from './place.model';
import { Coordinate } from '../../core/types/geo.types';
import { escapeRegExp } from '../../core/utils/security.utils';

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

    return await place.save();
  }

  /**
   * Geospatial search using MongoDB $near operator with 2dsphere index.
   */
  async findNearby(query: NearbyPlaceQuery): Promise<IPlace[]> {
    const maxDistance = query.maxDistanceMeters || 5000;
    const limit = query.limit || 50;

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

    return await Place.find(filter).limit(limit).exec();
  }

  /**
   * Geospatial search within a bounding polygon using $geoWithin.
   */
  async findWithinPolygon(
    polygonCoordinates: Coordinate[][],
    category?: string
  ): Promise<IPlace[]> {
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

    return await Place.find(filter).exec();
  }

  /**
   * Search places by text keyword and category.
   */
  async searchPlaces(keyword: string, category?: string, limit: number = 20): Promise<IPlace[]> {
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

    return await Place.find(filter).limit(limit).exec();
  }

  /**
   * Get place by MongoDB ObjectId.
   */
  async getPlaceById(id: string): Promise<IPlace | null> {
    return await Place.findById(id).exec();
  }
}

export const placeService = new PlaceService();
