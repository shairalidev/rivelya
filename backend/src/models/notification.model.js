import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed },
  read_at: { type: Date, default: null, index: true }
}, { timestamps: true });

notificationSchema.index({ user_id: 1, read_at: 1 });
notificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
