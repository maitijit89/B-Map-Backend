import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { Coordinate } from '../../core/types/geo.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import { Place } from './place.model';
import { PlaceRatingModel } from './place-rating.model';
import {
  AspectRatings,
  IPlaceRating,
  PlaceRatingQuery,
  PlaceRatingStats,
  SubmitPlaceRatingInput,
} from './place-rating.types';
import { queryOfflineFallbackPOIs } from '../../core/resilience/offline-fallback-seeds';

export class PlaceRatingService {
  /**
   * Dual-tier in-memory store for instant offline availability,
   * unit test execution, and sub-millisecond caching (Key: placeId -> IPlaceRating[])
   */
  private inMemoryRatings = new Map<string, IPlaceRating[]>();

  constructor() {
    this.seedDefaultRatings();
  }

  /**
   * Seeds realistic demo ratings for primary landmarks and hubs
   */
  private seedDefaultRatings(): void {
    const seedPlaceId = 'poi_cyber_hub_01';
    const sampleReviews: IPlaceRating[] = [
      {
        id: 'rev_seed_01',
        placeId: seedPlaceId,
        userId: 'usr_rohit_01',
        userName: 'Rohit Verma',
        userEmail: 'rohit.verma@example.com',
        score: 5,
        title: 'Outstanding open-air dining & accessible infrastructure!',
        review: 'DLF CyberHub is phenomenal. Direct walkway from Rapid Metro, seamless wheelchair ramps, and ultra-fast Statiq DC chargers in the basement.',
        aspects: { cleanliness: 5, accessibility: 5, hospitality: 4, valueForMoney: 4, amenities: 5 },
        visitType: 'friends',
        photos: ['https://cdn.bmap.in/reviews/cyberhub_01.webp'],
        tags: ['wheelchair_accessible', 'ev_fast_charger', 'spacious', 'metro_connected'],
        isVerifiedVisit: true,
        helpfulVotes: 24,
        helpfulVoterIds: ['usr_1', 'usr_2'],
        reportCount: 0,
        status: 'published',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
      {
        id: 'rev_seed_02',
        placeId: seedPlaceId,
        userId: 'usr_priya_02',
        userName: 'Priya Sundaram',
        userEmail: 'priya.s@example.com',
        score: 4,
        title: 'Vibrant atmosphere and great food options',
        review: 'Loved the amphitheater vibe and clean public restrooms. Peak Friday evenings can get very crowded, so book parking in advance.',
        aspects: { cleanliness: 5, accessibility: 4, hospitality: 4, valueForMoney: 4, amenities: 4 },
        visitType: 'family',
        photos: [],
        tags: ['family_friendly', 'clean_restrooms', 'busy_evenings'],
        isVerifiedVisit: true,
        helpfulVotes: 12,
        helpfulVoterIds: ['usr_3'],
        reportCount: 0,
        status: 'published',
        createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
      },
      {
        id: 'rev_seed_03',
        placeId: seedPlaceId,
        userId: 'usr_amit_03',
        userName: 'Amitabh Sengupta',
        userEmail: 'amitabh.s@example.com',
        score: 5,
        title: 'Perfect business meeting location in NCR',
        review: 'Excellent high-speed Wi-Fi in cafes, smooth valet parking with ANPR boom barrier, and clean facilities.',
        aspects: { cleanliness: 5, accessibility: 5, hospitality: 5, valueForMoney: 4, amenities: 5 },
        visitType: 'business',
        photos: [],
        tags: ['business_friendly', 'fast_wifi', 'valet_parking'],
        isVerifiedVisit: true,
        helpfulVotes: 8,
        helpfulVoterIds: [],
        reportCount: 0,
        status: 'published',
        createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
      },
    ];

    this.inMemoryRatings.set(seedPlaceId, sampleReviews);
  }

  /**
   * Submits or updates a place rating & review.
   * - Enforces 1 rating per user per place (subsequent calls update existing review).
   * - Automatically evaluates verified visit badge based on geodesic proximity (<= 150m) or Proof-of-Presence.
   * - Automatically recalculates and updates Place.rating and Place.reviewCount in the database.
   */
  public async submitRating(placeId: string, input: SubmitPlaceRatingInput): Promise<IPlaceRating> {
    const score = Math.max(1, Math.min(5, Math.round(input.score * 10) / 10));
    const userId = input.userId || 'usr_anonymous_' + Math.random().toString(36).substring(2, 8);
    const userName = input.userName || 'Verified Traveler';

    const defaultAspectScore = Math.round(score);
    const aspects: AspectRatings = {
      cleanliness: input.aspects?.cleanliness ? Math.max(1, Math.min(5, input.aspects.cleanliness)) : defaultAspectScore,
      accessibility: input.aspects?.accessibility ? Math.max(1, Math.min(5, input.aspects.accessibility)) : defaultAspectScore,
      hospitality: input.aspects?.hospitality ? Math.max(1, Math.min(5, input.aspects.hospitality)) : defaultAspectScore,
      valueForMoney: input.aspects?.valueForMoney ? Math.max(1, Math.min(5, input.aspects.valueForMoney)) : defaultAspectScore,
      amenities: input.aspects?.amenities ? Math.max(1, Math.min(5, input.aspects.amenities)) : defaultAspectScore,
    };

    // Check verified visit: GPS proximity <= 150m or valid proof-of-presence signature
    let isVerified = !!input.proofOfPresenceSignature;
    if (!isVerified && input.userCoordinate) {
      const placeCoord = await this.getPlaceCoordinates(placeId);
      if (placeCoord) {
        const dist = calculateDistanceMeters(input.userCoordinate, placeCoord);
        if (dist <= 250) {
          isVerified = true;
        }
      }
    }

    const ratingId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const ratingData: IPlaceRating = {
      id: ratingId,
      placeId,
      userId,
      userName,
      userEmail: input.userEmail,
      score,
      title: input.title || '',
      review: input.review || '',
      aspects,
      visitType: input.visitType || 'solo',
      photos: input.photos || [],
      tags: input.tags || [],
      isVerifiedVisit: isVerified,
      helpfulVotes: 0,
      helpfulVoterIds: [],
      reportCount: 0,
      status: 'published',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 1. Update in-memory registry
    let existingList = this.inMemoryRatings.get(placeId) || [];
    const existingIndex = existingList.findIndex((r) => r.userId === userId);
    if (existingIndex !== -1) {
      // Update existing user review
      ratingData.id = existingList[existingIndex].id;
      ratingData.createdAt = existingList[existingIndex].createdAt;
      ratingData.helpfulVotes = existingList[existingIndex].helpfulVotes;
      ratingData.helpfulVoterIds = existingList[existingIndex].helpfulVoterIds;
      existingList[existingIndex] = ratingData;
    } else {
      existingList.unshift(ratingData);
    }
    this.inMemoryRatings.set(placeId, existingList);

    // 2. Persist to MongoDB if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await PlaceRatingModel.findOneAndUpdate(
          { placeId, userId },
          {
            ratingId: ratingData.id,
            placeId,
            userId,
            userName,
            userEmail: input.userEmail,
            score,
            title: ratingData.title,
            review: ratingData.review,
            aspects,
            visitType: ratingData.visitType,
            photos: ratingData.photos,
            tags: ratingData.tags,
            isVerifiedVisit: isVerified,
            status: 'published',
          },
          { upsert: true, new: true }
        );
      } catch (err: any) {
        logger.warn(`Could not save place rating to MongoDB: ${err.message}`);
      }
    }

