import { LatLng } from '../../core/utils/response';
import { RegionHighlight, TerritorialBorderGeoJSON } from './boundaries.types';

export class BoundaryService {
  public getTerritorialBorders(
    locale = 'GLOBAL',
    adminLevel = 0
  ): TerritorialBorderGeoJSON {
    const normalizedLocale = String(locale).trim().toUpperCase();
    const isDisputed = normalizedLocale === 'GLOBAL';
    const strokeColor = '#d93025';
    const strokeWidth = 2.5;
    const dashArray = isDisputed ? [4.0, 2.5] : [];

    const sampleCoords = this.getSampleBoundaryCoordinates(normalizedLocale);

    const feature = {
      type: 'Feature',
      properties: {
        id: 'soi_territorial_red_line_01',
        name: 'Survey of India (SOI) Mandated Territorial Boundary',
        locale: normalizedLocale,
        stroke_color: strokeColor,
        stroke_width: strokeWidth,
        stroke_dasharray: dashArray,
        is_official_line: true,
        is_mandated_border: true,
      },
      geometry: {
        type: 'LineString',
        coordinates: sampleCoords,
      },
    };

    return {
      type: 'FeatureCollection',
      features: [feature],
    };
  }

  public getRegionHighlight(query: string, locale = 'GLOBAL'): RegionHighlight {
    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();

    let bbox: [number, number, number, number] = [68.11, 8.07, 97.4, 37.1];
    let center: LatLng = { latitude: 20.5937, longitude: 78.9629 };

    if (lower.includes('delhi')) {
      bbox = [76.84, 28.4, 77.35, 28.88];
      center = { latitude: 28.6139, longitude: 77.209 };
    } else if (lower.includes('mumbai')) {
      bbox = [72.77, 18.89, 72.98, 19.27];
      center = { latitude: 19.076, longitude: 72.8777 };
    } else if (lower.includes('bengaluru') || lower.includes('bangalore')) {
      bbox = [77.46, 12.83, 77.75, 13.14];
      center = { latitude: 12.9716, longitude: 77.5946 };
    }

    const polygonCoords: number[][] = [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[1]],
      [bbox[2], bbox[3]],
      [bbox[0], bbox[3]],
      [bbox[0], bbox[1]],
    ];

    const worldOuterRing: number[][] = [
      [-180.0, -90.0],
      [180.0, -90.0],
      [180.0, 90.0],
      [-180.0, 90.0],
      [-180.0, -90.0],
    ];

    return {
      id: `region_${Date.now()}`,
      name: trimmed,
      admin_level: lower.includes('india') ? 0 : lower.includes('state') ? 1 : 2,
      country_code: 'IN',
      bounding_box: bbox,
      center,
      area_sq_km: 1484.0,
      boundary_geojson: {
        type: 'Feature',
        properties: { name: trimmed },
        geometry: {
          type: 'Polygon',
          coordinates: [polygonCoords],
        },
      },
      mask_polygon_json: {
        type: 'Feature',
        properties: {
          description: 'Inverted world mask for dimming area outside search boundary',
          mask_opacity: 0.4,
          mask_color: '#000000',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [worldOuterRing, polygonCoords],
        },
      },
      stroke_color: '#d93025',
      stroke_width: 2.5,
      fill_color: '#d93025',
      fill_opacity: 0.08,
      is_disputed_border: false,
    };
  }

  private getSampleBoundaryCoordinates(locale: string): number[][] {
    return [
      [74.85, 37.05],
      [78.5, 35.5],
      [80.3, 30.5],
      [88.0, 27.8],
      [97.25, 28.2],
      [95.2, 24.5],
      [92.3, 21.0],
      [88.3, 21.6],
      [80.2, 13.0],
      [77.55, 8.08],
      [72.8, 19.0],
      [68.1, 23.7],
      [71.0, 27.5],
      [74.5, 32.5],
      [74.85, 37.05],
    ];
  }
}

export const boundaryService = new BoundaryService();
