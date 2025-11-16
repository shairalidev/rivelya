import mongoose from 'mongoose';

const chatThreadSchema = new mongoose.Schema({
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', unique: true, required: true },
  master_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', required: true, index: true },
  master_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  channel: { type: String, enum: ['chat', 'chat_voice'], default: 'chat' },
  active_call_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatCall', default: null },
  allowed_seconds: { type: Number, default: 0 },
  started_at: { type: Date },
  expires_at: { type: Date },
  last_message_at: { type: Date },
  status: { type: String, enum: ['open', 'expired'], default: 'open', index: true }
}, { timestamps: true });

chatThreadSchema.index({ booking_id: 1 });
chatThreadSchema.index({ expires_at: 1 });

export const ChatThread = mongoose.model('ChatThread', chatThreadSchema);
