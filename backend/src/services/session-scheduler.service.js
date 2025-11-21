import cron from 'node-cron';
import { Booking } from '../models/booking.model.js';
import { ChatThread } from '../models/chat-thread.model.js';
import { Session } from '../models/session.model.js';
import { createNotification } from '../utils/notifications.js';
import { emitToUser } from '../lib/socket.js';

class SessionSchedulerService {
  constructor() {
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    
    // Check every 30 seconds for sessions to notify/start
    cron.schedule('*/30 * * * * *', async () => {
      await this.checkUpcomingSessions();
      await this.checkSessionsToStart();
    });
    
    this.isRunning = true;
    console.log('Session scheduler started');
  }

  async checkUpcomingSessions() {
    try {
      const now = new Date();
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
      
      // Find sessions starting in 10 minutes that haven't been notified
      const upcomingSessions = await Booking.find({
        status: 'ready_to_start',
        can_start: true,
        notification_sent: { $ne: true },
        $expr: {
          $and: [
            { $eq: [{ $dateFromString: { dateString: '$date' } }, { $dateFromString: { dateString: tenMinutesFromNow.toISOString().split('T')[0] } }] },
            { $eq: [{ $hour: { $dateFromString: { dateString: { $concat: ['$date', 'T', '$start_time', ':00'] } } } }, tenMinutesFromNow.getHours()] },
            { $eq: [{ $minute: { $dateFromString: { dateString: { $concat: ['$date', 'T', '$start_time', ':00'] } } } }, tenMinutesFromNow.getMinutes()] }
          ]
        }
      }).populate('master_id', 'user_id display_name')
        .populate('customer_id', '_id display_name');

      for (const booking of upcomingSessions) {
        await this.sendUpcomingNotification(booking);
      }
    } catch (error) {
      console.error('Error checking upcoming sessions:', error);
    }
  }

