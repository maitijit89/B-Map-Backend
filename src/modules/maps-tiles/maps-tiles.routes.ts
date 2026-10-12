import { Router } from 'express';
import { mapsTilesController } from './maps-tiles.controller';

export const mapsRouter = Router();
mapsRouter.get('/style.json', (req, res) => mapsTilesController.getStyleJSON(req, res));
mapsRouter.get('/static', (req, res) => mapsTilesController.getStaticMap(req, res));
mapsRouter.get('/clusters', (req, res) => mapsTilesController.getClusters(req, res));

export const tilesRouter = Router();
tilesRouter.get('/:z/:x/:y', (req, res) => mapsTilesController.getTile(req, res));
tilesRouter.get('/:z/:x/:y.mvt', (req, res) => mapsTilesController.getTile(req, res));
tilesRouter.get('/:z/:x/:y.json', (req, res) => mapsTilesController.getTile(req, res));
