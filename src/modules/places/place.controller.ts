import { Request, Response } from 'express';
import { placeService } from './place.service';
import { placeRatingService } from './place-rating.service';
import { visitedPlaceScalingService } from './visited-place-scaling.service';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { SubmitPlaceRatingInput } from './place-rating.types';
import { Coordinate } from '../../core/types/geo.types';

export class PlaceController {
  /**
   * POST /api/v1/places
   * Create a new geospatial Point of Interest
   */
  async createPlace(req: Request, res: Response): Promise<void> {
    try {
      const { name, category, description, address, coordinates, rating, tags, metadata } = req.body;

      if (!name || !category || !coordinates) {
        sendError(res, 400, 'name, category, and coordinates [lon, lat] are required');
        return;
      }

      const place = await placeService.createPlace({
        name,
        category,
        description,
        address,
        coordinates,
        rating,
        tags,
        metadata,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Place created successfully',
        data: place,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/places/nearby
   * Find places nearby a coordinate using MongoDB 2dsphere $near
   */
  async getNearby(req: Request, res: Response): Promise<void> {
    try {
      const { longitude, latitude, maxDistance, minDistance, category, limit } = req.query;

      if (!longitude || !latitude) {
        sendError(res, 400, 'longitude and latitude query parameters are required');
        return;
      }

      const lon = parseFloat(longitude as string);
      const lat = parseFloat(latitude as string);

      if (isNaN(lon) || isNaN(lat)) {
        sendError(res, 400, 'longitude and latitude must be valid numbers');
        return;
      }

      const places = await placeService.findNearby({
        longitude: lon,
        latitude: lat,
        maxDistanceMeters: maxDistance ? parseFloat(maxDistance as string) : 5000,
        minDistanceMeters: minDistance ? parseFloat(minDistance as string) : undefined,
        category: category as string,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      sendSuccess({
        res,
        message: `Found ${places.length} nearby places`,
        data: places,
        meta: {
          searchPoint: [lon, lat],
          maxDistanceMeters: maxDistance ? parseFloat(maxDistance as string) : 5000,
        },
      });
    } catch (error: any) {
      console.error('Delete rating caught error:', error);
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/places/within-polygon
   * Find places bounded inside a polygon using MongoDB $geoWithin
   */
  async getWithinPolygon(req: Request, res: Response): Promise<void> {
    try {
      const { coordinates, category } = req.body;

      if (!Array.isArray(coordinates) || coordinates.length < 1) {
        sendError(res, 400, 'coordinates array for polygon rings is required');
        return;
      }

      const places = await placeService.findWithinPolygon(coordinates, category);

      sendSuccess({
        res,
        message: `Found ${places.length} places inside polygon`,
        data: places,
      });
    } catch (error: any) {
      console.error('Delete rating caught error:', error);
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/places/search
   * Search places by text keyword
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const { q, category, limit } = req.query;

      if (!q || typeof q !== 'string') {
        sendError(res, 400, 'Search keyword "q" is required');
        return;
      }

      const places = await placeService.searchPlaces(
        q,
        category as string,
        limit ? parseInt(limit as string, 10) : 20
      );

      sendSuccess({
        res,
        message: `Search returned ${places.length} results`,
        data: places,
      });
    } catch (error: any) {
      console.error('Delete rating caught error:', error);
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/places/:id
   * Get single place by id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const place = await placeService.getPlaceById(req.params.id as string);
      if (!place) {
        sendError(res, 404, 'Place not found');
        return;
      }

      sendSuccess({
        res,
        data: place,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/places/top-rated/discover
   * Discover top-rated places/POIs
   */
  async getTopRated(req: Request, res: Response): Promise<void> {
    try {
      const { category, limit } = req.query;
      const places = await placeService.getTopRatedPlaces(
        category as string,
        limit ? parseInt(limit as string, 10) : 20
      );

      sendSuccess({
        res,
        message: `Retrieved ${places.length} top-rated places`,
        data: places,
      });
    } catch (error: any) {
      console.error('Delete rating caught error:', error);
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/places/:placeId/ratings
   * Submit or update a place rating & review
   */
  async submitRating(req: Request, res: Response): Promise<void> {
    try {
      const placeId = (req.params.placeId || req.params.id) as string;
      if (!placeId) {
        sendError(res, 400, 'placeId is required');
        return;
      }

      const body = req.body || {};
      const { score, title, review, aspects, visitType, photos, tags, proofOfPresenceSignature } = body;

      if (score === undefined || score === null || isNaN(Number(score))) {
        sendError(res, 400, 'score is required and must be a number between 1 and 5');
        return;
      }

      const numScore = Number(score);
      if (numScore < 1 || numScore > 5) {
        sendError(res, 400, 'score must be between 1 and 5');
        return;
      }

      const user = (req as any).user;
      const userId = body.userId || user?.userId || user?.id || 'usr_guest_' + Math.random().toString(36).substring(2, 8);
      const userName = body.userName || user?.name || 'Verified Explorer';
      const userEmail = body.userEmail || user?.email;

      let userCoord: Coordinate | undefined = undefined;
      if (Array.isArray(body.userCoordinate) && body.userCoordinate.length === 2) {
        userCoord = [Number(body.userCoordinate[0]), Number(body.userCoordinate[1])];
      } else if (body.userCoordinate && typeof body.userCoordinate === 'object') {
        const { longitude, latitude } = body.userCoordinate;
        if (longitude !== undefined && latitude !== undefined) {
          userCoord = [Number(longitude), Number(latitude)];
        }
      }

      const input: SubmitPlaceRatingInput = {
        placeId,
        userId,
        userName,
        userEmail,
        score: numScore,
        title,
        review,
        aspects,
        visitType,
        photos,
        tags,
        userCoordinate: userCoord,
        proofOfPresenceSignature,
      };

      const result = await placeRatingService.submitRating(placeId, input);

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Place rating and review submitted successfully',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/places/:placeId/ratings
   * Get paginated reviews for a place
   */
  async getRatings(req: Request, res: Response): Promise<void> {
    try {
      const placeId = (req.params.placeId || req.params.id) as string;
      if (!placeId) {
        sendError(res, 400, 'placeId is required');
        return;
      }

      const { page, limit, sortBy, minScore, maxScore, verifiedOnly } = req.query;

      const result = await placeRatingService.getPlaceRatings(placeId, {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        sortBy: sortBy as any,
        minScore: minScore ? parseFloat(minScore as string) : undefined,
        maxScore: maxScore ? parseFloat(maxScore as string) : undefined,
        verifiedOnly: verifiedOnly === 'true' || verifiedOnly === '1',
      });

      sendSuccess({
        res,
        message: `Found ${result.total} reviews for place`,
        data: result.ratings,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error: any) {
      console.error('Delete rating caught error:', error);
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/places/:placeId/ratings/summary
   * Get rating summary, distribution, aspect scores and sentiment
   */
  async getRatingStats(req: Request, res: Response): Promise<void> {
    try {
      const placeId = (req.params.placeId || req.params.id) as string;
      if (!placeId) {
        sendError(res, 400, 'placeId is required');
        return;
      }

      const stats = await placeRatingService.getPlaceRatingStats(placeId);

      sendSuccess({
        res,
        message: 'Place rating summary and sentiment analysis retrieved',
        data: stats,
      });
    } catch (error: any) {
      console.error('Delete rating caught error:', error);
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/places/:placeId/ratings/my-review
   * Get authenticated or specified user's review for this place
   */
  async getMyReview(req: Request, res: Response): Promise<void> {
    try {
      const placeId = (req.params.placeId || req.params.id) as string;
      const user = (req as any).user;
      const userId = (req.query.userId as string) || user?.userId || user?.id;

      if (!userId) {
        sendError(res, 400, 'User identity or userId query parameter is required');
        return;
      }

      const review = await placeRatingService.getUserPlaceRating(placeId, userId);
      if (!review) {
        sendError(res, 404, 'No review found for this user and place');
        return;
      }

      sendSuccess({
        res,
        message: 'User place review retrieved',
        data: review,
      });
    } catch (error: any) {
      console.error('Delete rating caught error:', error);
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/places/:placeId/ratings/:ratingId/helpful
   * Upvote a review as helpful (or un-vote if already upvoted)
   */
  async voteHelpful(req: Request, res: Response): Promise<void> {
    try {
      const placeId = String(req.params.placeId || req.params.id);
      const rawRatingId = req.params.ratingId;

      if (!rawRatingId) {
        sendError(res, 400, 'ratingId is required');
        return;
      }
      const ratingId = String(rawRatingId);

      const body = req.body || {};
      const user = (req as any).user;
      const userId = body.userId || user?.userId || user?.id || 'usr_guest_' + (req.ip || 'local');

      const result = await placeRatingService.voteHelpful(placeId, ratingId, userId);

      sendSuccess({
        res,
        message: result.voted ? 'Marked review as helpful' : 'Removed helpful vote from review',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/places/:placeId/ratings/:ratingId/report
   * Report an inappropriate review for moderation
   */
  async reportReview(req: Request, res: Response): Promise<void> {
    try {
      const placeId = String(req.params.placeId || req.params.id);
      const rawRatingId = req.params.ratingId;

      if (!rawRatingId) {
        sendError(res, 400, 'ratingId is required');
        return;
      }
      const ratingId = String(rawRatingId);

      const body = req.body || {};
      const user = (req as any).user;
      const userId = body.userId || user?.userId || user?.id;
      const reason = body.reason || 'Flagged for moderation';

      const result = await placeRatingService.reportReview(placeId, ratingId, reason, userId);

      sendSuccess({
        res,
        message: result.isFlagged
          ? 'Review flagged and sent to moderation queue'
          : 'Report recorded successfully',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * DELETE /api/v1/places/:placeId/ratings/:ratingId
   * Delete a review (author or admin)
   */
  async deleteRating(req: Request, res: Response): Promise<void> {
    try {
      const placeId = String(req.params.placeId || req.params.id);
      const rawRatingId = req.params.ratingId;

      if (!rawRatingId) {
        sendError(res, 400, 'ratingId is required');
        return;
      }
      const ratingId = String(rawRatingId);

      const body = req.body || {};
      const user = (req as any).user;
      const userId = body.userId || (req.query.userId as string) || user?.userId || user?.id || '';
      const isAdmin = user?.role === 'admin' || req.query.admin === 'true';

      const deleted = await placeRatingService.deletePlaceRating(placeId, ratingId, userId, isAdmin);

      if (!deleted) {
        sendError(res, 404, 'Rating not found or not authorized to delete');
        return;
      }

      sendSuccess({
        res,
        message: 'Rating deleted successfully',
        data: { deleted: true, ratingId },
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/places/user/visit
   * Record a user place visit or spatial dwell spot ping
   */
  async recordUserVisit(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body || {};
      const user = (req as any).user;
      const userId = body.userId || user?.userId || user?.id || 'usr_guest';

      if (!body.coordinates || !Array.isArray(body.coordinates) || body.coordinates.length < 2) {
        sendError(res, 400, 'coordinates [longitude, latitude] are required');
        return;
      }

      const coordinates: Coordinate = [Number(body.coordinates[0]), Number(body.coordinates[1])];
      if (isNaN(coordinates[0]) || isNaN(coordinates[1])) {
        sendError(res, 400, 'coordinates must be valid numbers');
        return;
      }

      const result = await visitedPlaceScalingService.recordVisit({
        userId,
        placeId: body.placeId,
        placeName: body.placeName,
        category: body.category,
        coordinates,
        speedKmH: body.speedKmH !== undefined ? Number(body.speedKmH) : undefined,
        dwellMinutes: body.dwellMinutes !== undefined ? Number(body.dwellMinutes) : undefined,
        timestamp: body.timestamp,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'User visit recorded and spatial scale updated',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/places/user/visited-places
   * Get user visited places with dynamic visual scaling (most visited are larger)
   */
  async getUserVisitedPlaces(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const userId = (req.query.userId as string) || user?.userId || user?.id || 'usr_traveler_01';

      const minRadiusPx = req.query.minRadiusPx ? Number(req.query.minRadiusPx) : undefined;
      const maxRadiusPx = req.query.maxRadiusPx ? Number(req.query.maxRadiusPx) : undefined;
      const visitCap = req.query.visitCap ? Number(req.query.visitCap) : undefined;

      const places = await visitedPlaceScalingService.getUserVisitedPlaces(userId, {
        minRadiusPx,
        maxRadiusPx,
        visitCap,
      });

      sendSuccess({
        res,
        message: `Retrieved ${places.length} visited places with dynamic scaling`,
        data: places,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/places/user/visited-spots
   * Get user visited spots with "slow large" scaling (spots with slow speeds and high visits expand)
   */
  async getUserVisitedSpots(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const userId = (req.query.userId as string) || user?.userId || user?.id || 'usr_traveler_01';

      const minRadiusPx = req.query.minRadiusPx ? Number(req.query.minRadiusPx) : undefined;
      const maxRadiusPx = req.query.maxRadiusPx ? Number(req.query.maxRadiusPx) : undefined;
      const slownessRef = req.query.slownessRef ? Number(req.query.slownessRef) : undefined;

      const spots = await visitedPlaceScalingService.getUserVisitedSpots(userId, {
        minRadiusPx,
        maxRadiusPx,
        slownessReferenceSpeed: slownessRef,
      });

      sendSuccess({
        res,
        message: `Retrieved ${spots.length} visited spots with slow-large scaling`,
        data: spots,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/places/user/map-layer
   * Get complete MapLibre/Mapbox GeoJSON FeatureCollection with scaled places & spots
   */
  async getUserPersonalizedMapLayer(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const userId = (req.query.userId as string) || user?.userId || user?.id || 'usr_traveler_01';

      const layer = await visitedPlaceScalingService.getUserPersonalizedMapLayer(userId);

      sendSuccess({
        res,
        message: 'Personalized map layer generated successfully',
        data: layer,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/places/user/calculate-scale
   * On-demand stateless batch calculator for place & spot scaling algorithms
   */
  async calculateDynamicScale(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body || {};
      const places = body.places || [];
      const spots = body.spots || [];
      const placeOptions = body.placeOptions || {};
      const spotOptions = body.spotOptions || {};

      const result = visitedPlaceScalingService.evaluateBatch(
        places,
        spots,
        placeOptions,
        spotOptions
      );

      sendSuccess({
        res,
        message: 'Dynamic scale factors calculated successfully',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }
}

export const placeController = new PlaceController();
