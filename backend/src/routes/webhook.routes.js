import { Router } from 'express';
import { payments } from '../services/payments.service.js';
import { telephony } from '../services/telephony.service.js';

const router = Router();

router.post('/stripe', expressRaw, payments.handleStripeWebhook);
router.post('/twilio/call-status', telephony.handleCallStatus);
router.post('/twilio/conference-status', telephony.handleConferenceStatus);
router.post('/twilio/participant-status', telephony.handleParticipantStatus);

function expressRaw(req, res, next) {
  let data = [];
  req.on('data', chunk => data.push(chunk));
  req.on('end', () => { req.rawBody = Buffer.concat(data); next(); });
}
export default router;
