import twilio from 'twilio';
import { Session } from '../models/session.model.js';
import { Wallet } from '../models/wallet.model.js';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const telephony = {
  async initiateCallback({ session, master, user }) {
    // Twilio bridge placeholder
    // In production: buy Italian numbers, mask legs, call user, then call master, bridge, use status callbacks
    await Session.findByIdAndUpdate(session._id, { status: 'active', start_ts: new Date() });
    return { status: 'initiated' };
  },

  async handleCallStatus(req, res) {
    // Twilio webhook stub to meter and close sessions, debit wallet per minute
    // Compute duration, end session, charge wallet
    const { sessionId, durationSec = 300 } = req.body || {};
    const sess = await Session.findById(sessionId);
    if (sess) {
      sess.end_ts = new Date();
      sess.duration_s = durationSec;
      sess.status = 'ended';
      await sess.save();

      // Debit wallet unless in free window
      const wallet = await Wallet.findOne({ owner_id: sess.user_id });
      const minutes = Math.ceil(Math.max(durationSec - 0, 0) / 60);
      const spend = minutes * sess.price_cpm;
      wallet.balance_cents = Math.max(0, wallet.balance_cents - spend);
      await wallet.save();
    }
    res.json({ ok: true });
  }
};
