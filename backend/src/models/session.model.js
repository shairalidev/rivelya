import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  master_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  channel: { type: String, enum: ['chat', 'voice', 'chat_voice'], required: true },
  start_ts: { type: Date },
  end_ts: { type: Date },
  duration_s: { type: Number, default: 0 },
  price_cpm: { type: Number, required: true }, // cents per minute
  cost_cents: { type: Number, default: 0 },
  status: { type: String, enum: ['created', 'active', 'ended', 'failed'], default: 'created' },
  cdr: { type: Object, default: {} },
  twilio_conference_sid: { type: String },
  twilio_customer_call_sid: { type: String },
  twilio_master_call_sid: { type: String },
  notes: {
    type: Map,
    of: {
      content: { type: String, default: '' },
      updatedAt: { type: Date, default: Date.now }
    },
    default: {}
  }
}, { timestamps: true });

export const Session = mongoose.model('Session', sessionSchema);
