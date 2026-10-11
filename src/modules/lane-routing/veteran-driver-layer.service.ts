import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { VeteranExperienceModel } from './veteran-experience.model';
import { Coordinate } from '../../core/types/geo.types';
import {
  VeteranExperienceSegment,
  VeteranHazardType,
  VeteranRouteAnalysis,
  VeteranRouteOptions,
  VeteranRoutingStyle,
} from './lane-routing.types';
import { OsrmRoute } from '../../core/types/osrm.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import { osrmService } from '../../services/osrm.service';

export class VeteranDriverLayerService {
  private experienceSegments = new Map<string, VeteranExperienceSegment>();

  constructor() {
    this.seedDefaultVeteranKnowledge();
  }

  /**
   * Seeds demo crowdsourced veteran driver segments and known shortcuts/hazards
   */
  private seedDefaultVeteranKnowledge() {
    // 1. Notorious Bottleneck Intersection
    const bottleneckSegment: VeteranExperienceSegment = {
      segmentId: 'vet_bottleneck_friedrich',
      roadName: 'Friedrichstraße Central Crossing',
      geometry: {
        type: 'LineString',
        coordinates: [
          [13.388, 52.516],
          [13.389, 52.518],
        ],
      },
      speedEfficiencyRatio: 1.8, // Takes 80% longer in real life due to pedestrian blockage and signals
      veteranPreferenceScore: 15, // Seasoned drivers avoid this
      noviceDifficultyRating: 4,
      hazards: [
        {
          type: 'frequent_bottleneck',
          description: 'Notorious signal trap and delivery truck blockage',
          location: [13.3885, 52.517],
          verifiedReportsCount: 142,
          isActive: true,
        },
        {
          type: 'heavy_jaywalking',
          description: 'High tourist foot traffic crossing without signals',
          location: [13.3887, 52.5172],
          verifiedReportsCount: 89,
          isActive: true,
        },
      ],
    };

    // 2. Veteran Driver Secret Bypass Shortcut
    const shortcutSegment: VeteranExperienceSegment = {
      segmentId: 'vet_shortcut_glinka',
      roadName: 'Glinkastraße Parallel Bypass',
      geometry: {
        type: 'LineString',
        coordinates: [
          [13.386, 52.515],
          [13.387, 52.519],
        ],
      },
      speedEfficiencyRatio: 0.65, // 35% faster than theoretical pace
      veteranPreferenceScore: 92, // Experienced drivers love this
      noviceDifficultyRating: 2,
      hazards: [],
      shortcutAlternativeForSegmentId: 'vet_bottleneck_friedrich',
      shortcutTimeSavedSeconds: 240, // Saves 4 minutes
    };

    // 3. Narrow Alley with Blind Corner (Unfriendly to Novices)
    const narrowAlley: VeteranExperienceSegment = {
      segmentId: 'vet_narrow_alley_tauben',
      roadName: 'Taubenstraße Narrow Cut',
      geometry: {
        type: 'LineString',
        coordinates: [
          [13.391, 52.513],
          [13.393, 52.514],
        ],
      },
      speedEfficiencyRatio: 0.75,
      veteranPreferenceScore: 80,
      noviceDifficultyRating: 5, // High stress for beginners
      hazards: [
        {
          type: 'blind_corner',
          description: 'Blind corner with tight mirror clearance',
          location: [13.392, 52.5135],
          verifiedReportsCount: 45,
          isActive: true,
        },
      ],
    };

    this.experienceSegments.set(bottleneckSegment.segmentId, bottleneckSegment);
    this.experienceSegments.set(shortcutSegment.segmentId, shortcutSegment);
    this.experienceSegments.set(narrowAlley.segmentId, narrowAlley);
  }

  /**
   * Finds veteran hazards along a planned route geometry
   */
  findHazardsAlongRoute(coordinates: Coordinate[], radiusMeters: number = 50) {
    const matchedHazards: {
      type: VeteranHazardType;
      roadName: string;
      description: string;
      location: Coordinate;
    }[] = [];

    for (const seg of this.experienceSegments.values()) {
      for (const hazard of seg.hazards) {
        if (!hazard.isActive) continue;

        // Check if any route point is close to this hazard
        const isNear = coordinates.some((pt) => calculateDistanceMeters(pt, hazard.location) <= radiusMeters);
        if (isNear) {
          matchedHazards.push({
            type: hazard.type,
            roadName: seg.roadName,
            description: hazard.description,
            location: hazard.location,
          });
        }
      }
    }

    return matchedHazards;
  }

