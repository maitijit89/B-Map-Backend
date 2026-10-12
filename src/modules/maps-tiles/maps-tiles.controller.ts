import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { mapsTilesService } from './maps-tiles.service';

export class MapsTilesController {
  public async getStyleJSON(req: Request, res: Response): Promise<void> {
    const theme = (req.query.theme as any) ?? 'standard';
    const baseURL = `${req.protocol}://${req.get('host') ?? 'localhost:4000'}`;
    const style = mapsTilesService.generateStyleJSON(baseURL, theme);
    res.setHeader('Content-Type', 'application/json');
    res.json(style);
  }

  public async getStaticMap(req: Request, res: Response): Promise<void> {
    const centerParam = String(req.query.center ?? '28.6129,77.2295');
    const [latStr, lngStr] = centerParam.split(',');
    const center = {
      latitude: parseFloat(latStr) || 28.6129,
      longitude: parseFloat(lngStr) || 77.2295,
    };
    const zoom = parseInt(req.query.zoom as string, 10) || 13;
    const width = parseInt(req.query.width as string, 10) || 600;
    const height = parseInt(req.query.height as string, 10) || 400;

    const svg = mapsTilesService.generateStaticMapSVG({
      center,
      zoom,
      width,
      height,
      markers: [{ location: center, label: 'A', color: '#ea4335' }],
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  }

  public async getClusters(req: Request, res: Response): Promise<void> {
    const minLat = parseFloat(req.query.min_lat as string) || 28.0;
    const maxLat = parseFloat(req.query.max_lat as string) || 29.0;
    const minLng = parseFloat(req.query.min_lng as string) || 76.0;
    const maxLng = parseFloat(req.query.max_lng as string) || 78.0;
    const zoom = parseInt(req.query.zoom as string, 10) || 10;

    const samplePoints = [
      { id: 'p1', location: { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 }, name: 'Center Plaza' },
      { id: 'p2', location: { latitude: (minLat + maxLat) / 2 + 0.05, longitude: (minLng + maxLng) / 2 + 0.05 }, name: 'East Mall' },
      { id: 'p3', location: { latitude: (minLat + maxLat) / 2 - 0.05, longitude: (minLng + maxLng) / 2 - 0.05 }, name: 'West Station' },
    ];

    const clusters = mapsTilesService.clusterMarkers(samplePoints, zoom);
    sendSuccess(res, clusters, 'Geospatial POI clusters computed');
  }

  public async getTile(req: Request, res: Response): Promise<void> {
    const z = parseInt(String(req.params.z), 10);
    const x = parseInt(String(req.params.x), 10);
    const y = parseInt(String(req.params.y), 10);

    const tileData = mapsTilesService.getVectorTileGeoJSON(z, x, y);
    res.setHeader('Content-Type', 'application/json');
    res.json(tileData);
  }
}

export const mapsTilesController = new MapsTilesController();
