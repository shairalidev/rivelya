import cron from 'node-cron';
import { Booking } from '../models/booking.model.js';
import { Session } from '../models/session.model.js';
import { ChatThread } from '../models/chat-thread.model.js';
import { SessionNotification } from '../models/session-notification.model.js';
import { createNotification } from '../utils/notifications.js';
import { emitToUser } from '../lib/socket.js';
import { getPublicDisplayName } from '../utils/privacy.js';

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
      await this.syncActiveSessions();
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

      // Create master earning transaction
      await this.createMasterEarningTransaction(session, booking);

      // Emit session expiration events
      const { emitToUser } = await import('../lib/socket.js');
      const { emitSessionStatus } = await import('../utils/session-events.js');
      
      if (session.user_id && session.master_id) {
        const masterUserId = session.master_id.user_id || session.master_id;
        
        emitToUser(session.user_id, 'session:expired', { sessionId: session._id });
        emitToUser(masterUserId, 'session:expired', { sessionId: session._id });
        
        emitSessionStatus({
          sessionId: session._id,
          channel: session.channel,
          status: 'expired',
          userId: session.user_id,
          masterUserId
        });

        // Trigger review prompts for both participants
        if (booking) {
          emitToUser(session.user_id, 'session:review:prompt', {
            sessionId: session._id,
            partnerName: booking.master_id?.display_name || 'Master',
            partnerType: 'master'
          });
          
          emitToUser(masterUserId, 'session:review:prompt', {
            sessionId: session._id,
            partnerName: booking.customer_id?.display_name || 'Cliente',
            partnerType: 'client'
          });
        }
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
        
        // Create master earning transaction for chat
        await this.createMasterEarningTransaction(null, booking);
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

          // Trigger review prompt
          const partnerName = participant.role === 'customer' 
            ? booking.master_id?.display_name || 'Master'
            : booking.customer_id?.display_name || 'Cliente';
          const partnerType = participant.role === 'customer' ? 'master' : 'client';
          
          emitToUser(participant.userId, 'session:review:prompt', {
            sessionId: booking.session_id,
            partnerName,
            partnerType
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

      // Update booking and trigger review prompts
      const booking = await Booking.findById(session.booking_id)
        .populate('master_id', 'user_id display_name')
        .populate('customer_id', '_id display_name');

      if (booking) {
        await this.completeBooking(booking);
        
        // Create master earning transaction
        await this.createMasterEarningTransaction(session, booking);
        
        // Trigger review prompts for manual session end
        const { emitToUser } = await import('../lib/socket.js');
        
        emitToUser(booking.customer_id._id, 'session:review:prompt', {
          sessionId: session._id,
          partnerName: booking.master_id?.display_name || 'Master',
          partnerType: 'master'
        });
        
        emitToUser(booking.master_id.user_id, 'session:review:prompt', {
          sessionId: session._id,
          partnerName: booking.customer_id?.display_name || 'Cliente',
          partnerType: 'client'
        });
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

  async syncActiveSessions() {
    try {
      const now = new Date();
      
      // Find active sessions that need timer sync
      const activeSessions = await Session.find({
        status: 'active',
        end_ts: { $gt: now }
      }).populate('master_id', 'user_id');

      const { emitToUser } = await import('../lib/socket.js');
      
      for (const session of activeSessions) {
        const remainingSeconds = Math.max(0, Math.floor((session.end_ts - now) / 1000));
        
        const syncData = {
          sessionId: session._id,
          remainingSeconds,
          expiresAt: session.end_ts
        };
        
        // Emit to both participants
        if (session.user_id) {
          emitToUser(session.user_id, 'voice:session:sync', syncData);
        }
        if (session.master_id?.user_id) {
          emitToUser(session.master_id.user_id, 'voice:session:sync', syncData);
        }
      }
    } catch (error) {
      console.error('Error syncing active sessions:', error);
    }
  }

  async createMasterEarningTransaction(session, booking) {
    try {
      if (!booking?.master_id?.user_id) return;

      const { User } = await import('../models/user.model.js');
      const { Wallet } = await import('../models/wallet.model.js');
      const { Transaction } = await import('../models/transaction.model.js');

      // Get master user and wallet
      const masterUser = await User.findById(booking.master_id.user_id);
      if (!masterUser?.wallet_id) return;

      const masterWallet = await Wallet.findById(masterUser.wallet_id);
      if (!masterWallet) return;

      // Calculate master earnings (30% of session cost)
      const sessionCost = session?.cost_cents || booking.amount_cents || 0;
      const masterEarnings = Math.round(sessionCost * 0.3);

      if (masterEarnings <= 0) return;

      // Update master wallet balance
      masterWallet.balance_cents += masterEarnings;
      await masterWallet.save();

      // Create transaction record with only public names
      const transaction = await Transaction.create({
        wallet_id: masterWallet._id,
        type: 'master_earning',
        amount: masterEarnings,
        meta: {
          description: `Guadagno sessione ${booking.reservation_id}`,
          master: getPublicDisplayName(booking.master_id, 'Master'),
          master_id: booking.master_id._id,
          channel: session?.channel || booking.channel || 'chat',
          session_id: session?._id,
          booking_id: booking._id,
          customer: getPublicDisplayName(booking.customer_id, 'Cliente')
        }
      });

      console.log(`Created master earning transaction: ${masterEarnings} cents for ${booking.reservation_id}`);
      return transaction;
    } catch (error) {
      console.error('Error creating master earning transaction:', error);
    }
  }

  stop() {
    this.isRunning = false;
    console.log('Session lifecycle service stopped');
  }
}

export const sessionLifecycle = new SessionLifecycleService();