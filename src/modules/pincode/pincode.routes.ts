import { Router } from 'express';
import { pincodeController } from './pincode.controller';

const router = Router();

router.post('/parse-address', (req, res) => pincodeController.parseAddress(req, res));
router.get('/reverse', (req, res) => pincodeController.reverse(req, res));
router.get('/:pincode', (req, res) => pincodeController.lookup(req, res));

export default router;
