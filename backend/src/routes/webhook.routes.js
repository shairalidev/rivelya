import { Router } from 'express';
import { payments } from '../services/payments.service.js';
import { telephony } from '../services/telephony.service.js';

const router = Router();

router.post('/stripe', expressRaw, payments.handleStripeWebhook);
router.post('/twilio/call-status', expressRaw, telephony.handleCallStatus);

function expressRaw(req, res, next) {
  let data = [];
  req.on('data', chunk => data.push(chunk));
  req.on('end', () => { req.rawBody = Buffer.concat(data); next(); });
}
export default router;
