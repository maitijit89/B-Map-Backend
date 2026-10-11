import mongoose from 'mongoose';
import { Coordinate } from '../../core/types/geo.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import { Building3DModel } from './building-3d.model';
import {
  Building3DProfile,
  BuildingFacadeMaterial,
  BuildingLodLevel,
  RoofShape,
} from './spatial-visualization.types';

export class Building3DService {
  /**
   * Seed standard iconic landmarks (e.g. Fernsehturm, Brandenburg Gate, Potsdamer Sony Center).
   */
  private landmarkRegistry: Map<string, Building3DProfile> = new Map([
    [
      'bld_fernsehturm',
      {
        buildingId: 'bld_fernsehturm',
        name: 'Berlin Television Tower (Fernsehturm)',
        footprint: [
          [13.4092, 52.5206],
          [13.4096, 52.5206],
          [13.4096, 52.5210],
          [13.4092, 52.5210],
          [13.4092, 52.5206],
        ],
        heightMeters: 368.0,
        minHeightMeters: 0,
        levels: 80,
        facadeMaterial: 'steel_panel',
        facadeColor: '#E5E7EB',
        roofShape: 'domed',
        roofColor: '#9CA3AF',
        lod: 'LOD3',
        isLandmark: true,
        landmarkModelUri: 'models/gltf/landmarks/berlin_fernsehturm.glb',
        lightingProfile: {
          nightGlow: true,
          windowEmissiveColor: '#FBBF24',
          rooftopBeacon: true,
        },
        bbox: [13.4092, 52.5206, 13.4096, 52.5210],
      },
    ],
    [
      'bld_brandenburg_gate',
      {
        buildingId: 'bld_brandenburg_gate',
        name: 'Brandenburg Gate (Brandenburger Tor)',
        footprint: [
          [13.3774, 52.5161],
          [13.3780, 52.5161],
          [13.3780, 52.5165],
          [13.3774, 52.5165],
          [13.3774, 52.5161],
        ],
        heightMeters: 26.0,
        minHeightMeters: 0,
        levels: 3,
        facadeMaterial: 'stone',
        facadeColor: '#D4C5B9',
        roofShape: 'flat',
        roofColor: '#847568',
        lod: 'LOD3',
        isLandmark: true,
        landmarkModelUri: 'models/gltf/landmarks/brandenburg_gate.glb',
        lightingProfile: {
          nightGlow: true,
          windowEmissiveColor: '#FDE047',
          rooftopBeacon: false,
        },
        bbox: [13.3774, 52.5161, 13.3780, 52.5165],
      },
    ],
    [
      'bld_sony_center',
      {
        buildingId: 'bld_sony_center',
        name: 'Potsdamer Platz Sony Center & Forum',
        footprint: [
          [13.3725, 52.5098],
          [13.3742, 52.5098],
          [13.3742, 52.5110],
          [13.3725, 52.5110],
          [13.3725, 52.5098],
        ],
        heightMeters: 103.0,
        minHeightMeters: 0,
        levels: 26,
        facadeMaterial: 'glass_curtain',
        facadeColor: '#38BDF8',
        roofShape: 'domed',
        roofColor: '#0284C7',
        lod: 'LOD2',
        isLandmark: true,
        landmarkModelUri: 'models/gltf/landmarks/sony_center.glb',
        lightingProfile: {
          nightGlow: true,
          windowEmissiveColor: '#38BDF8',
          rooftopBeacon: true,
        },
        bbox: [13.3725, 52.5098, 13.3742, 52.5110],
      },
    ],
  ]);

