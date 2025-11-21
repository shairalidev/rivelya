import cron from 'node-cron';
import { Booking } from '../models/booking.model.js';
import { Session } from '../models/session.model.js';
import { ChatThread } from '../models/chat-thread.model.js';
import { SessionNotification } from '../models/session-notification.model.js';
import { createNotification } from '../utils/notifications.js';
import { emitToUser } from '../lib/socket.js';

class SessionLifecycleService {
  constructor() {
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    
    // Check every 30 seconds for expired sessions
    cron.schedule('*/30 * * * * *', async () => {
      await this.checkExpiredSessions();
      await this.checkExpiredChatThreads();
    });
    
    this.isRunning = true;
    console.log('Session lifecycle service started');
  }

  async checkExpiredSessions() {
    try {
      const now = new Date();
      
      // Find sessions that should be expired but are still active
      const expiredSessions = await Session.find({
        status: { $in: ['active', 'created'] },
        end_ts: { $lt: now }
      });

      for (const session of expiredSessions) {
        await this.expireSession(session);
      }

      // Find bookings that should be completed but are still active
      const expiredBookings = await Booking.find({
        status: 'active',
        actual_started_at: { $exists: true },
        $expr: {
          $lt: [
            { $add: ['$actual_started_at', { $multiply: ['$duration_minutes', 60000] }] },
            now
          ]
        }
      });

      for (const booking of expiredBookings) {
        await this.completeBooking(booking);
      }

      // Check for abandoned chat calls (calling for more than 2 minutes)
      await this.checkAbandonedCalls(now);
    } catch (error) {
      console.error('Error checking expired sessions:', error);
    }
  }

  async checkExpiredChatThreads() {
    try {
      const now = new Date();
      
      // Find chat threads that should be expired (regardless of frontend status)
      const expiredThreads = await ChatThread.find({
        status: { $in: ['open', 'active'] },
        expires_at: { $lt: now }
      });

      for (const thread of expiredThreads) {
        await this.expireChatThread(thread);
      }
    } catch (error) {
      console.error('Error checking expired chat threads:', error);
    }
  }

  async expireSession(session) {
    try {
      // Prevent double-processing
      if (session.status === 'ended') {
        return;
      }

      const now = new Date();
      
      // Calculate final duration and cost
      if (session.start_ts) {
        session.duration_s = Math.floor((now - session.start_ts) / 1000);
        const durationMinutes = Math.ceil(session.duration_s / 60);
        session.cost_cents = durationMinutes * session.price_cpm;
      }
      
      // Update session status
      session.status = 'ended';
      session.actual_end_ts = now;
      session.ended_by = 'system';
      await session.save();

      // Update related booking
      const booking = await Booking.findById(session.booking_id)
        .populate('master_id', 'user_id display_name')
        .populate('customer_id', '_id display_name');

      if (booking && booking.status === 'active') {
        await this.completeBooking(booking);
      }

      // Emit session expiration events
      const { emitToUser } = await import('../lib/socket.js');
      const { emitSessionStatus } = await import('../utils/session-events.js');
      
      if (session.user_id && session.master_id) {
        emitToUser(session.user_id, 'session:expired', { sessionId: session._id });
        emitToUser(session.master_id.user_id || session.master_id, 'session:expired', { sessionId: session._id });
        
        emitSessionStatus({
          sessionId: session._id,
          channel: session.channel,
          status: 'expired',
          userId: session.user_id,
          masterUserId: session.master_id.user_id || session.master_id
        });
      }

      console.log(`Expired session ${session._id} for booking ${booking?.reservation_id}`);
      
      // Notify subscribed users that the expert is now available
      if (booking?.master_id) {
        await this.notifySessionEnd(booking.master_id._id || booking.master_id);
      }
    } catch (error) {
      console.error('Error expiring session:', error);
    }
  }

  async expireChatThread(thread) {
    try {
      // Prevent double-processing
      if (thread.status === 'expired') {
        return;
      }

      // Update thread status
      thread.status = 'expired';
      await thread.save();

      // Update related booking if exists
      const booking = await Booking.findById(thread.booking_id)
        .populate('master_id', 'user_id display_name')
        .populate('customer_id', '_id display_name');

      if (booking && booking.status === 'active') {
        await this.completeBooking(booking);
      }

      // Emit expiration events (even if users are offline)
      const { emitToUser } = await import('../lib/socket.js');
      if (thread.customer_id && thread.master_user_id) {
        emitToUser(thread.customer_id, 'chat:thread:expired', { threadId: thread._id });
        emitToUser(thread.master_user_id, 'chat:thread:expired', { threadId: thread._id });
      }

      console.log(`Expired chat thread ${thread._id} for booking ${booking?.reservation_id}`);
    } catch (error) {
      console.error('Error expiring chat thread:', error);
    }
  }

