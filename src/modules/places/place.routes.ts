import { Router } from 'express';
import { placeController } from './place.controller';

const router = Router();

router.post('/', (req, res) => placeController.createPlace(req, res));
router.get('/nearby', (req, res) => placeController.getNearby(req, res));
router.post('/within-polygon', (req, res) => placeController.getWithinPolygon(req, res));
router.get('/search', (req, res) => placeController.search(req, res));
router.get('/:id', (req, res) => placeController.getById(req, res));

export default router;
