import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  thread_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatThread', required: true, index: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sender_role: { type: String, enum: ['master', 'client'], required: true },
  body: { type: String, required: true, maxlength: 2000 },
  read_by: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] }
}, { timestamps: true });

chatMessageSchema.index({ thread_id: 1, createdAt: 1 });
chatMessageSchema.index({ thread_id: 1, read_by: 1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
