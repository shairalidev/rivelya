import twilio from 'twilio';
import { Session } from '../models/session.model.js';
import { Wallet } from '../models/wallet.model.js';
import { emitToSession } from './socket.service.js';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const telephony = {
  async initiateCallback({ session, master, user }) {
    try {
      console.info('[voice] Initiating telephony callback', {
        sessionId: session?._id?.toString(),
        masterId: master?._id?.toString(),
        userId: user?._id?.toString()
      });
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        console.warn('[voice] Twilio credentials not configured, simulating voice call');
        await Session.findByIdAndUpdate(session._id, { status: 'active', start_ts: new Date() });
        return { status: 'simulated' };
      }

      // Create a conference room for the session
      const conference = await client.conferences.create({
        friendlyName: `rivelya-session-${session._id}`,
        statusCallback: `${process.env.API_BASE_URL}/webhooks/twilio/conference-status`,
        statusCallbackEvent: ['start', 'end', 'join', 'leave'],
        statusCallbackMethod: 'POST'
      });

      // Call the customer first
      const customerCall = await client.calls.create({
        to: user.phone || '+1234567890',
        from: process.env.TWILIO_PHONE_NUMBER,
        twiml: `<Response><Dial><Conference statusCallbackEvent="join leave" statusCallback="${process.env.API_BASE_URL}/webhooks/twilio/participant-status">${conference.friendlyName}</Conference></Dial></Response>`
      });

      // Call the master
      const masterCall = await client.calls.create({
        to: master.phone || '+1234567891',
        from: process.env.TWILIO_PHONE_NUMBER,
        twiml: `<Response><Dial><Conference statusCallbackEvent="join leave" statusCallback="${process.env.API_BASE_URL}/webhooks/twilio/participant-status">${conference.friendlyName}</Conference></Dial></Response>`
      });

      await Session.findByIdAndUpdate(session._id, {
        status: 'active',
        start_ts: new Date(),
        twilio_conference_sid: conference.sid,
        twilio_customer_call_sid: customerCall.sid,
        twilio_master_call_sid: masterCall.sid
      });

      console.info('[voice] Telephony callback initiated', {
        sessionId: session?._id?.toString(),
        conferenceSid: conference.sid,
        customerCallSid: customerCall.sid,
        masterCallSid: masterCall.sid
      });

      return {
        status: 'initiated',
        conferenceSid: conference.sid,
        customerCallSid: customerCall.sid,
        masterCallSid: masterCall.sid
      };
    } catch (error) {
      console.error('[voice] Twilio call initiation failed', {
        sessionId: session?._id?.toString(),
        message: error.message,
        stack: error.stack
      });
      await Session.findByIdAndUpdate(session._id, { status: 'active', start_ts: new Date() });
      return { status: 'simulated', error: error.message };
    }
  },

  async endCall(sessionId) {
    try {
      console.info('[voice] Ending telephony call', { sessionId });
      const session = await Session.findById(sessionId);
      if (!session) return { status: 'not_found' };

      if (session.twilio_conference_sid) {
        await client.conferences(session.twilio_conference_sid).update({ status: 'completed' });
      }

      if (session.twilio_customer_call_sid) {
        await client.calls(session.twilio_customer_call_sid).update({ status: 'completed' });
      }

      if (session.twilio_master_call_sid) {
        await client.calls(session.twilio_master_call_sid).update({ status: 'completed' });
      }

      console.info('[voice] Telephony call ended successfully', {
        sessionId,
        conferenceSid: session.twilio_conference_sid,
        customerCallSid: session.twilio_customer_call_sid,
        masterCallSid: session.twilio_master_call_sid
      });

      return { status: 'ended' };
    } catch (error) {
      console.error('[voice] Error ending Twilio call', {
        sessionId,
        message: error.message,
        stack: error.stack
      });
      return { status: 'error', error: error.message };
    }
  },

  async handleCallStatus(req, res) {
    try {
      console.info('[voice] Received telephony status callback', {
        endpoint: 'call-status',
        payload: req.body
      });
      const { sessionId, durationSec = 300 } = req.body || {};
      const sess = await Session.findById(sessionId);
      if (sess) {
        sess.end_ts = new Date();
        sess.duration_s = durationSec;
        sess.status = 'ended';
        await sess.save();

        const wallet = await Wallet.findOne({ owner_id: sess.user_id });
        if (wallet) {
          const minutes = Math.ceil(Math.max(durationSec - 0, 0) / 60);
          const spend = minutes * sess.price_cpm;
          wallet.balance_cents = Math.max(0, wallet.balance_cents - spend);
          await wallet.save();
        }

        emitToSession(sessionId, 'voice:session:ended', {
          sessionId,
          duration: durationSec,
          cost: sess.cost_cents
        });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('[voice] Error handling call status', {
        message: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: error.message });
    }
  },

  async handleConferenceStatus(req, res) {
    try {
      console.info('[voice] Received telephony status callback', {
        endpoint: 'conference-status',
        payload: req.body
      });
      const { ConferenceSid, StatusCallbackEvent, FriendlyName } = req.body;

      const sessionId = FriendlyName?.replace('rivelya-session-', '');

      if (sessionId) {
        emitToSession(sessionId, 'voice:conference:status', {
          event: StatusCallbackEvent,
          conferenceSid: ConferenceSid
        });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('[voice] Error handling conference status', {
        message: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: error.message });
    }
  },

  async handleParticipantStatus(req, res) {
    try {
      console.info('[voice] Received telephony status callback', {
        endpoint: 'participant-status',
        payload: req.body
      });
      const { ConferenceSid, StatusCallbackEvent, CallSid } = req.body;

      const session = await Session.findOne({ twilio_conference_sid: ConferenceSid });

      if (session) {
        emitToSession(session._id, 'voice:participant:status', {
          event: StatusCallbackEvent,
          callSid: CallSid,
          conferenceSid: ConferenceSid
        });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('[voice] Error handling participant status', {
        message: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: error.message });
    }
  }
};
