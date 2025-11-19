import twilio from 'twilio';
import { Session } from '../models/session.model.js';
import { Wallet } from '../models/wallet.model.js';
import { emitToSession } from './socket.service.js';
import { emitSessionStatus } from '../utils/session-events.js';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sanitizePhone = value => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numericOnly = trimmed.replace(/\D/g, '');
  if (!numericOnly) return null;
  if (trimmed.startsWith('+')) {
    return `+${numericOnly}`;
  }
  if (numericOnly.startsWith('00')) {
    return `+${numericOnly.slice(2)}`;
  }
  if (numericOnly.startsWith('0')) {
    return `+39${numericOnly.slice(1)}`;
  }
  return `+${numericOnly}`;
};

const resolvePhone = participant => {
  if (!participant) return null;
  if (typeof participant === 'string') return participant;
  if (participant.phone) return participant.phone;
  if (participant.user?.phone) return participant.user.phone;
  if (participant.user_id?.phone) return participant.user_id.phone;
  if (participant.contact?.phone) return participant.contact.phone;
  return null;
};

const maskPhone = phone => {
  if (!phone) return null;
  if (phone.length <= 4) return '****';
  return `${phone.slice(0, 4)}****${phone.slice(-2)}`;
};

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

      const customerPhone = sanitizePhone(resolvePhone(user));
      const masterPhone = sanitizePhone(resolvePhone(master));

      if (!customerPhone || !masterPhone) {
        throw new Error('Missing phone number for one or both participants');
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
        to: customerPhone,
        from: process.env.TWILIO_PHONE_NUMBER,
        twiml: `<Response><Dial><Conference statusCallbackEvent="join leave" statusCallback="${process.env.API_BASE_URL}/webhooks/twilio/participant-status">${conference.friendlyName}</Conference></Dial></Response>`
      });

      // Call the master
      const masterCall = await client.calls.create({
        to: masterPhone,
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

        emitSessionStatus({
          sessionId,
          channel: sess.channel,
          status: 'ended',
          userId: sess.user_id,
          masterUserId: sess.master_id?.user_id || sess.master_id
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
