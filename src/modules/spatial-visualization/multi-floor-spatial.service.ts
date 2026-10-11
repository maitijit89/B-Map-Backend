import { Coordinate } from '../../core/types/geo.types';
import {
  FloorElevationProfile,
  FloorLevel,
  ViaductFlyoverSection,
} from './spatial-visualization.types';

export class MultiFloorSpatialService {
  /**
   * Registry of multi-floor indoor facilities (e.g. Potsdamer Platz Station & Mall Hub).
   */
  private facilityFloors: Map<string, FloorElevationProfile[]> = new Map();

  /**
   * Registry of multi-deck elevated highway interchanges and flyovers.
   */
  private viaductSections: Map<string, ViaductFlyoverSection> = new Map();

  constructor() {
    this.seedDefaultFacilities();
  }

  /**
   * Get all stacked vertical floors for a facility.
   */
  getFacilityFloorStack(facilityId: string): FloorElevationProfile[] {
    return this.facilityFloors.get(facilityId) || [];
  }

  /**
   * Get a specific floor slice by level.
   */
  getFloorSlice(facilityId: string, level: FloorLevel): FloorElevationProfile | null {
    const floors = this.facilityFloors.get(facilityId);
    if (!floors) return null;
    return floors.find((f) => f.floorLevel === level) || null;
  }

  /**
   * Get multi-deck flyover and viaduct sections.
   */
  getViaductSections(corridorFilter?: string): ViaductFlyoverSection[] {
    const list = Array.from(this.viaductSections.values());
    if (corridorFilter) {
      return list.filter((s) =>
        s.corridorName.toLowerCase().includes(corridorFilter.toLowerCase())
      );
    }
    return list;
  }

  /**
   * Calculates 3D clearance envelope between an elevated deck and a surface corridor.
   */
  calculateFlyoverClearance(
    flyoverSectionId: string,
    surfaceElevationMeters: number = 0
  ): {
    verticalClearanceMeters: number;
    safeForHeavyGoodsVehicle: boolean;
    requiredClearanceMeters: number;
  } {
    const section = this.viaductSections.get(flyoverSectionId);
    const clearance = section
      ? section.clearanceHeightMeters - surfaceElevationMeters
      : 5.5;

    const requiredClearance = 4.5; // Standard 4.5m HGV clearance
    return {
      verticalClearanceMeters: Math.round(clearance * 10) / 10,
      safeForHeavyGoodsVehicle: clearance >= requiredClearance,
      requiredClearanceMeters: requiredClearance,
    };
  }

  /**
   * Seeds demo facilities: Multi-level transit hub and 3-tier highway flyover.
   */
  private seedDefaultFacilities(): void {
    const facilityId = 'fac_potsdamer_interchange';

    this.facilityFloors.set(facilityId, [
      {
        facilityId,
        floorLevel: -2,
        floorName: 'Level B2 (Underground Railway & Regional S-Bahn)',
        baseElevationMeters: -12.5,
        ceilingHeightMeters: 4.8,
        isUnderground: true,
        features: [
          {
            id: 'feat_platform_1_2',
            type: 'room',
            name: 'Platform Track 1 & 2 (Regional Express)',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [13.3755, 52.5092],
                  [13.3768, 52.5092],
                  [13.3768, 52.5096],
                  [13.3755, 52.5096],
                  [13.3755, 52.5092],
                ],
              ],
            },
            properties: { surface: 'granite_tile', tactilePaving: true },
          },
          {
            id: 'feat_escalator_b2_b1',
            type: 'staircase',
            name: 'Central Escalator Bank (To Concourse B1)',
            geometry: {
              type: 'Point',
              coordinates: [13.376, 52.5094],
            },
            properties: { connectsToFloor: -1, direction: 'two_way' },
          },
        ],
      },
      {
        facilityId,
        floorLevel: -1,
        floorName: 'Level B1 (Metro U-Bahn Concourse & Shopping Mall)',
        baseElevationMeters: -6.0,
        ceilingHeightMeters: 4.2,
        isUnderground: true,
        features: [
          {
            id: 'feat_concourse_b1',
            type: 'corridor',
            name: 'Main Ticketing Hall & Retail Concourse',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [13.375, 52.509],
                  [13.3772, 52.509],
                  [13.3772, 52.5102],
                  [13.375, 52.5102],
                  [13.375, 52.509],
                ],
              ],
            },
            properties: { shops: 18, ticketVendingMachines: 8 },
          },
        ],
      },
      {
        facilityId,
        floorLevel: 0,
        floorName: 'Ground Level (Street Entrances, Bus Station & Plaza)',
        baseElevationMeters: 0.0,
        ceilingHeightMeters: 6.0,
        isUnderground: false,
        features: [
          {
            id: 'feat_ground_plaza',
            type: 'corridor',
            name: 'Potsdamer Platz Pedestrian Esplanade',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [13.3745, 52.5085],
                  [13.378, 52.5085],
                  [13.378, 52.511],
                  [13.3745, 52.511],
                  [13.3745, 52.5085],
                ],
              ],
            },
            properties: { pedestrianOnly: true, bikeRacks: true },
          },
        ],
      },
      {
        facilityId,
        floorLevel: 1,
        floorName: 'Level 1 (Skybridge Walkway to Sony Center)',
        baseElevationMeters: 6.5,
        ceilingHeightMeters: 3.5,
        isUnderground: false,
        features: [
          {
            id: 'feat_skybridge_1',
            type: 'corridor',
            name: 'Enclosed Glass Skybridge Over Alte Potsdamer Str.',
            geometry: {
              type: 'LineString',
              coordinates: [
                [13.3752, 52.5098],
                [13.3745, 52.5102],
              ],
            },
            properties: { climateControlled: true, lengthMeters: 65 },
          },
        ],
      },
    ]);

    // 2. Viaduct & Flyover Multideck Interchange
    this.viaductSections.set('via_a100_tier1', {
      sectionId: 'via_a100_tier1',
      corridorName: 'City Ringway Elevated Viaduct (Deck Tier 1)',
      tierLevel: 1,
      clearanceHeightMeters: 6.2,
      gradePercentage: 1.8,
      surfaceType: 'concrete_deck',
      centerline3D: [
        [13.315, 52.501, 6.2],
        [13.318, 52.503, 6.5],
        [13.322, 52.506, 6.8],
      ],
      pillarCoordinates: [
        [13.315, 52.501],
        [13.318, 52.503],
        [13.322, 52.506],
      ],
    });

    this.viaductSections.set('via_a100_tier2_flyover', {
      sectionId: 'via_a100_tier2_flyover',
      corridorName: 'Grand Interchange Upper Flyover Ramp (Deck Tier 2)',
      tierLevel: 2,
      clearanceHeightMeters: 14.5,
      gradePercentage: 4.2,
      surfaceType: 'steel_truss',
      centerline3D: [
        [13.314, 52.500, 8.0],
        [13.318, 52.503, 14.5],
        [13.324, 52.507, 10.2],
      ],
      pillarCoordinates: [
        [13.314, 52.500],
        [13.318, 52.503],
        [13.324, 52.507],
      ],
    });
  }
}

export const multiFloorSpatialService = new MultiFloorSpatialService();
