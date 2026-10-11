import { Coordinate } from '../../core/types/geo.types';
import { building3DService } from './building-3d.service';
import {
  TileBoundingBox,
  TileCoordinate,
  TileLayerType,
  VectorTileLayerData,
  VectorTilePayload,
} from './spatial-visualization.types';

export class VectorTileService {
  /**
   * Converts longitude and latitude to Slippy map tile numbers (x, y) at a given zoom level.
   */
  lonLatToTile(lon: number, lat: number, zoom: number): TileCoordinate {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lon + 180) / 360) * n);
    const y = Math.floor(
      ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n
    );
    return { z: zoom, x: Math.max(0, x), y: Math.max(0, y) };
  }

  /**
   * Calculates geographic bounding box [west, south, east, north] for a tile (z, x, y).
   */
  tileToBoundingBox(coord: TileCoordinate): TileBoundingBox {
    const { z, x, y } = coord;
    const n = Math.pow(2, z);

    const west = (x / n) * 360 - 180;
    const east = ((x + 1) / n) * 360 - 180;

    const latRadNorth = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const north = (latRadNorth * 180) / Math.PI;

    const latRadSouth = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
    const south = (latRadSouth * 180) / Math.PI;

    return { west, south, east, north };
  }

  /**
   * Generates a multi-layer Vector Tile payload for a specific (z, x, y) tile.
   */
  async generateVectorTile(
    tileCoord: TileCoordinate,
    requestedLayers: TileLayerType[] = ['roads', 'buildings', 'water', 'pois']
  ): Promise<VectorTilePayload> {
    const bbox = this.tileToBoundingBox(tileCoord);
    const layers: Record<string, VectorTileLayerData> = {};
    let totalFeatures = 0;

    // 1. Buildings Layer
    if (requestedLayers.includes('buildings')) {
      const buildings = await building3DService.getBuildingsInBounds(
        [bbox.west, bbox.south, bbox.east, bbox.north],
        tileCoord.z >= 16 ? 'LOD2' : tileCoord.z >= 14 ? 'LOD1' : 'LOD0'
      );

      const buildingFeatures = buildings.map((b) => ({
        type: 'Feature' as const,
        id: b.buildingId,
        geometry: {
          type: 'Polygon',
          coordinates: [this.simplifyRing(b.footprint, tileCoord.z)],
        },
        properties: {
          name: b.name,
          height: b.heightMeters,
          levels: b.levels,
          material: b.facadeMaterial,
          roof: b.roofShape,
          lod: b.lod,
          isLandmark: b.isLandmark,
        },
      }));

      layers['buildings'] = {
        type: 'FeatureCollection',
        features: buildingFeatures,
      };
      totalFeatures += buildingFeatures.length;
    }

    // 2. Roads Layer (synthesize grid corridors clipped to tile bounds)
    if (requestedLayers.includes('roads')) {
      const roadFeatures = this.generateTileRoads(bbox, tileCoord.z);
      layers['roads'] = {
        type: 'FeatureCollection',
        features: roadFeatures,
      };
      totalFeatures += roadFeatures.length;
    }

    // 3. Waterways Layer
    if (requestedLayers.includes('water')) {
      const waterFeatures = this.generateTileWaterways(bbox, tileCoord.z);
      layers['water'] = {
        type: 'FeatureCollection',
        features: waterFeatures,
      };
      totalFeatures += waterFeatures.length;
    }

    // 4. POIs Layer
    if (requestedLayers.includes('pois') && tileCoord.z >= 13) {
      const poiFeatures = this.generateTilePois(bbox);
      layers['pois'] = {
        type: 'FeatureCollection',
        features: poiFeatures,
      };
      totalFeatures += poiFeatures.length;
    }

    const payloadJson = JSON.stringify(layers);
    const byteSize = Buffer.byteLength(payloadJson, 'utf8');

    return {
      tileCoord,
      bbox,
      layers,
      generatedAt: Date.now(),
      featureCount: totalFeatures,
      byteSize,
    };
  }

  /**
   * Douglas-Peucker-inspired polyline simplification based on zoom level.
   */
  private simplifyRing(ring: Coordinate[], zoom: number): Coordinate[] {
    if (ring.length <= 4 || zoom >= 17) return ring;

    // Tolerance in degrees (higher zoom = smaller tolerance)
    const tolerance = 0.0001 * Math.pow(2, 16 - zoom);
    const simplified: Coordinate[] = [ring[0]];

    for (let i = 1; i < ring.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const curr = ring[i];
      const dx = curr[0] - prev[0];
      const dy = curr[1] - prev[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= tolerance) {
        simplified.push(curr);
      }
    }

    simplified.push(ring[ring.length - 1]);
    return simplified.length >= 4 ? simplified : ring;
  }

  /**
   * Generates realistic road vector lines across tile bounds.
   */
  private generateTileRoads(bbox: TileBoundingBox, zoom: number): any[] {
    const { west, south, east, north } = bbox;
    const midLon = (west + east) / 2;
    const midLat = (south + north) / 2;

    const roads = [
      {
        type: 'Feature',
        id: `road_arterial_${zoom}_1`,
        geometry: {
          type: 'LineString',
          coordinates: [
            [west, midLat],
            [east, midLat],
          ],
        },
        properties: {
          class: 'primary',
          name: 'Main East-West Boulevard',
          lanes: 4,
          speedLimit: 50,
        },
      },
      {
        type: 'Feature',
        id: `road_arterial_${zoom}_2`,
        geometry: {
          type: 'LineString',
          coordinates: [
            [midLon, south],
            [midLon, north],
          ],
        },
        properties: {
          class: 'secondary',
          name: 'Central North-South Avenue',
          lanes: 2,
          speedLimit: 40,
        },
      },
    ];

    if (zoom >= 15) {
      roads.push({
        type: 'Feature',
        id: `road_local_${zoom}_3`,
        geometry: {
          type: 'LineString',
          coordinates: [
            [west + (east - west) * 0.25, south],
            [west + (east - west) * 0.25, north],
          ],
        },
        properties: {
          class: 'residential',
          name: 'Quiet Residential Lane',
          lanes: 1,
          speedLimit: 30,
        },
      });
    }

    return roads;
  }

  /**
   * Generates waterway polygons if intersecting tile.
   */
  private generateTileWaterways(bbox: TileBoundingBox, _zoom: number): any[] {
    const { west, south, east, north } = bbox;
    const riverSouth = south + (north - south) * 0.05;
    const riverNorth = south + (north - south) * 0.15;

    return [
      {
        type: 'Feature',
        id: 'water_spree_canal',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [west, riverSouth],
              [east, riverSouth],
              [east, riverNorth],
              [west, riverNorth],
              [west, riverSouth],
            ],
          ],
        },
        properties: {
          class: 'river',
          name: 'City Canal Waterway',
        },
      },
    ];
  }

  /**
   * Generates POI marker nodes within tile.
   */
  private generateTilePois(bbox: TileBoundingBox): any[] {
    const { west, south, east, north } = bbox;
    return [
      {
        type: 'Feature',
        id: 'poi_transit_hub',
        geometry: {
          type: 'Point',
          coordinates: [(west + east) / 2, (south + north) / 2],
        },
        properties: {
          name: 'Central Intermodal Terminal',
          category: 'transportation',
          icon: 'rail-metro',
        },
      },
    ];
  }
}

export const vectorTileService = new VectorTileService();
