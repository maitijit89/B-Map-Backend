import { Router } from 'express';
import { ratingController } from './ratings.controller';
import { placeController } from '../places/place.controller';

const router = Router();

// Global app rating endpoints
router.post('/', (req, res) => ratingController.submitRating(req, res));
router.get('/my-rating', (req, res) => ratingController.getMyRating(req, res));
router.get('/stats', (req, res) => ratingController.getStats(req, res));
router.get('/', (req, res) => ratingController.listRatings(req, res));

// Place / POI rating aliases for backward compatibility & discoverability
router.post('/places/:placeId', (req, res) => placeController.submitRating(req, res));
router.get('/places/:placeId', (req, res) => placeController.getRatings(req, res));
router.get('/places/:placeId/summary', (req, res) => placeController.getRatingStats(req, res));
router.get('/places/:placeId/my-review', (req, res) => placeController.getMyReview(req, res));
router.post('/places/:placeId/:ratingId/helpful', (req, res) => placeController.voteHelpful(req, res));
router.post('/places/:placeId/:ratingId/report', (req, res) => placeController.reportReview(req, res));
router.delete('/places/:placeId/:ratingId', (req, res) => placeController.deleteRating(req, res));

export default router;