  /**
   * Get 3D buildings within a rectangular bounding box [west, south, east, north].
   */
  async getBuildingsInBounds(
    bbox: [number, number, number, number],
    requestedLod: BuildingLodLevel = 'LOD2'
  ): Promise<Building3DProfile[]> {
    const [west, south, east, north] = bbox;

    // 1. Check registered landmarks that intersect the bounding box
    const results: Building3DProfile[] = [];
    for (const landmark of this.landmarkRegistry.values()) {
      const [lWest, lSouth, lEast, lNorth] = landmark.bbox;
      const intersects =
        west <= lEast && east >= lWest && south <= lNorth && north >= lSouth;
      if (intersects) {
        results.push(this.adaptLod(landmark, requestedLod));
      }
    }

    // 2. Query MongoDB for stored buildings if database is connected
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await Building3DModel.find({
          'footprint.coordinates': {
            $geoWithin: {
              $box: [
                [west, south],
                [east, north],
              ],
            },
          },
        }).limit(100);

      for (const doc of docs) {
        if (!results.some((r) => r.buildingId === doc.buildingId)) {
          results.push(
            this.adaptLod(
              {
                buildingId: doc.buildingId,
                name: doc.name,
                footprint: doc.footprint.coordinates[0] as Coordinate[],
                heightMeters: doc.heightMeters,
                minHeightMeters: doc.minHeightMeters,
                levels: doc.levels,
                facadeMaterial: doc.facadeMaterial,
                facadeColor: doc.facadeColor,
                roofShape: doc.roofShape,
                roofColor: doc.roofColor,
                lod: doc.lod,
                isLandmark: doc.isLandmark,
                landmarkModelUri: doc.landmarkModelUri,
                lightingProfile: doc.lightingProfile,
                bbox: doc.bbox,
              },
              requestedLod
            )
          );
        }
      }
    } catch {
      // In-memory procedural fallback if DB is empty
    }
  }

    // 3. If very few buildings, procedurally generate a realistic city grid
    if (results.length < 5) {
      const proceduralBuildings = this.generateProceduralUrbanBlock(
        bbox,
        requestedLod
      );
      results.push(...proceduralBuildings);
    }

    return results;
  }

  /**
   * Get 3D buildings surrounding a center point within radius.
   */
  async getBuildingsNear(
    center: Coordinate,
    radiusMeters: number = 500,
    lod: BuildingLodLevel = 'LOD2'
  ): Promise<Building3DProfile[]> {
    const [lon, lat] = center;
    // Approximate bounding box delta: 1 deg lat ~ 111km, 1 deg lon ~ 111km * cos(lat)
    const latDelta = radiusMeters / 111000;
    const lonDelta = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

    const bbox: [number, number, number, number] = [
      lon - lonDelta,
      lat - latDelta,
      lon + lonDelta,
      lat + latDelta,
    ];

    const candidates = await this.getBuildingsInBounds(bbox, lod);

    return candidates.filter((b) => {
      // Calculate distance from center to first footprint vertex
      const dist = calculateDistanceMeters(center, b.footprint[0] || center);
      return dist <= radiusMeters * 1.2;
    });
  }

  /**
   * Adapts building profile to requested Level of Detail (LOD0 - LOD3).
   */
  private adaptLod(
    building: Building3DProfile,
    targetLod: BuildingLodLevel
  ): Building3DProfile {
    const copy = { ...building, lod: targetLod };
    if (targetLod === 'LOD0') {
      // LOD0: flat 2D footprint, no height/lighting
      copy.heightMeters = 0;
      copy.roofShape = 'flat';
      copy.lightingProfile = undefined;
    } else if (targetLod === 'LOD1') {
      // LOD1: extruded prism with flat top, no complex roofs
      copy.roofShape = 'flat';
      copy.facadeMaterial = 'concrete';
    }
    return copy;
  }

  /**
   * Procedural city generator that synthesizes realistic urban architectural blocks.
   */
  private generateProceduralUrbanBlock(
    bbox: [number, number, number, number],
    lod: BuildingLodLevel
  ): Building3DProfile[] {
    const [west, south, east, north] = bbox;
    const buildings: Building3DProfile[] = [];

    const lonStep = (east - west) / 4;
    const latStep = (north - south) / 4;

    const materials: BuildingFacadeMaterial[] = [
      'glass_curtain',
      'concrete',
      'brick',
      'steel_panel',
      'stone',
    ];
    const roofs: RoofShape[] = ['flat', 'gabled', 'hipped', 'domed'];
    const colors = ['#E2E8F0', '#CBD5E1', '#94A3B8', '#64748B', '#0284C7', '#F59E0B'];

    let counter = 1;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const bWest = west + i * lonStep + lonStep * 0.15;
        const bSouth = south + j * latStep + latStep * 0.15;
        const bEast = bWest + lonStep * 0.7;
        const bNorth = bSouth + latStep * 0.7;

        const footprint: Coordinate[] = [
          [bWest, bSouth],
          [bEast, bSouth],
          [bEast, bNorth],
          [bWest, bNorth],
          [bWest, bSouth],
        ];

        const levels = 3 + ((i * 7 + j * 13) % 25);
        const heightMeters = levels * 3.5;
        const mat = materials[(i + j) % materials.length];
        const roof = roofs[(i * 3 + j) % roofs.length];
        const color = colors[(i + j * 2) % colors.length];

        const id = `bld_proc_${Math.round(west * 1000)}_${counter++}`;

        buildings.push(
          this.adaptLod(
            {
              buildingId: id,
              name: `Urban Structure #${counter} (${levels}F)`,
              footprint,
              heightMeters: Math.round(heightMeters * 10) / 10,
              minHeightMeters: 0,
              levels,
              facadeMaterial: mat,
              facadeColor: color,
              roofShape: roof,
              roofColor: '#334155',
              lod,
              isLandmark: levels > 20,
              lightingProfile: {
                nightGlow: true,
                windowEmissiveColor: levels > 15 ? '#38BDF8' : '#FEF08A',
                rooftopBeacon: heightMeters > 70,
              },
              bbox: [bWest, bSouth, bEast, bNorth],
            },
            lod
          )
        );
      }
    }

    return buildings;
  }
}

export const building3DService = new Building3DService();
