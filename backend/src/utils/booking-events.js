import { emitToUser } from '../lib/socket.js';
import { Booking } from '../models/booking.model.js';
import { createNotification } from './notifications.js';
import { getPublicDisplayName } from './privacy.js';

export const emitBookingCompletionEvents = async booking => {
  if (!booking) return;

  const customerUserId = booking.customer_id?._id?.toString?.() || booking.customer_id?.toString?.();
  const masterUserId = booking.master_id?.user_id?._id?.toString?.()
    || booking.master_id?.user_id?.toString?.()
    || booking.master_id?.toString?.();

  const participants = [
    {
      userId: customerUserId,
      role: 'customer',
      partnerName: getPublicDisplayName(booking.master_id) || 'Consulente',
      partnerType: 'master'
    },
    {
      userId: masterUserId,
      role: 'master',
      partnerName: getPublicDisplayName(booking.customer_id, 'Cliente'),
      partnerType: 'client'
    }
  ].filter(participant => participant.userId);

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
      message: 'La sessione è terminata',
      partnerName: participant.partnerName,
      partnerType: participant.partnerType
    });

    if (participant.role === 'customer') {
      const partnerName = booking.master_id?.user_id?.display_name
        || booking.master_id?.display_name
        || 'Consulente';

      emitToUser(participant.userId, 'session:review:prompt', {
        bookingId: booking._id.toString(),
        reservationId: booking.reservation_id,
        partnerName,
        partnerType: 'master'
      });
    }
  }
};

export const completeBookingAndPromptReview = async bookingId => {
  if (!bookingId) return null;

  const booking = await Booking.findById(bookingId)
    .populate('master_id', 'user_id display_name')
    .populate('customer_id', '_id display_name');

  if (!booking) return null;

  booking.status = 'completed';
  booking.completed_at = booking.completed_at || new Date();
  await booking.save();

  await emitBookingCompletionEvents(booking);
  return booking;
};
