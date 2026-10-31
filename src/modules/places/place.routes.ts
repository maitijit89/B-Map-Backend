import { Router } from 'express';
import { placeController } from './place.controller';

const router = Router();

// Core POI endpoints
router.post('/', (req, res) => placeController.createPlace(req, res));
router.get('/nearby', (req, res) => placeController.getNearby(req, res));
router.post('/within-polygon', (req, res) => placeController.getWithinPolygon(req, res));
router.get('/search', (req, res) => placeController.search(req, res));
router.get('/top-rated/discover', (req, res) => placeController.getTopRated(req, res));

// Place Ratings & Reviews sub-resource
router.post('/:placeId/ratings', (req, res) => placeController.submitRating(req, res));
router.get('/:placeId/ratings', (req, res) => placeController.getRatings(req, res));
router.get('/:placeId/ratings/summary', (req, res) => placeController.getRatingStats(req, res));
router.get('/:placeId/ratings/my-review', (req, res) => placeController.getMyReview(req, res));
router.post('/:placeId/ratings/:ratingId/helpful', (req, res) => placeController.voteHelpful(req, res));
router.post('/:placeId/ratings/:ratingId/report', (req, res) => placeController.reportReview(req, res));
router.delete('/:placeId/ratings/:ratingId', (req, res) => placeController.deleteRating(req, res));

// User Visited Places & Slow-Large Spot Scaling Engine
router.post('/user/visit', (req, res) => placeController.recordUserVisit(req, res));
router.get('/user/visited-places', (req, res) => placeController.getUserVisitedPlaces(req, res));
router.get('/user/visited-spots', (req, res) => placeController.getUserVisitedSpots(req, res));
router.get('/user/map-layer', (req, res) => placeController.getUserPersonalizedMapLayer(req, res));
router.post('/user/calculate-scale', (req, res) => placeController.calculateDynamicScale(req, res));

// Single POI lookup by ID (keep after specific sub-routes)
router.get('/:id', (req, res) => placeController.getById(req, res));

export default router;
