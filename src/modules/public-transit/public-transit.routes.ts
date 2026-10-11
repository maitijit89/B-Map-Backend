import { Router } from 'express';
import { publicTransitController } from './public-transit.controller';

const router = Router();

// Multimodal trip planning
router.post('/itinerary', (req, res) => publicTransitController.planItinerary(req, res));

// Station live departure board
router.get('/stations/:stationId/departures', (req, res) => publicTransitController.getDepartures(req, res));

// Nearby stations
router.get('/stations/nearby', (req, res) => publicTransitController.getNearbyStations(req, res));

export default router;
