import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  master_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', index: true, required: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  channel: { type: String, enum: ['chat', 'chat_voice'], required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  amount_cents: { type: Number, required: true },
  duration_minutes: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['awaiting_master', 'confirmed', 'rejected', 'cancelled', 'completed'],
    default: 'awaiting_master'
  },
  wallet_txn_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  notes: { type: String, maxlength: 600 }
}, { timestamps: true });

bookingSchema.index({ master_id: 1, date: 1 });
bookingSchema.index({ customer_id: 1, status: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
