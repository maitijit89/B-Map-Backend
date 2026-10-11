import crypto from 'crypto';
import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { MasterPoiModel } from './master-poi.model';
import { Coordinate } from '../../core/types/geo.types';
import {
  MasterPoiProfile,
  RawCandidatePoi,
} from './data-mining.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';

export class PoiResolutionService {
  private inMemoryMasterPois = new Map<string, MasterPoiProfile>();

  /**
   * Computes Jaccard Token Text Similarity (0..1)
   */
  private computeTextSimilarity(str1: string, str2: string): number {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);

    const tokens1 = new Set(normalize(str1));
    const tokens2 = new Set(normalize(str2));

    if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
    if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

    let intersection = 0;
    for (const t of tokens1) {
      if (tokens2.has(t)) intersection++;
    }

    const union = new Set([...tokens1, ...tokens2]).size;
    const jaccard = intersection / union;

    // Substring boost if one contains the other
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1.includes(s2) || s2.includes(s1)) {
      return Math.max(jaccard, 0.85);
    }

    return jaccard;
  }

  /**
   * Computes multi-attribute hybrid match score between two POI candidates
   */
  computeMatchScore(p1: RawCandidatePoi, p2: RawCandidatePoi | MasterPoiProfile): number {
    const coords2 = 'coordinates' in p2 ? p2.coordinates : (p2 as any).location.coordinates;
    const name2 = 'canonicalName' in p2 ? p2.canonicalName : (p2 as RawCandidatePoi).name;

    // 1. Spatial distance decay (max match radius: 100 meters)
    const dist = calculateDistanceMeters(p1.coordinates, coords2);
    if (dist > 120) return 0.0; // Hard cutoff

    const geoSim = Math.max(0, 1.0 - dist / 100.0);

    // 2. Name text similarity
    const nameSim = this.computeTextSimilarity(p1.name, name2);

    // 3. Category similarity
    const catSim = p1.category.toLowerCase() === p2.category.toLowerCase() ? 1.0 : 0.4;

    // Weights: 45% Text, 40% Geospatial, 15% Category
    const totalScore = 0.45 * nameSim + 0.40 * geoSim + 0.15 * catSim;
    return Math.round(totalScore * 100) / 100;
  }

  /**
   * Deduplicates and merges candidate POIs into authoritative Master Golden Records
   */
  async resolveAndMergePois(candidates: RawCandidatePoi[]): Promise<MasterPoiProfile[]> {
    const results: MasterPoiProfile[] = [];

    for (const candidate of candidates) {
      // Find matching existing Master record
      let matchedMaster: MasterPoiProfile | null = null;
      let highestScore = 0;

      for (const master of this.inMemoryMasterPois.values()) {
        const score = this.computeMatchScore(candidate, master);
        if (score >= 0.70 && score > highestScore) {
          highestScore = score;
          matchedMaster = master;
        }
      }

      if (matchedMaster) {
        // Merge candidate into existing Master record
        if (!matchedMaster.aliases.includes(candidate.name) && candidate.name !== matchedMaster.canonicalName) {
          matchedMaster.aliases.push(candidate.name);
        }

        matchedMaster.mergedSourcesCount += 1;
        matchedMaster.visitCount30d += Math.round(candidate.confidenceScore * 20);
        matchedMaster.vitalityScore = Math.min(100, matchedMaster.vitalityScore + 5);
        matchedMaster.lastVerifiedAt = Date.now();
      } else {
        // Create new Master Golden Record
        const newMaster: MasterPoiProfile = {
          masterId: `mpoi_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          canonicalName: candidate.name,
          aliases: [],
          category: candidate.category,
          coordinates: candidate.coordinates,
          address: {
            street: candidate.address || 'Standard Road',
          },
          entrances: [
            {
              type: 'main',
              coordinates: candidate.coordinates,
              description: 'Main Front Entrance',
            },
          ],
          vitalityScore: Math.round(candidate.confidenceScore * 80),
          visitCount30d: Math.round(candidate.confidenceScore * 100),
          peakHours: { 12: 80, 13: 95, 18: 70, 19: 90 },
          freshnessStatus: 'active',
          mergedSourcesCount: 1,
          lastVerifiedAt: Date.now(),
        };

        this.inMemoryMasterPois.set(newMaster.masterId, newMaster);
        results.push(newMaster);

        // Persist to MongoDB if connected
        if (mongoose.connection.readyState === 1) {
          MasterPoiModel.findOneAndUpdate(
            { masterId: newMaster.masterId },
            {
              ...newMaster,
              location: { type: 'Point', coordinates: newMaster.coordinates },
            },
            { upsert: true }
          ).catch((err) => logger.warn(`Failed persisting MasterPoi: ${err.message}`));
        }
      }
    }

    return Array.from(this.inMemoryMasterPois.values());
  }

  /**
   * Evaluates POI freshness and flags business closure risk if visits have vanished
   */
  evaluateFreshness(poi: MasterPoiProfile, daysSinceLastObservedVisit: number): MasterPoiProfile {
    if (daysSinceLastObservedVisit > 45) {
      poi.freshnessStatus = 'verified_closed';
      poi.vitalityScore = 0;
    } else if (daysSinceLastObservedVisit > 20) {
      poi.freshnessStatus = 'defunct_risk';
      poi.vitalityScore = Math.max(10, poi.vitalityScore - 40);
    } else {
      poi.freshnessStatus = 'active';
    }
    return poi;
  }
}

export const poiResolutionService = new PoiResolutionService();
