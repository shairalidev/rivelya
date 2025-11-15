import { Session } from '../models/session.model.js';
import { emitToUser } from './socket.service.js';

export const startSessionTimer = () => {
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

        // Notify both participants
        const { emitToSession } = await import('./socket.service.js');
        emitToSession(session._id, 'voice:session:expired', { sessionId: session._id });
        emitToUser(session.user_id._id, 'voice:session:expired', { sessionId: session._id });
        emitToUser(session.master_id.user_id, 'voice:session:expired', { sessionId: session._id });
      }

      if (expiredSessions.length > 0) {
        console.log(`Auto-ended ${expiredSessions.length} expired voice sessions`);
      }
    } catch (error) {
      console.error('Session timer error:', error);
    }
  }, 30000); // Check every 30 seconds
};