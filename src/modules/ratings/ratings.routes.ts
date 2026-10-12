import { Router } from 'express';
import { ratingController } from './ratings.controller';

const router = Router();

router.post('/', (req, res) => ratingController.submitRating(req, res));
router.get('/my-rating', (req, res) => ratingController.getMyRating(req, res));
router.get('/stats', (req, res) => ratingController.getStats(req, res));
router.get('/', (req, res) => ratingController.listRatings(req, res));

export default router;