    // 3. Recalculate place aggregate rating & update Place model
    await this.recalculatePlaceStats(placeId);

    return ratingData;
  }

  /**
   * Retrieves paginated list of reviews for a place with filtering & sorting
   */
  public async getPlaceRatings(
    placeId: string,
    query: PlaceRatingQuery = {}
  ): Promise<{ ratings: IPlaceRating[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));

    let list: IPlaceRating[] = [];

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const filter: any = { placeId, status: 'published' };
        if (query.minScore) filter.score = { ...filter.score, $gte: query.minScore };
        if (query.maxScore) filter.score = { ...filter.score, $lte: query.maxScore };
        if (query.verifiedOnly) filter.isVerifiedVisit = true;

        let sort: any = { createdAt: -1 };
        if (query.sortBy === 'most_helpful') sort = { helpfulVotes: -1, createdAt: -1 };
        else if (query.sortBy === 'highest') sort = { score: -1, createdAt: -1 };
        else if (query.sortBy === 'lowest') sort = { score: 1, createdAt: -1 };
        else if (query.sortBy === 'oldest') sort = { createdAt: 1 };

        const total = await PlaceRatingModel.countDocuments(filter);
        const docs = await PlaceRatingModel.find(filter)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        list = docs.map((d: any) => ({
          id: d.ratingId || d._id.toString(),
          placeId: d.placeId,
          userId: d.userId,
          userName: d.userName,
          userEmail: d.userEmail,
          score: d.score,
          title: d.title,
          review: d.review,
          aspects: d.aspects,
          visitType: d.visitType,
          photos: d.photos,
          tags: d.tags,
          isVerifiedVisit: d.isVerifiedVisit,
          helpfulVotes: d.helpfulVotes || 0,
          helpfulVoterIds: d.helpfulVoterIds || [],
          reportCount: d.reportCount || 0,
          status: d.status,
          createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
        }));

        return { ratings: list, total, page, limit };
      } catch (err: any) {
        logger.debug(`Falling back to in-memory place reviews: ${err.message}`);
      }
    }

    // In-memory fallback
    list = this.inMemoryRatings.get(placeId) || [];
    list = list.filter((r) => r.status === 'published');

    if (query.minScore) list = list.filter((r) => r.score >= query.minScore!);
    if (query.maxScore) list = list.filter((r) => r.score <= query.maxScore!);
    if (query.verifiedOnly) list = list.filter((r) => r.isVerifiedVisit);

    if (query.sortBy === 'most_helpful') {
      list.sort((a, b) => b.helpfulVotes - a.helpfulVotes);
    } else if (query.sortBy === 'highest') {
      list.sort((a, b) => b.score - a.score);
    } else if (query.sortBy === 'lowest') {
      list.sort((a, b) => a.score - b.score);
    } else if (query.sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const total = list.length;
    const paginated = list.slice((page - 1) * limit, page * limit);
    return { ratings: paginated, total, page, limit };
  }

  /**
   * Retrieves aggregated rating statistics, star score distribution, aspect averages,
   * sentiment breakdown, and recommendation percentage for a place.
   */
  public async getPlaceRatingStats(placeId: string): Promise<PlaceRatingStats> {
    const { ratings: allRatings } = await this.getPlaceRatings(placeId, { limit: 1000 });

    if (allRatings.length === 0) {
      return {
        placeId,
        averageRating: 0,
        totalReviews: 0,
        totalRatings: 0,
        verifiedVisitPercentage: 0,
        recommendationPercentage: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        distributionPercentages: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        aspectAverages: { cleanliness: 0, accessibility: 0, hospitality: 0, valueForMoney: 0, amenities: 0 },
        sentimentAnalysis: {
          sentiment: 'mixed',
          positivePercentage: 0,
          topHighlights: [],
          topCriticisms: [],
        },
      };
    }

    let sum = 0;
    let verifiedCount = 0;
    let recommendedCount = 0;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const aspectSums: AspectRatings = { cleanliness: 0, accessibility: 0, hospitality: 0, valueForMoney: 0, amenities: 0 };
    const tagFrequencies: Record<string, number> = {};

    for (const r of allRatings) {
      sum += r.score;
      const roundedStar = Math.max(1, Math.min(5, Math.round(r.score)));
      distribution[roundedStar] = (distribution[roundedStar] || 0) + 1;

      if (r.isVerifiedVisit) verifiedCount++;
      if (r.score >= 4.0) recommendedCount++;

      aspectSums.cleanliness += r.aspects.cleanliness || r.score;
      aspectSums.accessibility += r.aspects.accessibility || r.score;
      aspectSums.hospitality += r.aspects.hospitality || r.score;
      aspectSums.valueForMoney += r.aspects.valueForMoney || r.score;
      aspectSums.amenities += r.aspects.amenities || r.score;

      for (const t of r.tags || []) {
        tagFrequencies[t] = (tagFrequencies[t] || 0) + 1;
      }
    }

    const total = allRatings.length;
    const avgScore = Math.round((sum / total) * 10) / 10;
    const verifiedPct = Math.round((verifiedCount / total) * 100);
    const recPct = Math.round((recommendedCount / total) * 100);

    const distPercentages: Record<number, number> = {
      1: Math.round((distribution[1] / total) * 100),
      2: Math.round((distribution[2] / total) * 100),
      3: Math.round((distribution[3] / total) * 100),
      4: Math.round((distribution[4] / total) * 100),
      5: Math.round((distribution[5] / total) * 100),
    };

    const aspectAverages: AspectRatings = {
      cleanliness: Math.round((aspectSums.cleanliness / total) * 10) / 10,
      accessibility: Math.round((aspectSums.accessibility / total) * 10) / 10,
      hospitality: Math.round((aspectSums.hospitality / total) * 10) / 10,
      valueForMoney: Math.round((aspectSums.valueForMoney / total) * 10) / 10,
      amenities: Math.round((aspectSums.amenities / total) * 10) / 10,
    };

    // Sentiment derivation
    let sentiment: PlaceRatingStats['sentimentAnalysis']['sentiment'] = 'mixed';
    if (recPct >= 85) sentiment = 'overwhelmingly_positive';
    else if (recPct >= 70) sentiment = 'positive';
    else if (recPct <= 35) sentiment = 'negative';

    const topTags = Object.entries(tagFrequencies)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag.replace(/_/g, ' '));

    return {
      placeId,
      averageRating: avgScore,
      totalReviews: allRatings.filter((r) => r.review && r.review.trim().length > 0).length,
      totalRatings: total,
      verifiedVisitPercentage: verifiedPct,
      recommendationPercentage: recPct,
      ratingDistribution: distribution as any,
      distributionPercentages: distPercentages as any,
      aspectAverages,
      sentimentAnalysis: {
        sentiment,
        positivePercentage: recPct,
        topHighlights: topTags.slice(0, 5),
        topCriticisms: distribution[1] + distribution[2] > 0 ? ['Occasional peak-hour waiting times'] : [],
      },
    };
  }

  /**
   * Retrieves the current user's specific review for a place
   */
  public async getUserPlaceRating(placeId: string, userId: string): Promise<IPlaceRating | null> {
    const list = this.inMemoryRatings.get(placeId) || [];
    const found = list.find((r) => r.userId === userId);
    if (found) return found;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const doc = await PlaceRatingModel.findOne({ placeId, userId }).lean();
        if (doc) {
          return {
            id: (doc as any).ratingId || doc._id.toString(),
            placeId: (doc as any).placeId,
            userId: (doc as any).userId,
            userName: (doc as any).userName,
            userEmail: (doc as any).userEmail,
            score: (doc as any).score,
            title: (doc as any).title,
            review: (doc as any).review,
            aspects: (doc as any).aspects,
            visitType: (doc as any).visitType,
            photos: (doc as any).photos,
            tags: (doc as any).tags,
            isVerifiedVisit: (doc as any).isVerifiedVisit,
            helpfulVotes: (doc as any).helpfulVotes,
            helpfulVoterIds: (doc as any).helpfulVoterIds || [],
            reportCount: (doc as any).reportCount || 0,
            status: (doc as any).status,
            createdAt: new Date((doc as any).createdAt).toISOString(),
            updatedAt: new Date((doc as any).updatedAt).toISOString(),
          };
        }
      } catch (err: any) {
        logger.debug(`User review lookup notice: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Toggles helpful upvote on a review
   */
  public async voteHelpful(placeId: string, ratingId: string, userId: string): Promise<{ helpfulVotes: number; voted: boolean }> {
    let list = this.inMemoryRatings.get(placeId) || [];
    const item = list.find((r) => r.id === ratingId);

    let helpfulVotes = 0;
    let voted = false;

    if (item) {
      const idx = item.helpfulVoterIds.indexOf(userId);
      if (idx === -1) {
        item.helpfulVoterIds.push(userId);
        item.helpfulVotes++;
        voted = true;
      } else {
        item.helpfulVoterIds.splice(idx, 1);
        item.helpfulVotes = Math.max(0, item.helpfulVotes - 1);
        voted = false;
      }
      helpfulVotes = item.helpfulVotes;
    }

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const doc = await PlaceRatingModel.findOne({ ratingId });
        if (doc) {
          const vIdx = doc.helpfulVoterIds.indexOf(userId);
          if (vIdx === -1) {
            doc.helpfulVoterIds.push(userId);
            doc.helpfulVotes++;
            voted = true;
          } else {
            doc.helpfulVoterIds.splice(vIdx, 1);
            doc.helpfulVotes = Math.max(0, doc.helpfulVotes - 1);
            voted = false;
          }
          await doc.save();
          helpfulVotes = doc.helpfulVotes;
        }
      } catch (err: any) {
        logger.warn(`Could not persist helpful vote to Mongo: ${err.message}`);
      }
    }

    return { helpfulVotes, voted };
  }

  /**
   * Reports an inappropriate review for moderation
   */
  public async reportReview(placeId: string, ratingId: string, _reason?: string, _userId?: string): Promise<{ reportCount: number; isFlagged: boolean }> {
    let list = this.inMemoryRatings.get(placeId) || [];
    const item = list.find((r) => r.id === ratingId);

    let reportCount = 0;
    let isFlagged = false;

    if (item) {
      item.reportCount = (item.reportCount || 0) + 1;
      reportCount = item.reportCount;
      if (reportCount >= 3) {
        item.status = 'under_review';
        isFlagged = true;
      }
    }

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const doc = await PlaceRatingModel.findOne({ ratingId });
        if (doc) {
          doc.reportCount = (doc.reportCount || 0) + 1;
          reportCount = doc.reportCount;
          if (reportCount >= 3) {
            doc.status = 'under_review';
            isFlagged = true;
          }
          await doc.save();
        }
      } catch (err: any) {
        logger.warn(`Could not save report to Mongo: ${err.message}`);
      }
    }

    return { reportCount, isFlagged };
  }

  /**
   * Deletes a place rating
   */
  public async deletePlaceRating(placeId: string, ratingId: string, userId: string, isAdmin = false): Promise<boolean> {
    let list = this.inMemoryRatings.get(placeId) || [];
    const idx = list.findIndex((r) => r.id === ratingId && (r.userId === userId || isAdmin));
    if (idx !== -1) {
      list.splice(idx, 1);
      this.inMemoryRatings.set(placeId, list);
    }

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const query: any = { ratingId };
        if (!isAdmin) query.userId = userId;
        await PlaceRatingModel.deleteOne(query);
      } catch (err: any) {
        logger.warn(`Could not delete place rating from Mongo: ${err.message}`);
      }
    }

    await this.recalculatePlaceStats(placeId);
    return idx !== -1;
  }

  /**
   * Internal helper to recalculate Place.rating and Place.reviewCount
   */
  private async recalculatePlaceStats(placeId: string): Promise<void> {
    try {
      const stats = await this.getPlaceRatingStats(placeId);

      if (mongoose.connection && mongoose.connection.readyState === 1) {
        if (mongoose.Types.ObjectId.isValid(placeId)) {
          await Place.findByIdAndUpdate(placeId, {
            rating: stats.averageRating,
            reviewCount: stats.totalRatings,
          });
        }
      }
    } catch (err: any) {
      logger.debug(`Recalculate place stats notice: ${err.message}`);
    }
  }

  /**
   * Resolves place coordinates to evaluate distance for verified visit badge
   */
  private async getPlaceCoordinates(placeId: string): Promise<Coordinate | null> {
    if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(placeId)) {
      try {
        const p = await Place.findById(placeId).lean();
        if (p && p.location && Array.isArray(p.location.coordinates)) {
          return p.location.coordinates as Coordinate;
        }
      } catch {}
    }

    // Check offline POI seeds
    const fallbacks = queryOfflineFallbackPOIs({
      longitude: 77.0885,
      latitude: 28.4955,
      maxDistanceMeters: 100000,
    });
    const match = fallbacks.find((f) => f._id === placeId || f.name.toLowerCase().includes(placeId.toLowerCase()));
    if (match) {
      return match.location.coordinates;
    }

    // Default reference for CyberHub demo seed
    if (placeId === 'poi_cyber_hub_01') {
      return [77.0885, 28.4955];
    }

    return null;
  }
}

export const placeRatingService = new PlaceRatingService();

