import mongoose from 'mongoose';

const chatThreadNoteSchema = new mongoose.Schema({
  thread_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatThread', required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  note: { type: String, default: '' }
}, { timestamps: true });

chatThreadNoteSchema.index({ thread_id: 1, user_id: 1 }, { unique: true });

export const ChatThreadNote = mongoose.model('ChatThreadNote', chatThreadNoteSchema);
