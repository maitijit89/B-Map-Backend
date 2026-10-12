import { Request, Response } from 'express';
import { sendSuccess, sendNotFound, sendBadRequest } from '../../core/utils/response';
import { pincodeService } from './pincode.service';

export class PINCodeController {
  public async lookup(req: Request, res: Response): Promise<void> {
    const { pincode } = req.params;
    const result = pincodeService.lookupPINCode(String(pincode));
    if (!result) {
      sendNotFound(res, `PIN code ${pincode} not found in Indian postal registry`);
      return;
    }
    sendSuccess(res, result, `PIN code ${pincode} details retrieved`);
  }

  public async parseAddress(req: Request, res: Response): Promise<void> {
    const address = req.body.address ?? req.body.raw_address;
    if (!address) {
      sendBadRequest(res, 'address string is required');
      return;
    }
    const result = pincodeService.parseIndianAddress(String(address));
    sendSuccess(res, result, 'Indian address parsed into landmark entities');
  }

  public async reverse(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6139);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.209);
    const result = pincodeService.reverseLookup(lat, lng);
    sendSuccess(res, result, 'Reverse PIN code lookup successful');
  }
}

export const pincodeController = new PINCodeController();
