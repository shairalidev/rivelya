import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Session } from '../models/session.model.js';
import { Booking } from '../models/booking.model.js';
import { sessionLifecycle } from '../services/session-lifecycle.service.js';

const router = Router();

// End session manually
router.post('/:sessionId/end', requireAuth, async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is authorized to end this session
    const booking = await Booking.findById(session.booking_id)
      .populate('master_id', 'user_id')
      .populate('customer_id', '_id');

    const isCustomer = booking.customer_id._id.toString() === req.user._id.toString();
    const isMaster = booking.master_id.user_id.toString() === req.user._id.toString();

    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Not authorized to end this session' });
    }

    const endedBy = isCustomer ? 'customer' : 'master';
    const result = await sessionLifecycle.endSessionManually(req.params.sessionId, endedBy);

    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (error) {
    next(error);
  }
});

// Get session status
router.get('/:sessionId/status', requireAuth, async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check authorization
    const booking = await Booking.findById(session.booking_id)
      .populate('master_id', 'user_id')
      .populate('customer_id', '_id');

    const isCustomer = booking.customer_id._id.toString() === req.user._id.toString();
    const isMaster = booking.master_id.user_id.toString() === req.user._id.toString();

    if (!isCustomer && !isMaster) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json({
      status: session.status,
      start_ts: session.start_ts,
      end_ts: session.end_ts,
      actual_end_ts: session.actual_end_ts,
      ended_by: session.ended_by
    });
  } catch (error) {
    next(error);
  }
});

export default router;