import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  reservation_id: { type: String, unique: true, required: true, index: true },
  master_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', index: true, required: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  channel: { type: String, enum: ['chat', 'voice', 'chat_voice'], required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  amount_cents: { type: Number, required: true },
  duration_minutes: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: [
      'awaiting_master',
      'confirmed',
      'ready_to_start',
      'active',
      'rejected',
      'cancelled',
      'completed',
      'reschedule_requested'
    ],
    default: 'awaiting_master'
  },
  can_start: { type: Boolean, default: false },
  started_by: { type: String, enum: ['customer', 'master'] },
  started_at: { type: Date },
  actual_started_at: { type: Date },
  start_now_request: {
    requested_by: { type: String, enum: ['customer', 'master'] },
    requested_at: { type: Date },
    responded_at: { type: Date },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'] }
  },
  master_response: {
    action: { type: String, enum: ['accept', 'reject'] },
    note: { type: String, maxlength: 600 },
    responded_at: { type: Date }
  },
  wallet_txn_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  notes: { type: String, maxlength: 600 },
  reschedule_request: {
    requested_by: { type: String, enum: ['customer', 'master'] },
    new_date: { type: String },
    new_start_time: { type: String },
    new_end_time: { type: String },
    reason: { type: String, maxlength: 300 },
    requested_at: { type: Date }
  },
  reschedule_history: [{
    requested_by: { type: String, enum: ['customer', 'master'] },
    new_date: { type: String },
    new_start_time: { type: String },
    new_end_time: { type: String },
    reason: { type: String, maxlength: 300 },
    requested_at: { type: Date },
    response: { type: String, enum: ['accepted', 'rejected', 'superseded'] },
    responded_at: { type: Date }
  }],
  original_booking: {
    type: new mongoose.Schema({
      date: { type: String },
      start_time: { type: String },
      end_time: { type: String }
    }, { _id: false }),
    default: {}
  }
}, { timestamps: true });

bookingSchema.index({ master_id: 1, date: 1 });
bookingSchema.index({ customer_id: 1, status: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });

// Generate reservation ID before saving
bookingSchema.pre('save', function(next) {
  if (!this.reservation_id) {
    this.reservation_id = 'RV' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
  }
  next();
});

// Also generate on validate to ensure it's set before validation
bookingSchema.pre('validate', function(next) {
  if (!this.reservation_id) {
    this.reservation_id = 'RV' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
  }
  next();
});

export const Booking = mongoose.model('Booking', bookingSchema);
