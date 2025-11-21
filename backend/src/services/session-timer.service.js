// DEPRECATED: This service is replaced by session-lifecycle.service.js
// TODO: Remove this file after confirming no dependencies

import { Session } from '../models/session.model.js';
import { emitToUser } from '../lib/socket.js'; // Fixed import path
import { emitSessionStatus } from '../utils/session-events.js';

// DEPRECATED: Use session-lifecycle.service.js instead
export const startSessionTimer = () => {
  console.warn('DEPRECATED: session-timer.service.js is deprecated. Use session-lifecycle.service.js instead.');
  return; // Disable this service
  // Check for expired sessions every 30 seconds
  setInterval(async () => {
    try {
      const expiredSessions = await Session.find({
        status: { $in: ['active', 'created'] },
        end_ts: { $lt: new Date() },
        channel: { $in: ['voice', 'chat_voice'] }
      }).populate('master_id', 'user_id').populate('user_id', '_id');

      for (const session of expiredSessions) {
        const now = new Date();
        session.status = 'ended';
        if (session.start_ts) {
          session.duration_s = Math.floor((now - session.start_ts) / 1000);
          const durationMinutes = Math.ceil(session.duration_s / 60);
          session.cost_cents = durationMinutes * session.price_cpm;
        }
        await session.save();

        // Update booking status to completed if this session is linked to a booking
        if (session.booking_id) {
          const { Booking } = await import('../models/booking.model.js');
          await Booking.findByIdAndUpdate(session.booking_id, { status: 'completed' });
        }

        // Notify both participants
        const { emitToSession } = await import('./socket.service.js');
        emitToSession(session._id, 'voice:session:expired', { sessionId: session._id });
        emitToUser(session.user_id._id, 'voice:session:expired', { sessionId: session._id });
        emitToUser(session.master_id.user_id, 'voice:session:expired', { sessionId: session._id });

        emitSessionStatus({
          sessionId: session._id,
          channel: session.channel,
          status: 'expired',
          userId: session.user_id._id,
          masterUserId: session.master_id.user_id
        });
      }

      if (expiredSessions.length > 0) {
        console.log(`Auto-ended ${expiredSessions.length} expired voice sessions`);
      }
    } catch (error) {
      console.error('Session timer error:', error);
    }
  }, 30000); // Check every 30 seconds
};
