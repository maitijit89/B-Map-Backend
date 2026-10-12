import { LatLng } from '../../core/utils/response';
import {
  ClusterPoint,
  MapboxStyleSpec,
  MapTheme,
  StaticMapRequest,
} from './maps-tiles.types';

export class MapsTilesService {
  public generateStyleJSON(baseURL: string, theme: MapTheme = 'standard'): MapboxStyleSpec {
    const tileURL = `${baseURL}/api/v1/tiles/{z}/{x}/{y}`;

    let bgColor = '#f8f4f0';
    let waterColor = '#a0c8f0';
    let roadColor = '#ffffff';
    let roadBorderColor = '#e0e0e0';
    let textColor = '#333333';

    switch (theme) {
      case 'dark':
      case 'night':
        bgColor = '#181a1b';
        waterColor = '#0e2a47';
        roadColor = '#2c2f33';
        roadBorderColor = '#23272a';
        textColor = '#e0e0e0';
        break;
      case 'retro':
        bgColor = '#dfd2ae';
        waterColor = '#b4d3d4';
        roadColor = '#fbf6d8';
        roadBorderColor = '#e9dcaf';
        textColor = '#665e49';
        break;
      case 'silver':
        bgColor = '#f5f5f5';
        waterColor = '#c9c9c9';
        roadColor = '#ffffff';
        roadBorderColor = '#e5e5e5';
        textColor = '#4a4a4a';
        break;
      case 'aubergine':
        bgColor = '#1d2c4d';
        waterColor = '#0e1626';
        roadColor = '#2b3e6b';
        roadBorderColor = '#1a2540';
        textColor = '#8ec3b9';
        break;
    }

    return {
      version: 8,
      name: `B-Map ${theme}`,
      center: [77.2177, 28.6304],
      zoom: 13,
      sources: {
        bmap_vector_source: {
          type: 'vector',
          tiles: [tileURL],
          minzoom: 0,
          maxzoom: 22,
        },
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': bgColor,
          },
        },
        {
          id: 'water',
          type: 'fill',
          source: 'bmap_vector_source',
          paint: {
            'fill-color': waterColor,
          },
        },
        {
          id: 'roads-case',
          type: 'line',
          source: 'bmap_vector_source',
          paint: {
            'line-color': roadBorderColor,
            'line-width': 4,
          },
        },
        {
          id: 'roads',
          type: 'line',
          source: 'bmap_vector_source',
          paint: {
            'line-color': roadColor,
            'line-width': 2.5,
          },
        },
        {
          id: 'territorial-official-red-border',
          type: 'line',
          source: 'bmap_vector_source',
          paint: {
            'line-color': '#d93025',
            'line-width': 2.5,
            'line-opacity': 0.95,
          },
        },
        {
          id: 'places-poi',
          type: 'circle',
          source: 'bmap_vector_source',
          paint: {
            'circle-radius': 6,
            'circle-color': '#ff4757',
            'circle-stroke-width': 2,
            'circle-stroke-color': textColor,
          },
        },
      ],
    };
  }

  public generateStaticMapSVG(req: StaticMapRequest): string {
    const width = req.width ?? 600;
    const height = req.height ?? 400;
    const zoom = req.zoom ?? 13;
    const center = req.center;
    const pathColor = req.pathColor ?? '#1a73e8';

    let bgColor = '#e5e3df';
    let roadColor = '#ffffff';
    let waterColor = '#aadaff';

    if (req.theme === 'dark' || req.theme === 'night') {
      bgColor = '#1e2022';
      roadColor = '#2c2f33';
      waterColor = '#0e2a47';
    } else if (req.theme === 'retro') {
      bgColor = '#dfd2ae';
      roadColor = '#fbf6d8';
      waterColor = '#b4d3d4';
    }

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: ${bgColor};">`;
    svg += `<rect width="${width}" height="${height}" fill="${bgColor}"/>`;
    svg += `<path d="M 0 ${height - 80} Q ${width / 2} ${height - 120} ${width} ${height - 60} L ${width} ${height} L 0 ${height} Z" fill="${waterColor}" opacity="0.8"/>`;

    for (let x = 50; x < width; x += 100) {
      svg += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${roadColor}" stroke-width="4" opacity="0.6"/>`;
    }
    for (let y = 40; y < height; y += 80) {
      svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${roadColor}" stroke-width="5" opacity="0.6"/>`;
    }

    if (req.path && req.path.length >= 2) {
      svg += '<path d="M';
      req.path.forEach((pt, i) => {
        const [px, py] = this.projectCoordToPixel(pt, center, zoom, width, height);
        svg += i === 0 ? ` ${px.toFixed(1)},${py.toFixed(1)}` : ` L ${px.toFixed(1)},${py.toFixed(1)}`;
      });
      svg += `" fill="none" stroke="${pathColor}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
    }

    if (req.markers) {
      for (const m of req.markers) {
        const [px, py] = this.projectCoordToPixel(m.location, center, zoom, width, height);
        const color = m.color ?? '#ea4335';
        const label = m.label ?? '';
        svg += `
          <g transform="translate(${px.toFixed(1)}, ${py.toFixed(1)})">
            <path d="M 0,0 C -8,-10 -12,-16 -12,-24 A 12,12 0 1,1 12,-24 C 12,-16 8,-10 0,0 Z" fill="${color}"/>
            <circle cx="0" cy="-24" r="5" fill="#ffffff"/>
            <text x="0" y="-21" font-size="8" font-family="Arial, sans-serif" font-weight="bold" fill="#333333" text-anchor="middle">${label}</text>
          </g>`;
      }
    }

    svg += `<text x="${width - 45}" y="${height - 12}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#666666" opacity="0.8">B-Map</text>`;
    svg += '</svg>';
    return svg;
  }

  public clusterMarkers(
    points: Array<{ id: string; location: LatLng; name?: string }>,
    zoom: number,
    radiusPixels = 60.0
  ): ClusterPoint[] {
    if (zoom >= 17) {
      return points.map((p) => ({
        id: p.id,
        is_cluster: false,
        location: p.location,
        place: { name: p.name },
      }));
    }

    const scale = 256.0 * Math.pow(2, zoom);
    const cells = new Map<string, Array<{ id: string; location: LatLng; name?: string }>>();

    for (const p of points) {
      const worldX = ((p.location.longitude + 180.0) / 360.0) * scale;
      const worldY =
        ((1.0 -
          Math.log(
            Math.tan((p.location.latitude * Math.PI) / 180.0) +
              1.0 / Math.cos((p.location.latitude * Math.PI) / 180.0)
          ) /
            Math.PI) /
          2.0) *
        scale;

      const gx = Math.floor(worldX / radiusPixels);
      const gy = Math.floor(worldY / radiusPixels);
      const key = `${gx}:${gy}`;

      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(p);
    }

    const results: ClusterPoint[] = [];
    for (const cellItems of cells.values()) {
      if (cellItems.length === 1) {
        const item = cellItems[0];
        results.push({
          id: item.id,
          is_cluster: false,
          location: item.location,
          place: { name: item.name },
        });
      } else {
        let sumLat = 0;
        let sumLng = 0;
        for (const item of cellItems) {
          sumLat += item.location.latitude;
          sumLng += item.location.longitude;
        }
        const centroid: LatLng = {
          latitude: sumLat / cellItems.length,
          longitude: sumLng / cellItems.length,
        };
        results.push({
          is_cluster: true,
          point_count: cellItems.length,
          location: centroid,
          expansion_zoom: Math.min(18, zoom + 2),
        });
      }
    }

    return results;
  }

  public getVectorTileGeoJSON(z: number, x: number, y: number) {
    const minLng = this.tile2lon(x, z);
    const maxLat = this.tile2lat(y, z);
    const maxLng = this.tile2lon(x + 1, z);
    const minLat = this.tile2lat(y + 1, z);

    return {
      type: 'FeatureCollection',
      name: 'places',
      tile: { z, x, y },
      bbox: [minLng, minLat, maxLng, maxLat],
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
          },
          properties: {
            id: `tile_feature_${z}_${x}_${y}`,
            name: 'Central Road Junction',
            category: 'transit',
          },
        },
      ],
    };
  }

  private projectCoordToPixel(
    coord: LatLng,
    center: LatLng,
    zoom: number,
    width: number,
    height: number
  ): [number, number] {
    const scale = 256.0 * Math.pow(2, zoom);

    const centerX = ((center.longitude + 180.0) / 360.0) * scale;
    const centerY =
      ((1.0 -
        Math.log(
          Math.tan((center.latitude * Math.PI) / 180.0) +
            1.0 / Math.cos((center.latitude * Math.PI) / 180.0)
        ) /
          Math.PI) /
        2.0) *
      scale;

    const pointX = ((coord.longitude + 180.0) / 360.0) * scale;
    const pointY =
      ((1.0 -
        Math.log(
          Math.tan((coord.latitude * Math.PI) / 180.0) +
            1.0 / Math.cos((coord.latitude * Math.PI) / 180.0)
        ) /
          Math.PI) /
        2.0) *
      scale;

    const screenX = width / 2.0 + (pointX - centerX);
    const screenY = height / 2.0 + (pointY - centerY);

    return [screenX, screenY];
  }

  private tile2lon(x: number, z: number): number {
    return (x / Math.pow(2, z)) * 360.0 - 180.0;
  }

  private tile2lat(y: number, z: number): number {
    const n = Math.PI - (2.0 * Math.PI * y) / Math.pow(2, z);
    return (180.0 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }
}

export const mapsTilesService = new MapsTilesService();
