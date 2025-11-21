import mongoose from 'mongoose';

const sessionNotificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  master_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', required: true, index: true },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

// Compound index to prevent duplicate subscriptions
sessionNotificationSchema.index({ user_id: 1, master_id: 1 }, { unique: true });

export const SessionNotification = mongoose.model('SessionNotification', sessionNotificationSchema);