  async checkSessionsToStart() {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      // Find sessions that should start now (within 5 minutes of scheduled time)
      const sessionsToStart = await Booking.find({
        status: 'ready_to_start',
        can_start: true,
        auto_started: { $ne: true },
        actual_started_at: { $exists: false },
        $expr: {
          $and: [
            { $lte: [
              { $dateFromString: { dateString: { $concat: ['$date', 'T', '$start_time', ':00'] } } },
              now
            ]},
            { $gte: [
              { $dateFromString: { dateString: { $concat: ['$date', 'T', '$start_time', ':00'] } } },
              fiveMinutesAgo
            ]}
          ]
        }
      }).populate('master_id', 'user_id display_name')
        .populate('customer_id', '_id display_name');

      for (const booking of sessionsToStart) {
        await this.autoStartSession(booking);
      }
    } catch (error) {
      console.error('Error checking sessions to start:', error);
    }
  }

  async sendUpcomingNotification(booking) {
    try {
      const participants = [
        { userId: booking.customer_id._id, role: 'customer' },
        { userId: booking.master_id.user_id, role: 'master' }
      ];

      for (const participant of participants) {
        await createNotification({
          userId: participant.userId,
          type: 'session:upcoming',
          title: 'Sessione in arrivo',
          body: `La tua sessione ${booking.reservation_id} inizierà tra 10 minuti. Preparati!`,
          meta: { 
            bookingId: booking._id, 
            reservationId: booking.reservation_id,
            startTime: booking.start_time,
            date: booking.date
          }
        });

        emitToUser(participant.userId, 'session:upcoming', {
          bookingId: booking._id.toString(),
          reservationId: booking.reservation_id,
          message: 'La tua sessione inizierà tra 10 minuti',
          startTime: booking.start_time,
          date: booking.date
        });
      }

      // Mark as notified
      booking.notification_sent = true;
      await booking.save();

      console.log(`Sent upcoming notification for session ${booking.reservation_id}`);
    } catch (error) {
      console.error('Error sending upcoming notification:', error);
    }
  }

  async autoStartSession(booking) {
    try {
      // Use atomic update to prevent duplicate sessions
      const updatedBooking = await Booking.findOneAndUpdate(
        { 
          _id: booking._id,
          status: 'ready_to_start',
          auto_started: { $ne: true },
          actual_started_at: { $exists: false }
        },
        { 
          auto_started: true,
          status: 'active',
          started_by: 'system',
          started_at: new Date(),
          actual_started_at: new Date()
        },
        { new: true }
      );

      if (!updatedBooking) {
        console.log(`Booking ${booking.reservation_id} already processed or not ready`);
        return;
      }

      // Double-check no session exists
      const existingSession = await Session.findOne({ booking_id: booking._id });
      if (existingSession) {
        console.log(`Session already exists for booking ${booking.reservation_id}`);
        return;
      }

      const now = new Date();
      booking = updatedBooking; // Use the atomically updated booking

      // Store original booking details if not already stored
      if (!booking.original_booking || !booking.original_booking.date) {
        booking.original_booking = {
          date: booking.date,
          start_time: booking.start_time,
          end_time: booking.end_time
        };
      }

      // Update booking with actual session times
      const actualStartTime = now.toTimeString().slice(0, 5);
      const actualEndTime = new Date(now.getTime() + booking.duration_minutes * 60000).toTimeString().slice(0, 5);
      const actualDate = now.toISOString().split('T')[0];

      booking.date = actualDate;
      booking.start_time = actualStartTime;
      booking.end_time = actualEndTime;
      booking.can_start = false;
      booking.start_now_request = undefined;
      await booking.save();

      const durationMs = (booking.duration_minutes || 0) * 60 * 1000;
      const expiresAt = new Date(now.getTime() + durationMs);
      const priceCpm = booking.duration_minutes
        ? Math.round(booking.amount_cents / booking.duration_minutes)
        : booking.amount_cents;

      // Create chat thread if needed
      const thread = booking.channel === 'voice'
        ? null
        : await ChatThread.findOneAndUpdate(
            { booking_id: booking._id },
            {
              booking_id: booking._id,
              master_id: booking.master_id?._id,
              master_user_id: booking.master_id?.user_id,
              customer_id: booking.customer_id?._id,
              channel: booking.channel,
              allowed_seconds: Math.max(60, (booking.duration_minutes || 0) * 60),
              started_at: now,
              expires_at: expiresAt,
              status: 'open'
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

      // Create session record
      const session = await Session.findOneAndUpdate(
        { booking_id: booking._id },
        {
          user_id: booking.customer_id?._id,
          master_id: booking.master_id?._id,
          channel: booking.channel,
          start_ts: now,
          end_ts: expiresAt,
          price_cpm: priceCpm,
          status: 'active'
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const sessionUrl = booking.channel === 'voice'
        ? `/voice/${session._id}`
        : `/chat/${thread?._id || booking._id}`;

      const participants = [booking.customer_id._id, booking.master_id.user_id]
        .map(id => (id ? id.toString() : null))
        .filter(Boolean);

      // Send notifications
      await Promise.all([
        ...participants.map(userId => createNotification({
          userId,
          type: 'session:auto_started',
          title: 'Sessione avviata automaticamente',
          body: `La sessione ${booking.reservation_id} è iniziata. Unisciti ora!`,
          meta: { bookingId: booking._id, reservationId: booking.reservation_id }
        }))
      ]);

      // Emit socket events
      participants.forEach(userId => {
        emitToUser(userId, 'booking:session_started', {
          bookingId: booking._id.toString(),
          reservationId: booking.reservation_id,
          sessionUrl,
          sessionId: session?._id?.toString(),
          autoStarted: true
        });
      });

      console.log(`Auto-started session ${booking.reservation_id}`);
    } catch (error) {
      console.error('Error auto-starting session:', error);
    }
  }

  stop() {
    // Note: node-cron doesn't provide a direct way to stop specific tasks
    // In a production environment, you'd want to track task references
    this.isRunning = false;
    console.log('Session scheduler stopped');
  }
}

export const sessionScheduler = new SessionSchedulerService();