  async completeBooking(booking) {
    try {
      const wasActive = booking.status === 'active';
      
      // Update booking status
      booking.status = 'completed';
      booking.completed_at = new Date();
      await booking.save();

      if (wasActive) {
        // Notify participants that session ended
        const participants = [
          { userId: booking.customer_id._id, role: 'customer' },
          { userId: booking.master_id.user_id, role: 'master' }
        ];

        for (const participant of participants) {
          await createNotification({
            userId: participant.userId,
            type: 'session:completed',
            title: 'Sessione completata',
            body: `La sessione ${booking.reservation_id} è terminata.`,
            meta: { 
              bookingId: booking._id, 
              reservationId: booking.reservation_id
            }
          });

          emitToUser(participant.userId, 'session:completed', {
            bookingId: booking._id.toString(),
            reservationId: booking.reservation_id,
            message: 'La sessione è terminata'
          });
        }
      }

      console.log(`Completed booking ${booking.reservation_id}`);
      
      // Notify subscribed users that the expert is now available
      await this.notifySessionEnd(booking.master_id._id || booking.master_id);
    } catch (error) {
      console.error('Error completing booking:', error);
    }
  }

  async notifySessionEnd(masterId) {
    try {
      // Find all users subscribed to this master's session end notifications
      const subscriptions = await SessionNotification.find({
        master_id: masterId,
        active: true
      }).populate('master_id', 'display_name');

      if (subscriptions.length === 0) return;

      const masterName = subscriptions[0].master_id?.display_name || 'Esperti';
      
      // Send notifications to all subscribed users
      for (const subscription of subscriptions) {
        await createNotification({
          userId: subscription.user_id,
          type: 'expert:available',
          title: 'Esperti disponibile',
          body: `${masterName} ha terminato la sessione ed è ora disponibile.`,
          meta: { 
            masterId: masterId,
            masterName: masterName
          }
        });
      }

      // Deactivate notifications after sending (one-time notification)
      await SessionNotification.updateMany(
        { master_id: masterId, active: true },
        { active: false }
      );

      console.log(`Sent session end notifications for master ${masterId} to ${subscriptions.length} users`);
    } catch (error) {
      console.error('Error sending session end notifications:', error);
    }
  }

  // Manual session end (called when user explicitly ends session)
  async endSessionManually(sessionId, endedBy) {
    try {
      const session = await Session.findById(sessionId);
      if (!session || session.status === 'ended') {
        return { success: false, message: 'Session not found or already ended' };
      }

      // Update session
      session.status = 'ended';
      session.actual_end_ts = new Date();
      session.ended_by = endedBy;
      await session.save();

      // Update booking
      const booking = await Booking.findById(session.booking_id)
        .populate('master_id', 'user_id display_name')
        .populate('customer_id', '_id display_name');

      if (booking) {
        await this.completeBooking(booking);
      }

      return { success: true, message: 'Session ended successfully' };
    } catch (error) {
      console.error('Error ending session manually:', error);
      return { success: false, message: 'Error ending session' };
    }
  }

  async checkAbandonedCalls(now) {
    try {
      const { ChatCall } = await import('../models/chat-call.model.js');
      
      // Find calls that have been 'calling' for more than 2 minutes
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
      const abandonedCalls = await ChatCall.find({
        status: 'calling',
        createdAt: { $lt: twoMinutesAgo }
      });

      for (const call of abandonedCalls) {
        call.status = 'timeout';
        await call.save();

        // Emit timeout events
        const { emitToUser } = await import('../lib/socket.js');
        emitToUser(call.caller_id, 'chat:call:timeout', { callId: call._id, threadId: call.thread_id });
        emitToUser(call.callee_id, 'chat:call:timeout', { callId: call._id, threadId: call.thread_id });
      }

      if (abandonedCalls.length > 0) {
        console.log(`Timed out ${abandonedCalls.length} abandoned calls`);
      }
    } catch (error) {
      console.error('Error checking abandoned calls:', error);
    }
  }

  stop() {
    this.isRunning = false;
    console.log('Session lifecycle service stopped');
  }
}

export const sessionLifecycle = new SessionLifecycleService();