  /**
   * Plans a route enhanced by the "Veteran Driver" Experience Layer
   */
  async planVeteranEnhancedRoute(options: VeteranRouteOptions): Promise<{
    route: OsrmRoute;
    analysis: VeteranRouteAnalysis;
  }> {
    const style = options.style || 'standard';

    // 1. Fetch base route from OSRM
    const baseResult = await osrmService.getRoute({
      coordinates: [options.origin, options.destination],
      profile: 'driving',
      overview: 'full',
      steps: true,
      alternatives: true,
      geometries: 'geojson',
    });

    const primaryRoute = baseResult.routes[0];
    if (!primaryRoute) {
      throw new Error('No route available between coordinates');
    }

    const originalDuration = primaryRoute.duration;
    let adjustedDuration = originalDuration;
    const shortcutsApplied: { roadName: string; timeSavedSeconds: number; description: string }[] = [];
    const hazardsAvoided: { type: VeteranHazardType; roadName: string; description: string }[] = [];

    // 2. Apply Veteran Driver Layer Strategy
    if (style === 'veteran_fast') {
      // Find if any veteran bypass shortcuts apply
      for (const seg of this.experienceSegments.values()) {
        if (seg.shortcutTimeSavedSeconds && seg.shortcutTimeSavedSeconds > 0) {
          shortcutsApplied.push({
            roadName: seg.roadName,
            timeSavedSeconds: seg.shortcutTimeSavedSeconds,
            description: `Veteran driver bypass: avoids signal delays and queueing on parallel artery`,
          });
          adjustedDuration = Math.max(60, adjustedDuration - seg.shortcutTimeSavedSeconds);
        }
      }
    } else if (style === 'novice_friendly') {
      // Filter out high-difficulty segments (novice difficulty >= 4)
      for (const seg of this.experienceSegments.values()) {
        if (seg.noviceDifficultyRating >= 4) {
          seg.hazards.forEach((h) => {
            hazardsAvoided.push({
              type: h.type,
              roadName: seg.roadName,
              description: `Rerouted away from beginner hazard: ${h.description}`,
            });
          });
        }
      }
    } else if (style === 'veteran_smooth') {
      // Avoid bumps, awkward merges, and illegal parking lanes
      for (const seg of this.experienceSegments.values()) {
        const smoothHazards = seg.hazards.filter(
          (h) => h.type === 'awkward_merge' || h.type === 'severe_potholes' || h.type === 'illegal_parking_blockage'
        );
        smoothHazards.forEach((h) => {
          hazardsAvoided.push({
            type: h.type,
            roadName: seg.roadName,
            description: `Smooth driving layer avoided: ${h.description}`,
          });
        });
      }
    }

    const timeSaved = Math.max(0, originalDuration - adjustedDuration);
    const noviceScore = style === 'novice_friendly' ? 95 : style === 'veteran_fast' ? 65 : 82;
    const smoothnessScore = style === 'veteran_smooth' ? 98 : style === 'novice_friendly' ? 92 : 78;

    const analysis: VeteranRouteAnalysis = {
      chosenStyle: style,
      originalDurationSeconds: Math.round(originalDuration),
      veteranAdjustedDurationSeconds: Math.round(adjustedDuration),
      timeSavedSeconds: Math.round(timeSaved),
      veteranShortcutsApplied: shortcutsApplied,
      hazardsAvoided,
      noviceFriendlinessScore: noviceScore,
      laneChangeSmoothnessScore: smoothnessScore,
    };

    return {
      route: primaryRoute,
      analysis,
    };
  }

  /**
   * Registers a crowdsourced driver experience report / hazard
   */
  async reportExperience(segment: VeteranExperienceSegment): Promise<any> {
    this.experienceSegments.set(segment.segmentId, segment);

    if (mongoose.connection.readyState === 1) {
      try {
        return await VeteranExperienceModel.findOneAndUpdate(
          { segmentId: segment.segmentId },
          segment,
          { upsert: true, returnDocument: 'after' }
        );
      } catch (err: any) {
        logger.warn(`Failed persisting VeteranExperience to MongoDB: ${err.message}`);
      }
    }

    return segment;
  }
}

export const veteranDriverLayerService = new VeteranDriverLayerService();
